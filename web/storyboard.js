import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// Load CSS
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = new URL("./storyboard.css", import.meta.url).href;
document.head.appendChild(link);

// Main Storyboard Workspace Extension
app.registerExtension({
    name: "Comfypencil.Storyboard",
    async setup() {
        api.addEventListener("storyboard/update", ({ detail }) => {
            console.log("Storyboard update event received:", detail);
            if (StoryboardWorkspace.instance && StoryboardWorkspace.instance.boardId === detail.board_id) {
                console.log("Reloading board:", detail.board_id);
                StoryboardWorkspace.instance.loadBoard();
            }
        });
    },
    async nodeCreated(node) {
        if (node.comfyClass === "Storyboard") {
            // Add custom button to the Storyboard node
            node.addWidget("button", "Open Storyboard", "open", () => {
                const boardId = node.widgets.find(w => w.name === "board_id")?.value || "default";
                StoryboardWorkspace.open(boardId, node);
            });
        }
    }
});

class StoryboardWorkspace {
    static instance = null;

    static open(boardId, node) {
        if (!this.instance) {
            this.instance = new StoryboardWorkspace();
        }
        this.instance.show(boardId, node);
    }

    constructor() {
        this.createWindow();
        this.boardId = "default";
        this.node = null;
        this.boardData = null;
        this.scale = 1;
        this.offset = { x: 0, y: 0 };

        // Global shortcuts
        window.addEventListener("keydown", (e) => {
            if (this.overlay.style.display === "flex") {
                if (e.key === "Delete") {
                    const focused = document.activeElement;
                    if (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA") return;
                    
                    if (this.boardData.selection.length > 0) {
                        this.boardData.items = this.boardData.items.filter(i => !this.boardData.selection.includes(i.id));
                        this.boardData.selection = [];
                        this.renderBoard();
                        this.saveBoard();
                    }
                }
            }
        });
    }

    createWindow() {
        this.overlay = document.createElement("div");
        this.overlay.className = "storyboard-overlay";
        this.overlay.style.display = "none";
        
        this.window = document.createElement("div");
        this.window.className = "storyboard-window";
        
        const header = document.createElement("div");
        header.className = "storyboard-header";
        header.innerHTML = `
            <div class="storyboard-header-left">
                <span>Storyboard:</span>
                <select id="storyboard-selector"></select>
                <button id="storyboard-refresh-board" title="Refresh Board">🔄</button>
                <button id="storyboard-new-board" title="New Board">➕</button>
                <button id="storyboard-rename-board" title="Rename Board">✏️</button>
                <button id="storyboard-delete-board" class="danger" title="Delete Board">🗑️</button>
            </div>
            <div class="storyboard-controls">
                <button id="storyboard-add-slot">+ Add Slot</button>
                <button id="storyboard-add-note">+ Add Note</button>
                <button id="storyboard-add-frame">+ Add Frame</button>
                <button id="storyboard-clear" class="danger">Clear Board</button>
                <button id="storyboard-close">✕</button>
            </div>
        `;
        
        const main = document.createElement("div");
        main.className = "storyboard-main";
        
        this.canvasContainer = document.createElement("div");
        this.canvasContainer.className = "storyboard-canvas-container";
        
        this.canvas = document.createElement("div");
        this.canvas.className = "storyboard-canvas";
        
        this.inspector = document.createElement("div");
        this.inspector.className = "storyboard-inspector";
        this.inspector.innerHTML = `
            <h3>Inspector</h3>
            <div id="inspector-content">Select an item to see details</div>
        `;

        this.canvasContainer.appendChild(this.canvas);
        main.appendChild(this.canvasContainer);
        main.appendChild(this.inspector);
        
        const footer = document.createElement("div");
        footer.className = "storyboard-footer";
        footer.innerHTML = `
            <textarea id="storyboard-prompt" placeholder="Enter prompt..."></textarea>
            <button id="storyboard-queue">Queue Prompt</button>
        `;

        this.window.appendChild(header);
        this.window.appendChild(main);
        this.window.appendChild(footer);
        
        this.contextMenu = document.createElement("div");
        this.contextMenu.className = "storyboard-context-menu";
        this.contextMenu.style.display = "none";
        document.body.appendChild(this.contextMenu);
        
        this.overlay.appendChild(this.window);
        document.body.appendChild(this.overlay);

        document.getElementById("storyboard-close").onclick = () => this.hide();
        
        this.boardSelector = document.getElementById("storyboard-selector");
        this.boardSelector.onchange = (e) => this.show(e.target.value, this.node);

        document.getElementById("storyboard-refresh-board").onclick = () => this.loadBoard();

        document.getElementById("storyboard-new-board").onclick = async () => {
            const name = prompt("Enter new storyboard name:");
            if (name) {
                this.show(name, this.node);
            }
        };

        document.getElementById("storyboard-rename-board").onclick = async () => {
            const newName = prompt("Enter new name for this storyboard:", this.boardId);
            if (newName && newName !== this.boardId) {
                const response = await fetch(`/mkr/storyboard/${this.boardId}/rename/${newName}`, { method: "POST" });
                const result = await response.json();
                if (result.status === "ok") {
                    this.show(newName, this.node);
                } else {
                    alert("Rename failed. Name might already exist.");
                }
            }
        };

        document.getElementById("storyboard-delete-board").onclick = async () => {
            if (confirm(`Are you sure you want to delete the storyboard "${this.boardId}"? This cannot be undone.`)) {
                const response = await fetch(`/mkr/storyboard/${this.boardId}`, { method: "DELETE" });
                const result = await response.json();
                if (result.status === "ok") {
                    this.show("default", this.node);
                }
            }
        };

        document.getElementById("storyboard-add-slot").onclick = () => {
            this.boardData.items.push({
                id: `slot_${Date.now()}`,
                type: "slot",
                x: -this.offset.x / this.scale + 100,
                y: -this.offset.y / this.scale + 100,
                w: 512,
                h: 512,
                label: "New Slot",
                tags: []
            });
            this.renderBoard();
            this.saveBoard();
        };

        document.getElementById("storyboard-add-note").onclick = () => {
            this.boardData.items.push({
                id: `note_${Date.now()}`,
                type: "note",
                x: -this.offset.x / this.scale + 150,
                y: -this.offset.y / this.scale + 150,
                w: 200,
                h: 150,
                content: "New Note",
                color: "#ffeb3b"
            });
            this.renderBoard();
            this.saveBoard();
        };

        document.getElementById("storyboard-add-frame").onclick = () => {
            this.boardData.items.push({
                id: `frame_${Date.now()}`,
                type: "frame",
                x: -this.offset.x / this.scale + 200,
                y: -this.offset.y / this.scale + 200,
                w: 600,
                h: 400,
                label: "New Frame",
                color: "#4CAF50"
            });
            this.renderBoard();
            this.saveBoard();
        };

        const promptEl = document.getElementById("storyboard-prompt");
        promptEl.oninput = () => {
            if (this.node) {
                const promptWidget = this.node.widgets.find(w => w.name === "prompt");
                if (promptWidget) {
                    promptWidget.value = promptEl.value;
                }
            }
        };

        document.getElementById("storyboard-queue").onclick = () => {
            app.queuePrompt(0);
        };

        document.getElementById("storyboard-clear").onclick = async () => {
            if (confirm("Are you sure you want to clear the entire board?")) {
                this.boardData.items = [];
                this.boardData.selection = [];
                this.renderBoard();
                await this.saveBoard();
            }
        };

        this.setupInteractions();
    }

    async show(boardId, node) {
        this.boardId = boardId;
        this.node = node;
        this.overlay.style.display = "flex";
        
        // Sync node widget if it exists
        if (this.node) {
            const boardIdWidget = this.node.widgets.find(w => w.name === "board_id");
            if (boardIdWidget && boardIdWidget.value !== this.boardId) {
                boardIdWidget.value = this.boardId;
            }
        }

        await this.loadBoard();
        await this.refreshBoardList();
    }

    async refreshBoardList() {
        const response = await fetch("/mkr/storyboard/list");
        const { boards } = await response.json();
        
        this.boardSelector.innerHTML = "";
        boards.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b;
            opt.innerText = b;
            if (b === this.boardId) opt.selected = true;
            this.boardSelector.appendChild(opt);
        });

        // Ensure current board is in the list even if it's new
        if (!boards.includes(this.boardId)) {
            const opt = document.createElement("option");
            opt.value = this.boardId;
            opt.innerText = this.boardId;
            opt.selected = true;
            this.boardSelector.appendChild(opt);
        }
    }

    hide() {
        this.overlay.style.display = "none";
        this.node = null;
    }

    async loadBoard() {
        const response = await fetch(`/mkr/storyboard/${this.boardId}`);
        this.boardData = await response.json();
        console.log("Storyboard loaded:", this.boardData);
        if (!this.boardData.selection) this.boardData.selection = [];
        this.renderBoard();

        // Sync prompt if node exists
        if (this.node) {
            const promptWidget = this.node.widgets.find(w => w.name === "prompt");
            const promptEl = document.getElementById("storyboard-prompt");
            if (promptWidget && promptEl) {
                promptEl.value = promptWidget.value || "";
            }
        }
    }

    async saveBoard(notify = false) {
        await fetch(`/mkr/storyboard/${this.boardId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...this.boardData, notify })
        });

        // Update node version to trigger ComfyUI execution
        if (this.node) {
            const versionWidget = this.node.widgets.find(w => w.name === "version");
            if (versionWidget) {
                versionWidget.value = (versionWidget.value || 0) + 1;
            }
        }
    }

    getContrastColor(hexcolor) {
        if (!hexcolor) return "#333";
        // If hexcolor is something like "#ffeb3b"
        const r = parseInt(hexcolor.slice(1, 3), 16);
        const g = parseInt(hexcolor.slice(3, 5), 16);
        const b = parseInt(hexcolor.slice(5, 7), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? "#000" : "#fff";
    }

    generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    renderBoard() {
        this.canvas.innerHTML = "";
        this.boardData.items.forEach(item => {
            const el = document.createElement("div");
            el._itemId = item.id;
            el.className = "storyboard-item";
            if (this.boardData.selection.includes(item.id)) {
                el.classList.add("selected");
            }
            el.style.left = `${item.x}px`;
            el.style.top = `${item.y}px`;
            el.style.width = `${item.w}px`;
            el.style.height = `${item.h}px`;
            
            // Reference Pill
            if (item.ref_id) {
                const pill = document.createElement("div");
                pill.className = "storyboard-ref-pill";
                pill.innerText = `REF ${item.ref_id}`;
                el.appendChild(pill);
            }

            // Resize handle
            const resizeHandle = document.createElement("div");
            resizeHandle.className = "storyboard-resize-handle";
            resizeHandle.onmousedown = (e) => {
                e.stopPropagation();
                e.preventDefault();
                const startX = e.clientX;
                const startY = e.clientY;
                const startW = item.w;
                const startH = item.h;

                const onMouseMove = (moveEvent) => {
                    const dw = (moveEvent.clientX - startX) / this.scale;
                    const dh = (moveEvent.clientY - startY) / this.scale;
                    
                    if (moveEvent.shiftKey) {
                        // Uniform scaling
                        const ratio = startW / startH;
                        if (Math.abs(dw) > Math.abs(dh)) {
                            item.w = Math.max(50, startW + dw);
                            item.h = item.w / ratio;
                        } else {
                            item.h = Math.max(50, startH + dh);
                            item.w = item.h * ratio;
                        }
                    } else {
                        item.w = Math.max(50, startW + dw);
                        item.h = Math.max(50, startH + dh);
                    }
                    
                    el.style.width = `${item.w}px`;
                    el.style.height = `${item.h}px`;
                };

                const onMouseUp = () => {
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("mouseup", onMouseUp);
                    this.saveBoard();
                    this.renderBoard(); // Final sync and update inspector
                };

                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
            };
            el.appendChild(resizeHandle);
            
            el.onmousedown = (e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                e.preventDefault(); // Prevent browser default drag behavior
                
                // Selection logic
                if (!e.shiftKey && !this.boardData.selection.includes(item.id)) {
                    this.boardData.selection = [item.id];
                } else if (e.shiftKey) {
                    if (this.boardData.selection.includes(item.id)) {
                        this.boardData.selection = this.boardData.selection.filter(id => id !== item.id);
                    } else {
                        this.boardData.selection.push(item.id);
                    }
                }
                this.renderBoard();

                // Dragging logic
                const startX = e.clientX;
                const startY = e.clientY;
                const selectedElements = this.boardData.selection.map(id => {
                    const it = this.boardData.items.find(i => i.id === id);
                    const domEl = Array.from(this.canvas.children).find(child => child._itemId === id);
                    return { item: it, domEl, startX: it.x, startY: it.y };
                }).filter(entry => entry.domEl);

                const onMouseMove = (moveEvent) => {
                    const dx = (moveEvent.clientX - startX) / this.scale;
                    const dy = (moveEvent.clientY - startY) / this.scale;

                    selectedElements.forEach(entry => {
                        entry.item.x = entry.startX + dx;
                        entry.item.y = entry.startY + dy;
                        entry.domEl.style.left = `${entry.item.x}px`;
                        entry.domEl.style.top = `${entry.item.y}px`;
                    });
                };

                const onMouseUp = () => {
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("mouseup", onMouseUp);
                    this.saveBoard();
                    this.renderBoard(); // Final sync and update inspector
                };

                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
            };

            if (item.type === "image") {
                const img = document.createElement("img");
                img.src = `/mkr/storyboard/asset/${this.boardId}/${item.image_ref}`;
                img.draggable = false; // Prevent browser ghost drag
                el.appendChild(img);
            } else if (item.type === "slot") {
                el.classList.add("slot-item");
                const label = document.createElement("div");
                label.className = "slot-label";
                label.innerText = item.label || "Empty Slot";
                el.appendChild(label);
            } else if (item.type === "note") {
                el.classList.add("note-item");
                const bgColor = item.color || "#ffeb3b";
                el.style.backgroundColor = bgColor;
                el.style.color = this.getContrastColor(bgColor);
                const content = document.createElement("div");
                content.className = "note-content";
                content.innerText = item.content || "";
                el.appendChild(content);
            } else if (item.type === "frame") {
                el.classList.add("frame-item");
                el.style.borderColor = item.color || "#4CAF50";
                const label = document.createElement("div");
                label.className = "frame-label";
                label.innerText = item.label || "";
                label.style.backgroundColor = item.color || "#4CAF50";
                el.appendChild(label);
            }
            
            this.canvas.appendChild(el);
        });
        this.renderInspector();
    }

    renderInspector() {
        const content = document.getElementById("inspector-content");
        if (this.boardData.selection.length === 0) {
            content.innerHTML = "Select an item to see details";
            return;
        }

        if (this.boardData.selection.length > 1) {
            content.innerHTML = `
                <div class="inspector-summary">${this.boardData.selection.length} items selected</div>
                <div class="inspector-actions">
                    <button id="action-align-left">Align Left</button>
                    <button id="action-align-right">Align Right</button>
                    <button id="action-align-top">Align Top</button>
                    <button id="action-align-bottom">Align Bottom</button>
                    <button id="action-distribute-h">Distribute H</button>
                    <button id="action-distribute-v">Distribute V</button>
                    <button id="action-delete-selected" class="danger">Delete Selected</button>
                </div>
            `;

            document.getElementById("action-align-left").onclick = () => {
                const minX = Math.min(...this.boardData.selection.map(id => this.boardData.items.find(i => i.id === id).x));
                this.boardData.selection.forEach(id => {
                    this.boardData.items.find(i => i.id === id).x = minX;
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-align-right").onclick = () => {
                const maxX = Math.max(...this.boardData.selection.map(id => {
                    const i = this.boardData.items.find(it => it.id === id);
                    return i.x + i.w;
                }));
                this.boardData.selection.forEach(id => {
                    const it = this.boardData.items.find(i => i.id === id);
                    it.x = maxX - it.w;
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-align-top").onclick = () => {
                const minY = Math.min(...this.boardData.selection.map(id => this.boardData.items.find(i => i.id === id).y));
                this.boardData.selection.forEach(id => {
                    this.boardData.items.find(i => i.id === id).y = minY;
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-align-bottom").onclick = () => {
                const maxY = Math.max(...this.boardData.selection.map(id => {
                    const i = this.boardData.items.find(it => it.id === id);
                    return i.y + i.h;
                }));
                this.boardData.selection.forEach(id => {
                    const it = this.boardData.items.find(i => i.id === id);
                    it.y = maxY - it.h;
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-distribute-h").onclick = () => {
                const selectedItems = this.boardData.selection.map(id => this.boardData.items.find(i => i.id === id)).sort((a, b) => a.x - b.x);
                if (selectedItems.length < 3) return;
                const minX = selectedItems[0].x;
                const maxX = selectedItems[selectedItems.length - 1].x;
                const gap = (maxX - minX) / (selectedItems.length - 1);
                selectedItems.forEach((it, i) => {
                    it.x = minX + (i * gap);
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-distribute-v").onclick = () => {
                const selectedItems = this.boardData.selection.map(id => this.boardData.items.find(i => i.id === id)).sort((a, b) => a.y - b.y);
                if (selectedItems.length < 3) return;
                const minY = selectedItems[0].y;
                const maxY = selectedItems[selectedItems.length - 1].y;
                const gap = (maxY - minY) / (selectedItems.length - 1);
                selectedItems.forEach((it, i) => {
                    it.y = minY + (i * gap);
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-delete-selected").onclick = () => {
                this.boardData.items = this.boardData.items.filter(i => !this.boardData.selection.includes(i.id));
                this.boardData.selection = [];
                this.renderBoard();
                this.saveBoard();
            };
            return;
        }

        const item = this.boardData.items.find(i => i.id === this.boardData.selection[0]);
        if (!item) return;

        let fields = `
            <div class="inspector-field">
                <label>ID</label>
                <input type="text" value="${item.id}" readonly style="opacity: 0.5">
            </div>
        `;

        if (item.type === "image" || item.type === "slot") {
            fields += `
                <div class="inspector-field">
                    <label>Label</label>
                    <input type="text" id="inspector-label" value="${item.label || ""}">
                </div>
                <div class="inspector-field">
                    <label>Tags (comma separated)</label>
                    <input type="text" id="inspector-tags" value="${(item.tags || []).join(", ")}">
                </div>
            `;
        } else if (item.type === "frame") {
            fields += `
                <div class="inspector-field">
                    <label>Label</label>
                    <input type="text" id="inspector-label" value="${item.label || ""}">
                </div>
                <div class="inspector-field">
                    <label>Color</label>
                    <input type="color" id="inspector-color" value="${item.color || "#4CAF50"}">
                </div>
            `;
        } else if (item.type === "note") {
            fields += `
                <div class="inspector-field">
                    <label>Content</label>
                    <textarea id="inspector-content-text" rows="5">${item.content || ""}</textarea>
                </div>
                <div class="inspector-field">
                    <label>Color</label>
                    <input type="color" id="inspector-color" value="${item.color || "#ffeb3b"}">
                </div>
            `;
        }

        content.innerHTML = fields + `
            <div class="inspector-actions">
                <button id="action-copy">Copy to Clipboard</button>
                <button id="action-front">Bring to Front</button>
                <button id="action-back">Send to Back</button>
                <button id="action-delete" class="danger">Delete Item</button>
            </div>
        `;

        document.getElementById("action-copy").onclick = async () => {
            if (item.type === "image") {
                const imgUrl = `/mkr/storyboard/asset/${this.boardId}/${item.image_ref}`;
                try {
                    const response = await fetch(imgUrl);
                    const blob = await response.blob();
                    const data = [new ClipboardItem({ [blob.type]: blob })];
                    await navigator.clipboard.write(data);
                    alert("Image copied to clipboard!");
                } catch (err) {
                    console.error("Failed to copy image: ", err);
                }
            } else if (item.type === "note") {
                try {
                    await navigator.clipboard.writeText(item.content || "");
                    alert("Note content copied to clipboard!");
                } catch (err) {
                    console.error("Failed to copy text: ", err);
                }
            }
        };

        document.getElementById("action-front").onclick = () => {
            const index = this.boardData.items.indexOf(item);
            this.boardData.items.splice(index, 1);
            this.boardData.items.push(item);
            this.renderBoard();
            this.saveBoard();
        };

        document.getElementById("action-back").onclick = () => {
            const index = this.boardData.items.indexOf(item);
            this.boardData.items.splice(index, 1);
            this.boardData.items.unshift(item);
            this.renderBoard();
            this.saveBoard();
        };

        document.getElementById("action-delete").onclick = () => {
            this.boardData.items = this.boardData.items.filter(i => i.id !== item.id);
            this.boardData.selection = [];
            this.renderBoard();
            this.saveBoard();
        };

        if (item.type === "image" || item.type === "slot") {
            document.getElementById("inspector-label").onchange = (e) => {
                item.label = e.target.value;
                this.saveBoard();
            };

            document.getElementById("inspector-tags").onchange = (e) => {
                item.tags = e.target.value.split(",").map(s => s.trim()).filter(s => s);
                this.saveBoard();
            };
        } else if (item.type === "frame") {
            document.getElementById("inspector-label").onchange = (e) => {
                item.label = e.target.value;
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("inspector-color").onchange = (e) => {
                item.color = e.target.value;
                this.renderBoard();
                this.saveBoard();
            };
        } else if (item.type === "note") {
            document.getElementById("inspector-content-text").onchange = (e) => {
                item.content = e.target.value;
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("inspector-color").onchange = (e) => {
                item.color = e.target.value;
                this.renderBoard();
                this.saveBoard();
            };
        }
    }

    setupInteractions() {
        // Simple pan and zoom logic
        let isPanning = false;
        let startPos = { x: 0, y: 0 };

        this.canvas.onclick = () => {
            this.boardData.selection = [];
            this.renderBoard();
            this.saveBoard();
        };

        this.canvasContainer.onmousedown = (e) => {
            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                isPanning = true;
                startPos = { x: e.clientX - this.offset.x, y: e.clientY - this.offset.y };
            }
        };

        window.onmousemove = (e) => {
            if (isPanning) {
                this.offset.x = e.clientX - startPos.x;
                this.offset.y = e.clientY - startPos.y;
                this.updateTransform();
            }
        };

        window.onmouseup = () => {
            isPanning = false;
        };

        this.canvasContainer.onwheel = (e) => {
            e.preventDefault();
            const zoomSpeed = 0.001;
            const delta = -e.deltaY;
            const zoom = Math.exp(delta * zoomSpeed);
            
            // Zoom at cursor position
            const rect = this.canvasContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const oldScale = this.scale;
            this.scale *= zoom;
            
            this.offset.x = mouseX - (mouseX - this.offset.x) * (this.scale / oldScale);
            this.offset.y = mouseY - (mouseY - this.offset.y) * (this.scale / oldScale);
            
            this.updateTransform();
        };

        // Drag and drop support
        this.canvasContainer.ondragover = (e) => e.preventDefault();
        
        window.onpaste = async (e) => {
            const items = e.clipboardData.items;
            for (const item of items) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    const formData = new FormData();
                    formData.append("image", file);
                    
                    const response = await fetch(`/mkr/storyboard/${this.boardId}/upload`, {
                        method: "POST",
                        body: formData
                    });
                    
                    const result = await response.json();
                    if (result.filename) {
                        this.boardData.items.push({
                            id: this.generateUUID(),
                            type: "image",
                            x: -this.offset.x / this.scale + 100,
                            y: -this.offset.y / this.scale + 100,
                            w: 512,
                            h: 512,
                            image_ref: result.filename
                        });
                        this.renderBoard();
                        await this.saveBoard();
                    }
                }
            }
        };

        this.canvasContainer.ondrop = async (e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            
            // Calculate position in canvas space
            const rect = this.canvasContainer.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - this.offset.x) / this.scale;
            const mouseY = (e.clientY - rect.top - this.offset.y) / this.scale;

            for (const file of files) {
                if (file.type.startsWith("image/")) {
                    const formData = new FormData();
                    formData.append("image", file);
                    
                    const response = await fetch(`/mkr/storyboard/${this.boardId}/upload`, {
                        method: "POST",
                        body: formData
                    });
                    
                    const result = await response.json();
                    if (result.filename) {
                        this.boardData.items.push({
                            id: this.generateUUID(),
                            type: "image",
                            x: mouseX,
                            y: mouseY,
                            w: 512,
                            h: 512,
                            image_ref: result.filename
                        });
                        this.renderBoard();
                        await this.saveBoard();
                    }
                }
            }
        };

        this.canvasContainer.oncontextmenu = (e) => {
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY);
        };

        window.addEventListener("mousedown", (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.contextMenu.style.display = "none";
            }
        });
    }

    showContextMenu(x, y) {
        this.contextMenu.style.display = "block";
        this.contextMenu.style.left = `${x}px`;
        this.contextMenu.style.top = `${y}px`;
        this.contextMenu.innerHTML = "";

        const actions = [];
        if (this.boardData.selection.length > 0) {
            actions.push({ label: "Bring to Front", action: () => document.getElementById("action-front")?.click() });
            actions.push({ label: "Send to Back", action: () => document.getElementById("action-back")?.click() });
            
            if (this.boardData.selection.length === 1) {
                const item = this.boardData.items.find(i => i.id === this.boardData.selection[0]);
                if (item.type === "image" || item.type === "frame") {
                    for (let i = 1; i <= 8; i++) {
                        actions.push({ 
                            label: `Set as Ref ${i}`, 
                            action: () => {
                                // Clear this ref from any other item first
                                this.boardData.items.forEach(it => {
                                    if (it.ref_id === i) delete it.ref_id;
                                });
                                item.ref_id = i;
                                this.renderBoard();
                                this.saveBoard();
                            } 
                        });
                    }
                    if (item.ref_id) {
                        actions.push({ 
                            label: "Clear Reference", 
                            action: () => {
                                delete item.ref_id;
                                this.renderBoard();
                                this.saveBoard();
                            } 
                        });
                    }
                }
            }

            actions.push({ label: "Delete", action: () => {
                if (this.boardData.selection.length === 1) document.getElementById("action-delete")?.click();
                else document.getElementById("action-delete-selected")?.click();
            }});
        } else {
            actions.push({ label: "Add Slot", action: () => document.getElementById("storyboard-add-slot")?.click() });
            actions.push({ label: "Add Note", action: () => document.getElementById("storyboard-add-note")?.click() });
            actions.push({ label: "Add Frame", action: () => document.getElementById("storyboard-add-frame")?.click() });
        }

        actions.forEach(a => {
            const btn = document.createElement("button");
            btn.innerText = a.label;
            btn.onclick = () => {
                a.action();
                this.contextMenu.style.display = "none";
            };
            this.contextMenu.appendChild(btn);
        });
    }

    updateTransform() {
        this.canvas.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
    }
}

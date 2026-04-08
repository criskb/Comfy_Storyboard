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
        const callback = (event) => {
            const detail = event.detail;
            console.log("Storyboard update event received:", detail);
            if (StoryboardWorkspace.instance) {
                if (!detail || !detail.board_id || StoryboardWorkspace.instance.boardId === detail.board_id) {
                    console.log("Reloading board:", detail?.board_id || "current");
                    StoryboardWorkspace.instance.loadBoard();
                }
            }
        };
        api.addEventListener("storyboard_update", callback);
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
        this.itemElements = new Map();
        this.isInteracting = false;
        this.paletteCache = new Map(); // frameId -> colors[]
        this.paletteLoading = new Set(); // frameIds currently fetching
        this.internalClipboard = [];
        this.needsReload = false;

        // Global shortcuts
        window.addEventListener("keydown", (e) => {
            if (this.overlay.style.display === "flex") {
                const focused = document.activeElement;
                if (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA") return;

                if (e.key === "Delete") {
                    if (this.boardData.selection.length > 0) {
                        this.boardData.items = this.boardData.items.filter(i => !this.boardData.selection.includes(i.id));
                        this.boardData.selection = [];
                        this.renderBoard();
                        this.saveBoard();
                    }
                } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
                    this.handleCopy();
                } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
                    this.handlePaste();
                }
            }
        });

        window.addEventListener("paste", (e) => {
            if (this.overlay.style.display === "flex") {
                const focused = document.activeElement;
                if (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA") return;
                
                const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                for (let index in items) {
                    const item = items[index];
                    if (item.kind === 'file' && item.type.startsWith('image/')) {
                        const blob = item.getAsFile();
                        this.handlePasteImage(blob);
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
        // Clear cache when switching boards
        if (this.boardId !== boardId) {
            this.itemElements.forEach(el => el.remove());
            this.itemElements.clear();
            this.canvas.innerHTML = "";
        }
        
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
        if (this.isInteracting) {
            this.needsReload = true;
            return;
        }
        this.needsReload = false;
        const response = await fetch(`/mkr/storyboard/${this.boardId}?t=${Date.now()}`);
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
        // Track which items are current to remove old ones later
        const currentItemIds = new Set(this.boardData.items.map(i => i.id));
        
        // Remove DOM elements for items that no longer exist
        for (const [id, el] of this.itemElements.entries()) {
            if (!currentItemIds.has(id)) {
                el.remove();
                this.itemElements.delete(id);
            }
        }

        this.boardData.items.forEach((item, index) => {
            let el = this.itemElements.get(item.id);
            let isNew = false;
            
            if (!el) {
                el = document.createElement("div");
                el._itemId = item.id;
                el.className = "storyboard-item";
                this.itemElements.set(item.id, el);
                this.canvas.appendChild(el);
                isNew = true;
                
                // Add interaction handlers once
                this.addItemInteractions(el, item);
            }

            // Update state
            el.classList.toggle("selected", this.boardData.selection.includes(item.id));
            
            // Set styles
            el.style.left = `${item.x}px`;
            el.style.top = `${item.y}px`;
            el.style.width = `${item.w}px`;
            el.style.height = `${item.h}px`;
            
            // Ensure frames are behind other items, but keep order within groups
            const baseZ = item.type === "frame" ? 100 : 1000;
            el.style.zIndex = (baseZ + index).toString();
            
            // Update item-type specific content
            this.updateItemContent(el, item, isNew);
        });

        this.renderInspector();
    }

    addItemInteractions(el, initialItem) {
        const itemId = initialItem.id;
        
        // Crop glyph
        if (initialItem.type === "image") {
            const cropGlyph = document.createElement("div");
            cropGlyph.className = "storyboard-crop-glyph";
            cropGlyph.innerHTML = "✂️";
            cropGlyph.title = "Edit Crop";
            cropGlyph.onclick = (e) => {
                e.stopPropagation();
                const item = this.boardData.items.find(i => i.id === itemId);
                if (!item) return;
                
                el.classList.toggle("cropping");
                cropGlyph.classList.toggle("active");
                
                if (el.classList.contains("cropping")) {
                    this.isInteracting = true;
                    this.renderCropUI(el, item);
                } else {
                    this.isInteracting = false;
                    this.saveBoard();
                    this.renderBoard();
                }
            };
            el.appendChild(cropGlyph);
        }

        // Resize handle
        const resizeHandle = document.createElement("div");
        resizeHandle.className = "storyboard-resize-handle";
        resizeHandle.onmousedown = (e) => {
            const item = this.boardData.items.find(i => i.id === itemId);
            if (!item) return;
            
            e.stopPropagation();
            e.preventDefault();
            this.isInteracting = true;
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = item.w;
            const startH = item.h;

            const onMouseMove = (moveEvent) => {
                const dw = (moveEvent.clientX - startX) / this.scale;
                const dh = (moveEvent.clientY - startY) / this.scale;
                
                if (moveEvent.shiftKey) {
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
                
                // If it's a note, we might want to update font size live
                if (item.type === "note") {
                    this.updateItemContent(el, item, false);
                }
            };

            const onMouseUp = () => {
                this.isInteracting = false;
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
                
                if (this.needsReload) {
                    this.loadBoard();
                } else {
                    this.saveBoard();
                    this.renderBoard();
                    
                    // Force update palettes after drag/resize finishes
                    this.boardData.items.forEach(it => {
                        if (it.type === "frame") {
                            const el = this.itemElements.get(it.id);
                            if (el) this.updateFramePalette(el, it);
                        }
                    });
                }
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        };
        el.appendChild(resizeHandle);
        
        el.onmousedown = (e) => {
            const item = this.boardData.items.find(i => i.id === itemId);
            if (!item) return;

            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            this.isInteracting = true;
            
            // Selection logic
            if (e.shiftKey) {
                if (this.boardData.selection.includes(itemId)) {
                    this.boardData.selection = this.boardData.selection.filter(id => id !== itemId);
                } else {
                    this.boardData.selection.push(itemId);
                }
            } else {
                // Single select
                this.boardData.selection = [itemId];
            }
            this.renderBoard();

            const startX = e.clientX;
            const startY = e.clientY;
            
            const itemsToMoveIds = new Set(this.boardData.selection);
            this.boardData.selection.forEach(id => {
                const it = this.boardData.items.find(i => i.id === id);
                if (it && it.type === "frame") {
                    this.boardData.items.forEach(other => {
                        if (other.id !== it.id &&
                            other.x >= it.x && other.y >= it.y &&
                            (other.x + other.w) <= (it.x + it.w) &&
                            (other.y + other.h) <= (it.y + it.h)) {
                            itemsToMoveIds.add(other.id);
                        }
                    });
                }
            });

            const selectedElements = Array.from(itemsToMoveIds).map(id => {
                const it = this.boardData.items.find(i => i.id === id);
                const domEl = this.itemElements.get(id);
                return { item: it, domEl, startX: it.x, startY: it.y };
            }).filter(entry => entry.domEl && entry.item);

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
                this.isInteracting = false;
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
                
                if (this.needsReload) {
                    this.loadBoard();
                } else {
                    this.saveBoard();
                    this.renderBoard();

                    // Force update palettes after drag/resize finishes
                    this.boardData.items.forEach(it => {
                        if (it.type === "frame") {
                            const el = this.itemElements.get(it.id);
                            if (el) this.updateFramePalette(el, it);
                        }
                    });
                }
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        };
    }

    renderCropUI(el, item) {
        let overlay = el.querySelector(".storyboard-crop-overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.className = "storyboard-crop-overlay";
            overlay.innerHTML = `
                <div class="storyboard-crop-box">
                    <div class="storyboard-crop-handle crop-handle-nw"></div>
                    <div class="storyboard-crop-handle crop-handle-ne"></div>
                    <div class="storyboard-crop-handle crop-handle-sw"></div>
                    <div class="storyboard-crop-handle crop-handle-se"></div>
                    <div class="storyboard-crop-handle crop-handle-top"></div>
                    <div class="storyboard-crop-handle crop-handle-bottom"></div>
                    <div class="storyboard-crop-handle crop-handle-left"></div>
                    <div class="storyboard-crop-handle crop-handle-right"></div>
                </div>
            `;
            el.appendChild(overlay);
        }

        const cropBox = overlay.querySelector(".storyboard-crop-box");
        const crop = item.crop || { x: 0, y: 0, w: 1, h: 1 };
        
        const updateBox = () => {
            cropBox.style.left = `${crop.x * 100}%`;
            cropBox.style.top = `${crop.y * 100}%`;
            cropBox.style.width = `${crop.w * 100}%`;
            cropBox.style.height = `${crop.h * 100}%`;
            item.crop = { ...crop };
            
            // Preview the crop in real-time
            const img = el.querySelector("img");
            if (img) {
                const scaleX = 1 / Math.max(0.01, crop.w);
                const scaleY = 1 / Math.max(0.01, crop.h);
                img.style.width = `${scaleX * 100}%`;
                img.style.height = `${scaleY * 100}%`;
                img.style.left = `${-crop.x * scaleX * 100}%`;
                img.style.top = `${-crop.y * scaleY * 100}%`;
                img.style.objectFit = "fill"; // Temporary for preview
            }
        };

        updateBox();

        // Drag to move the entire crop box
        cropBox.onmousedown = (e) => {
            if (e.target !== cropBox) return;
            e.stopPropagation();
            const rect = overlay.getBoundingClientRect();
            const startX = e.clientX;
            const startY = e.clientY;
            const initialX = crop.x;
            const initialY = crop.y;

            const onMouseMove = (moveEvent) => {
                const dx = (moveEvent.clientX - startX) / rect.width;
                const dy = (moveEvent.clientY - startY) / rect.height;
                
                crop.x = Math.max(0, Math.min(1 - crop.w, initialX + dx));
                crop.y = Math.max(0, Math.min(1 - crop.h, initialY + dy));
                updateBox();
            };

            const onMouseUp = () => {
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        };

        overlay.onmousedown = (e) => {
            if (e.target !== overlay) return;
            e.stopPropagation();
            const rect = overlay.getBoundingClientRect();
            const startX = (e.clientX - rect.left) / rect.width;
            const startY = (e.clientY - rect.top) / rect.height;
            
            crop.x = startX;
            crop.y = startY;
            crop.w = 0;
            crop.h = 0;

            const onMouseMove = (moveEvent) => {
                const currentX = (moveEvent.clientX - rect.left) / rect.width;
                const currentY = (moveEvent.clientY - rect.top) / rect.height;
                
                crop.w = Math.max(0.01, Math.min(1 - crop.x, currentX - crop.x));
                crop.h = Math.max(0.01, Math.min(1 - crop.y, currentY - crop.y));
                updateBox();
            };

            const onMouseUp = () => {
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        };

        overlay.querySelectorAll(".storyboard-crop-handle").forEach(handle => {
            handle.onmousedown = (e) => {
                e.stopPropagation();
                const rect = overlay.getBoundingClientRect();
                
                const isWest = handle.classList.contains("crop-handle-nw") || handle.classList.contains("crop-handle-sw") || handle.classList.contains("crop-handle-left");
                const isEast = handle.classList.contains("crop-handle-ne") || handle.classList.contains("crop-handle-se") || handle.classList.contains("crop-handle-right");
                const isNorth = handle.classList.contains("crop-handle-nw") || handle.classList.contains("crop-handle-ne") || handle.classList.contains("crop-handle-top");
                const isSouth = handle.classList.contains("crop-handle-sw") || handle.classList.contains("crop-handle-se") || handle.classList.contains("crop-handle-bottom");

                const onMouseMove = (moveEvent) => {
                    const currentX = (moveEvent.clientX - rect.left) / rect.width;
                    const currentY = (moveEvent.clientY - rect.top) / rect.height;

                    if (isWest) {
                        const right = crop.x + crop.w;
                        crop.x = Math.max(0, Math.min(right - 0.01, currentX));
                        crop.w = right - crop.x;
                    } else if (isEast) {
                        crop.w = Math.max(0.01, Math.min(1 - crop.x, currentX - crop.x));
                    }

                    if (isNorth) {
                        const bottom = crop.y + crop.h;
                        crop.y = Math.max(0, Math.min(bottom - 0.01, currentY));
                        crop.h = bottom - crop.y;
                    } else if (isSouth) {
                        crop.h = Math.max(0.01, Math.min(1 - crop.y, currentY - crop.y));
                    }
                    updateBox();
                };

                const onMouseUp = () => {
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("mouseup", onMouseUp);
                };

                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
            };
        });
    }

    handleCopy() {
        if (this.boardData.selection.length > 0) {
            this.internalClipboard = this.boardData.selection.map(id => {
                const item = this.boardData.items.find(i => i.id === id);
                return { ...item };
            }).filter(Boolean);
        }
    }

    handlePaste() {
        if (this.internalClipboard.length > 0) {
            const newSelection = [];
            this.internalClipboard.forEach(item => {
                const newItem = {
                    ...item,
                    id: this.generateUUID(),
                    x: item.x + 20,
                    y: item.y + 20
                };
                this.boardData.items.push(newItem);
                newSelection.push(newItem.id);
            });
            this.boardData.selection = newSelection;
            this.renderBoard();
            this.saveBoard();
        }
    }

    async handlePasteImage(file) {
        const formData = new FormData();
        formData.append("image", file);
        
        try {
            const response = await fetch(`/mkr/storyboard/${this.boardId}/upload`, {
                method: "POST",
                body: formData
            });
            const { filename } = await response.json();
            
            if (filename) {
                // Find a good place to paste (e.g. center of viewport)
                const viewport = this.canvasContainer.getBoundingClientRect();
                const centerX = (viewport.width / 2 - this.offset.x) / this.scale;
                const centerY = (viewport.height / 2 - this.offset.y) / this.scale;
                
                const newItem = {
                    id: this.generateUUID(),
                    type: "image",
                    x: centerX - 256,
                    y: centerY - 256,
                    w: 512,
                    h: 512,
                    image_ref: filename,
                    label: "Pasted Image"
                };
                this.boardData.items.push(newItem);
                this.boardData.selection = [newItem.id];
                this.renderBoard();
                this.saveBoard();
            }
        } catch (err) {
            console.error("Failed to upload pasted image:", err);
        }
    }

    updateItemContent(el, item, isNew) {
        // Reference Pill
        let pill = el.querySelector(".storyboard-ref-pill");
        if (item.ref_id) {
            if (!pill) {
                pill = document.createElement("div");
                pill.className = "storyboard-ref-pill";
                el.appendChild(pill);
            }
            pill.innerText = `REF ${item.ref_id}`;
        } else if (pill) {
            pill.remove();
        }

        if (item.type === "image") {
            el.classList.add("image-item");
            let wrapper = el.querySelector(".image-wrapper");
            if (!wrapper) {
                wrapper = document.createElement("div");
                wrapper.className = "image-wrapper";
                el.appendChild(wrapper);
            }
            
            let img = wrapper.querySelector("img");
            if (!img) {
                img = document.createElement("img");
                img.draggable = false;
                wrapper.appendChild(img);
            }
            // Use item.image_ref directly as cache key, don't force-reload with timestamp every render
            const src = `/mkr/storyboard/asset/${this.boardId}/${item.image_ref}`;
            if (img.getAttribute("data-src") !== src) {
                img.src = src + `?t=${Date.now()}`;
                img.setAttribute("data-src", src);
            }

            // Apply crop to display
            if (item.crop) {
                const { x, y, w, h } = item.crop;
                
                // Uniform scale to prevent stretching
                // We use the larger scale to ensure the crop area COVERS the slot
                const scaleX = 1 / Math.max(0.01, w);
                const scaleY = 1 / Math.max(0.01, h);
                const uniformScale = Math.max(scaleX, scaleY);
                
                img.style.width = `${uniformScale * 100}%`;
                img.style.height = `${uniformScale * 100}%`;
                
                // Center the crop area within the slot
                // We calculate the offset based on the uniform scale
                const offsetX = -x * uniformScale * 100;
                const offsetY = -y * uniformScale * 100;
                
                // Adjust to center if the aspect ratios don't match
                const extraX = (uniformScale - scaleX) * 50;
                const extraY = (uniformScale - scaleY) * 50;
                
                img.style.left = `${offsetX + extraX}%`;
                img.style.top = `${offsetY + extraY}%`;
                img.style.objectFit = "fill"; // Uniform scale prevents stretching
            } else {
                img.style.width = "100%";
                img.style.height = "100%";
                img.style.left = "0";
                img.style.top = "0";
                img.style.objectFit = "cover";
            }
            
        } else if (item.type === "slot") {
            el.classList.add("slot-item");
            let label = el.querySelector(".slot-label");
            if (!label) {
                label = document.createElement("div");
                label.className = "slot-label";
                el.appendChild(label);
            }
            label.innerText = item.label || "Empty Slot";
            
        } else if (item.type === "note") {
            el.classList.add("note-item");
            const bgColor = item.color || "#ffeb3b";
            el.style.backgroundColor = bgColor;
            el.style.color = this.getContrastColor(bgColor);
            
            let content = el.querySelector(".note-content");
            if (!content) {
                content = document.createElement("div");
                content.className = "note-content";
                el.appendChild(content);
            }
            content.innerText = item.content || "";
            
            const textLength = (item.content || "").length;
            const area = item.w * item.h;
            let fontSize = Math.sqrt(area / (textLength || 1)) * 0.8;
            fontSize = Math.max(12, Math.min(fontSize, item.h * 0.5));
            content.style.fontSize = `${fontSize}px`;
            
        } else if (item.type === "frame") {
            el.classList.add("frame-item");
            const frameColor = item.color || "#4CAF50";
            el.style.borderColor = frameColor;
            let label = el.querySelector(".frame-label");
            if (!label) {
                label = document.createElement("div");
                label.className = "frame-label";
                el.appendChild(label);
            }
            label.innerText = item.label || "";
            label.style.backgroundColor = frameColor;
            label.style.color = this.getContrastColor(frameColor);

            // Update palette bar
            this.updateFramePalette(el, item);
        }
    }

    async updateFramePalette(el, item) {
        let paletteBar = el.querySelector(".frame-palette-bar");
        if (!paletteBar) {
            paletteBar = document.createElement("div");
            paletteBar.className = "frame-palette-bar";
            el.appendChild(paletteBar);
        }

        // Use a small timeout to ensure boardData is updated if this was called from a move
        const imagesInFrame = this.boardData.items
            .filter(it => it.type === "image" && it.image_ref &&
                (it.x + it.w / 2) >= item.x && (it.y + it.h / 2) >= item.y &&
                (it.x + it.w / 2) <= (item.x + item.w) &&
                (it.y + it.h / 2) <= (item.y + item.h));
        
        const containedImageIds = imagesInFrame
            .map(it => `${it.id}_${it.image_ref}_${JSON.stringify(it.crop || {})}`)
            .sort()
            .join(",");

        const cacheKey = `${item.id}_${containedImageIds}`;
        const cached = this.paletteCache.get(item.id);

        if (cached && cached.key === cacheKey) {
            this.renderPaletteColors(paletteBar, cached.colors);
            paletteBar.style.display = "flex";
            return;
        }

        if (this.paletteLoading.has(item.id)) return;

        if (imagesInFrame.length === 0) {
            paletteBar.style.display = "none";
            this.paletteCache.delete(item.id);
            return;
        }

        paletteBar.style.display = "flex";
        this.paletteLoading.add(item.id);
        try {
            const response = await fetch(`/mkr/storyboard/${this.boardId}/palette/${item.id}`);
            const { colors } = await response.json();
            if (colors && colors.length > 0) {
                this.paletteCache.set(item.id, { key: cacheKey, colors });
                this.renderPaletteColors(paletteBar, colors);
            } else {
                paletteBar.style.display = "none";
            }
        } catch (err) {
            console.error("Failed to fetch palette:", err);
            paletteBar.style.display = "none";
        } finally {
            this.paletteLoading.delete(item.id);
        }
    }

    renderPaletteColors(bar, colors) {
        bar.innerHTML = "";
        colors.forEach(c => {
            const dot = document.createElement("div");
            dot.className = "palette-color";
            dot.style.backgroundColor = c;
            dot.style.color = this.getContrastColor(c);
            
            const span = document.createElement("span");
            span.innerText = c.toUpperCase();
            dot.appendChild(span);
            
            dot.title = `Click to copy: ${c}`;
            dot.onclick = (e) => {
                e.stopPropagation();
                
                // Robust copy to clipboard
                const text = c.toUpperCase();
                console.log("Attempting to copy color:", text);
                
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => {
                        console.log("Clipboard API success");
                        this.showCopyFeedback(dot);
                    }).catch(err => {
                        console.error("Clipboard API failed, trying fallback", err);
                        this.fallbackCopyText(text);
                        this.showCopyFeedback(dot);
                    });
                } else {
                    console.log("Clipboard API not available, using fallback");
                    this.fallbackCopyText(text);
                    this.showCopyFeedback(dot);
                }
            };
            bar.appendChild(dot);
        });
    }

    showCopyFeedback(el) {
        const originalTransform = el.style.transform;
        el.style.transform = "scale(1.2)";
        setTimeout(() => el.style.transform = originalTransform, 200);
    }

    fallbackCopyText(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        // Ensure it's not visible but part of DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            console.log('Copying text command was ' + (successful ? 'successful' : 'unsuccessful'));
        } catch (err) {
            console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
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

        const presets = [
            "#4CAF50", "#2196F3", "#f44336", "#ffeb3b",
            "#9c27b0", "#ff9800", "#795548", "#607d8b"
        ];

        const createColorPicker = (currentColor) => {
            let html = `
                <div class="inspector-field">
                    <label>Color</label>
                    <input type="color" id="inspector-color" value="${currentColor}">
                    <div class="color-presets">
            `;
            presets.forEach(p => {
                const isActive = p.toLowerCase() === currentColor.toLowerCase();
                html += `<div class="color-dot ${isActive ? 'active' : ''}" style="background-color: ${p}" data-color="${p}"></div>`;
            });
            html += `
                    </div>
                </div>
            `;
            return html;
        };

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
                ${createColorPicker(item.color || "#4CAF50")}
            `;
        } else if (item.type === "note") {
            fields += `
                <div class="inspector-field">
                    <label>Content</label>
                    <textarea id="inspector-content-text" rows="5">${item.content || ""}</textarea>
                </div>
                ${createColorPicker(item.color || "#ffeb3b")}
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
        } else if (item.type === "note") {
            document.getElementById("inspector-content-text").onchange = (e) => {
                item.content = e.target.value;
                this.renderBoard();
                this.saveBoard();
            };
        }

        // Color handling for both frame and note
        if (item.type === "frame" || item.type === "note") {
            const colorInput = document.getElementById("inspector-color");
            const updateColor = (newColor) => {
                item.color = newColor;
                this.renderBoard();
                this.saveBoard();
                // Update dots active state
                document.querySelectorAll(".color-dot").forEach(dot => {
                    dot.classList.toggle("active", dot.dataset.color.toLowerCase() === newColor.toLowerCase());
                });
            };

            if (colorInput) {
                colorInput.onchange = (e) => updateColor(e.target.value);
            }

            document.querySelectorAll(".color-dot").forEach(dot => {
                dot.onclick = () => {
                    const newColor = dot.dataset.color;
                    if (colorInput) colorInput.value = newColor;
                    updateColor(newColor);
                };
            });
        }
    }

    setupInteractions() {
        // Simple pan and zoom logic
        let isPanning = false;
        let startPos = { x: 0, y: 0 };

        // Global click listener to close context menu
        window.addEventListener("click", (e) => {
            if (this.contextMenu && !this.contextMenu.contains(e.target)) {
                this.contextMenu.style.display = "none";
            }
        });

        this.canvasContainer.onmousedown = (e) => {
            // Deselect if clicking the canvas directly
            if (e.target === this.canvas || e.target === this.canvasContainer) {
                this.boardData.selection = [];
                this.renderBoard();
                this.saveBoard();
            }

            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                isPanning = true;
                this.isInteracting = true;
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
            this.isInteracting = false;
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
        this.contextMenu.innerHTML = "";

        const createButton = (label, action, className = "") => {
            const btn = document.createElement("button");
            btn.innerText = label;
            if (className) btn.className = className;
            btn.onclick = () => {
                action();
                this.contextMenu.style.display = "none";
            };
            return btn;
        };

        const createSeparator = () => {
            const sep = document.createElement("div");
            sep.className = "menu-separator";
            return sep;
        };

        const createHeader = (text) => {
            const head = document.createElement("div");
            head.className = "menu-header";
            head.innerText = text;
            return head;
        };

        if (this.boardData.selection.length > 0) {
            this.contextMenu.appendChild(createButton("Bring to Front", () => document.getElementById("action-front")?.click()));
            this.contextMenu.appendChild(createButton("Send to Back", () => document.getElementById("action-back")?.click()));
            
            if (this.boardData.selection.length === 1) {
                const item = this.boardData.items.find(i => i.id === this.boardData.selection[0]);
                if (item.type === "image" || item.type === "frame") {
                    this.contextMenu.appendChild(createSeparator());
                    this.contextMenu.appendChild(createHeader("Set as Reference"));
                    
                    const grid = document.createElement("div");
                    grid.className = "ref-grid";
                    for (let i = 1; i <= 8; i++) {
                        const dot = document.createElement("div");
                        dot.className = `ref-dot ${item.ref_id === i ? 'active' : ''}`;
                        dot.innerText = i;
                        dot.onclick = (e) => {
                            e.stopPropagation();
                            // Clear this ref from any other item first
                            this.boardData.items.forEach(it => {
                                if (it.ref_id === i) delete it.ref_id;
                            });
                            item.ref_id = i;
                            this.renderBoard();
                            this.saveBoard();
                            this.contextMenu.style.display = "none";
                        };
                        grid.appendChild(dot);
                    }
                    this.contextMenu.appendChild(grid);

                    if (item.ref_id) {
                        this.contextMenu.appendChild(createButton("Clear Reference", () => {
                            delete item.ref_id;
                            this.renderBoard();
                            this.saveBoard();
                        }));
                    }
                }
            }

            this.contextMenu.appendChild(createSeparator());
            this.contextMenu.appendChild(createButton("Delete", () => {
                if (this.boardData.selection.length === 1) document.getElementById("action-delete")?.click();
                else document.getElementById("action-delete-selected")?.click();
            }, "danger"));
        } else {
            this.contextMenu.appendChild(createButton("Add Slot", () => document.getElementById("storyboard-add-slot")?.click()));
            this.contextMenu.appendChild(createButton("Add Note", () => document.getElementById("storyboard-add-note")?.click()));
            this.contextMenu.appendChild(createButton("Add Frame", () => document.getElementById("storyboard-add-frame")?.click()));
        }

        // Viewport constraint
        const rect = this.contextMenu.getBoundingClientRect();
        let left = x;
        let top = y;

        if (left + rect.width > window.innerWidth) {
            left = x - rect.width;
        }
        if (top + rect.height > window.innerHeight) {
            top = y - rect.height;
        }

        this.contextMenu.style.left = `${left}px`;
        this.contextMenu.style.top = `${top}px`;
    }

    updateTransform() {
        this.canvas.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
    }
}

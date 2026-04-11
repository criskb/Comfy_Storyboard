import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const VFX_TASKS = ["Cleanup", "Comp", "Screen Replace", "Extension", "Paintout"];

export const vfxNoteStoryboardExtension = {
    id: "custom.vfx-note",
    type: "vfx_note",
    title: "VFX Note",
    canvasClass: "vfx-note-item",
    toolbar: {
        buttonId: "storyboard-add-vfx-note",
        label: "VFX Note",
        title: "Add VFX Note",
        iconKey: "vfxNote",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 920, 220);
        return {
            id: `vfx_note_${workspace.generateUUID()}`,
            type: "vfx_note",
            x: position.x,
            y: position.y,
            w: 292,
            h: 170,
            label: "Remove rooftop safety wire",
            vfx_task: "Cleanup",
            plate_status: "Plate locked, track marker hidden in shadow",
            content: "Keep the skyline honest. Cleanup should disappear before the eye gets there.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("vfx-note-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".vfx-note-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "vfx-note-body";
            body.innerHTML = `
                <div class="vfx-note-topline">
                    <div class="vfx-note-task"></div>
                    <div class="vfx-note-kicker">VFX</div>
                </div>
                <div class="vfx-note-title"></div>
                <div class="vfx-note-status"></div>
                <div class="vfx-note-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".vfx-note-task").innerText = item.vfx_task || "Cleanup";
        body.querySelector(".vfx-note-title").innerText = (item.label || "VFX Note").trim();

        const status = body.querySelector(".vfx-note-status");
        const statusText = (item.plate_status || "").trim();
        status.innerText = statusText;
        status.style.display = statusText ? "block" : "none";

        const copy = body.querySelector(".vfx-note-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentTask = VFX_TASKS.includes(item.vfx_task) ? item.vfx_task : VFX_TASKS[0];
        const options = VFX_TASKS.map((task) => (
            `<option value="${task}" ${task === currentTask ? "selected" : ""}>${task}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Task</label>
                <input type="text" id="inspector-vfx-note-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Category</label>
                <select id="inspector-vfx-note-task">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Plate Status</label>
                <input type="text" id="inspector-vfx-note-status" value="${escapeHtml(item.plate_status || "")}">
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-vfx-note-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-vfx-note-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-vfx-note-label", (value) => {
            item.label = value;
        });
        bindField("inspector-vfx-note-task", (value) => {
            item.vfx_task = value || VFX_TASKS[0];
        });
        bindField("inspector-vfx-note-status", (value) => {
            item.plate_status = value;
        });
        bindField("inspector-vfx-note-content", (value) => {
            item.content = value;
        });
        bindField("inspector-vfx-note-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

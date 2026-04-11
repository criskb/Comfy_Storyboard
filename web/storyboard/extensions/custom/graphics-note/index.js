import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const GRAPHIC_TYPES = ["Screen Insert", "Lower Third", "Title Card", "Interface Pass", "Overlay Cue"];

export const graphicsNoteStoryboardExtension = {
    id: "custom.graphics-note",
    type: "graphics_note",
    title: "Graphics Note",
    canvasClass: "graphics-note-item",
    toolbar: {
        buttonId: "storyboard-add-graphics-note",
        label: "Graphics Note",
        title: "Add Graphics Note",
        iconKey: "graphicsNote",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 1160, 340);
        return {
            id: `graphics_note_${workspace.generateUUID()}`,
            type: "graphics_note",
            x: position.x,
            y: position.y,
            w: 384,
            h: 164,
            label: "Phone UI needs storm warning banner",
            graphic_type: "Screen Insert",
            placement: "Upper third, slight lens warp, brightness below face key",
            content: "The graphic should support urgency without becoming the brightest point in frame.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("graphics-note-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".graphics-note-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "graphics-note-body";
            body.innerHTML = `
                <div class="graphics-note-topline">
                    <div class="graphics-note-type"></div>
                    <div class="graphics-note-kicker">Graphics</div>
                </div>
                <div class="graphics-note-title"></div>
                <div class="graphics-note-placement"></div>
                <div class="graphics-note-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".graphics-note-type").innerText = item.graphic_type || "Screen Insert";
        body.querySelector(".graphics-note-title").innerText = (item.label || "Graphics Note").trim();

        const placement = body.querySelector(".graphics-note-placement");
        const placementText = (item.placement || "").trim();
        placement.innerText = placementText;
        placement.style.display = placementText ? "block" : "none";

        const copy = body.querySelector(".graphics-note-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentType = GRAPHIC_TYPES.includes(item.graphic_type) ? item.graphic_type : GRAPHIC_TYPES[0];
        const options = GRAPHIC_TYPES.map((type) => (
            `<option value="${type}" ${type === currentType ? "selected" : ""}>${type}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Graphic Beat</label>
                <input type="text" id="inspector-graphics-note-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Type</label>
                <select id="inspector-graphics-note-type">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Placement / Treatment</label>
                <textarea id="inspector-graphics-note-placement" rows="3">${escapeHtml(item.placement || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-graphics-note-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-graphics-note-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-graphics-note-label", (value) => {
            item.label = value;
        });
        bindField("inspector-graphics-note-type", (value) => {
            item.graphic_type = value || GRAPHIC_TYPES[0];
        });
        bindField("inspector-graphics-note-placement", (value) => {
            item.placement = value;
        });
        bindField("inspector-graphics-note-content", (value) => {
            item.content = value;
        });
        bindField("inspector-graphics-note-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const CONTINUITY_TYPES = ["Prop Match", "Eyeline", "Hand Position", "Wardrobe Match", "Set Match"];

export const continuityNoteStoryboardExtension = {
    id: "custom.continuity-note",
    type: "continuity_note",
    title: "Continuity Note",
    canvasClass: "continuity-note-item",
    toolbar: {
        buttonId: "storyboard-add-continuity-note",
        label: "Continuity Note",
        title: "Add Continuity Note",
        iconKey: "continuityNote",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 700, 260);
        return {
            id: `continuity_note_${workspace.generateUUID()}`,
            type: "continuity_note",
            x: position.x,
            y: position.y,
            w: 286,
            h: 176,
            label: "Left hand stays on railing",
            continuity_type: "Hand Position",
            checkpoint: "Carry across wide, over-shoulder, and insert",
            content: "Match finger spacing before the cut so the gesture lands as one continuous beat.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("continuity-note-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".continuity-note-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "continuity-note-body";
            body.innerHTML = `
                <div class="continuity-note-topline">
                    <div class="continuity-note-type"></div>
                    <div class="continuity-note-kicker">Continuity</div>
                </div>
                <div class="continuity-note-title"></div>
                <div class="continuity-note-checkpoint"></div>
                <div class="continuity-note-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".continuity-note-type").innerText = item.continuity_type || "Prop Match";
        body.querySelector(".continuity-note-title").innerText = (item.label || "Continuity Note").trim();

        const checkpoint = body.querySelector(".continuity-note-checkpoint");
        const checkpointText = (item.checkpoint || "").trim();
        checkpoint.innerText = checkpointText;
        checkpoint.style.display = checkpointText ? "block" : "none";

        const copy = body.querySelector(".continuity-note-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentType = CONTINUITY_TYPES.includes(item.continuity_type) ? item.continuity_type : CONTINUITY_TYPES[0];
        const options = CONTINUITY_TYPES.map((type) => (
            `<option value="${type}" ${type === currentType ? "selected" : ""}>${type}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Note</label>
                <input type="text" id="inspector-continuity-note-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Type</label>
                <select id="inspector-continuity-note-type">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Checkpoint</label>
                <input type="text" id="inspector-continuity-note-checkpoint" value="${escapeHtml(item.checkpoint || "")}">
            </div>
            <div class="inspector-field">
                <label>Details</label>
                <textarea id="inspector-continuity-note-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-continuity-note-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-continuity-note-label", (value) => {
            item.label = value;
        });
        bindField("inspector-continuity-note-type", (value) => {
            item.continuity_type = value || CONTINUITY_TYPES[0];
        });
        bindField("inspector-continuity-note-checkpoint", (value) => {
            item.checkpoint = value;
        });
        bindField("inspector-continuity-note-content", (value) => {
            item.content = value;
        });
        bindField("inspector-continuity-note-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

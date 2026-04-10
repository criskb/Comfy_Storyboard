import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getViewportPlacement,
} from "../utils.js";

const SHOT_TYPES = ["Wide", "Medium", "Close-Up", "Insert", "POV", "Detail"];

export const shotCardStoryboardExtension = {
    id: "custom.shot-card",
    type: "shot_card",
    title: "Shot Card",
    canvasClass: "shot-card-item",
    toolbar: {
        buttonId: "storyboard-add-shot-card",
        label: "Shot Card",
        title: "Add Shot Card",
        iconKey: "shotCard",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 260, 170);
        return {
            id: `shot_card_${workspace.generateUUID()}`,
            type: "shot_card",
            x: position.x,
            y: position.y,
            w: 272,
            h: 176,
            label: "Opening Reveal",
            shot_type: "Wide",
            content: "Start on the full environment, then let the subject break the frame.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("shot-card-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".shot-card-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "shot-card-body";
            body.innerHTML = `
                <div class="shot-card-header">
                    <div class="shot-card-type"></div>
                    <div class="shot-card-index">Shot</div>
                </div>
                <div class="shot-card-title"></div>
                <div class="shot-card-note"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".shot-card-type").innerText = item.shot_type || "Wide";
        body.querySelector(".shot-card-title").innerText = (item.label || "Shot Card").trim();
        const note = body.querySelector(".shot-card-note");
        const noteText = (item.content || "").trim();
        note.innerText = noteText;
        note.style.display = noteText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentType = SHOT_TYPES.includes(item.shot_type) ? item.shot_type : SHOT_TYPES[0];
        const options = SHOT_TYPES.map((type) => (
            `<option value="${type}" ${type === currentType ? "selected" : ""}>${type}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Title</label>
                <input type="text" id="inspector-shot-card-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Shot Type</label>
                <select id="inspector-shot-card-type">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Description</label>
                <textarea id="inspector-shot-card-content" rows="5">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-shot-card-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);

        bindField("inspector-shot-card-label", (value) => {
            item.label = value;
        });
        bindField("inspector-shot-card-type", (value) => {
            item.shot_type = value || SHOT_TYPES[0];
        });
        bindField("inspector-shot-card-content", (value) => {
            item.content = value;
        });
        bindField("inspector-shot-card-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

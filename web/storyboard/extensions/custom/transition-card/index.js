import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const TRANSITION_TYPES = ["Cut", "Match Cut", "Smash Cut", "Dissolve", "Wipe"];

export const transitionCardStoryboardExtension = {
    id: "custom.transition-card",
    type: "transition_card",
    title: "Transition Card",
    canvasClass: "transition-card-item",
    toolbar: {
        buttonId: "storyboard-add-transition-card",
        label: "Transition Card",
        title: "Add Transition Card",
        iconKey: "transitionCard",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 980, 420);
        return {
            id: `transition_card_${workspace.generateUUID()}`,
            type: "transition_card",
            x: position.x,
            y: position.y,
            w: 238,
            h: 116,
            label: "Hand closes to door latch",
            transition_type: "Match Cut",
            content: "Use shape continuity so the edit feels inevitable, not flashy.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("transition-card-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".transition-card-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "transition-card-body";
            body.innerHTML = `
                <div class="transition-card-type"></div>
                <div class="transition-card-arrow"></div>
                <div class="transition-card-title"></div>
                <div class="transition-card-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".transition-card-type").innerText = item.transition_type || "Cut";
        body.querySelector(".transition-card-title").innerText = (item.label || "Transition Card").trim();
        const copy = body.querySelector(".transition-card-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentType = TRANSITION_TYPES.includes(item.transition_type) ? item.transition_type : TRANSITION_TYPES[0];
        const options = TRANSITION_TYPES.map((type) => (
            `<option value="${type}" ${type === currentType ? "selected" : ""}>${type}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Transition Cue</label>
                <input type="text" id="inspector-transition-card-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Transition Type</label>
                <select id="inspector-transition-card-type">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Note</label>
                <textarea id="inspector-transition-card-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-transition-card-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-transition-card-label", (value) => {
            item.label = value;
        });
        bindField("inspector-transition-card-type", (value) => {
            item.transition_type = value || TRANSITION_TYPES[0];
        });
        bindField("inspector-transition-card-content", (value) => {
            item.content = value;
        });
        bindField("inspector-transition-card-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const PROP_STATES = ["Hero Prop", "Texture", "Set Dressing", "Symbol", "Hand Detail"];

export const propCardStoryboardExtension = {
    id: "custom.prop-card",
    type: "prop_card",
    title: "Prop Card",
    canvasClass: "prop-card-item",
    toolbar: {
        buttonId: "storyboard-add-prop-card",
        label: "Prop Card",
        title: "Add Prop Card",
        iconKey: "propCard",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 340, 440);
        return {
            id: `prop_card_${workspace.generateUUID()}`,
            type: "prop_card",
            x: position.x,
            y: position.y,
            w: 252,
            h: 178,
            label: "Silver ring",
            prop_state: "Hero Prop",
            content: "Cold metal, worn edges, catches a clean highlight when the hand turns.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("prop-card-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".prop-card-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "prop-card-body";
            body.innerHTML = `
                <div class="prop-card-topline">
                    <div class="prop-card-kicker">Prop</div>
                    <div class="prop-card-state"></div>
                </div>
                <div class="prop-card-title"></div>
                <div class="prop-card-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".prop-card-state").innerText = item.prop_state || "Hero Prop";
        body.querySelector(".prop-card-title").innerText = (item.label || "Prop Card").trim();
        const copy = body.querySelector(".prop-card-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "block";
    },
    renderInspectorFields({ item }) {
        const currentState = PROP_STATES.includes(item.prop_state) ? item.prop_state : PROP_STATES[0];
        const options = PROP_STATES.map((state) => (
            `<option value="${state}" ${state === currentState ? "selected" : ""}>${state}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Prop</label>
                <input type="text" id="inspector-prop-card-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Category</label>
                <select id="inspector-prop-card-state">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Texture / Use</label>
                <textarea id="inspector-prop-card-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-prop-card-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-prop-card-label", (value) => {
            item.label = value;
        });
        bindField("inspector-prop-card-state", (value) => {
            item.prop_state = value || PROP_STATES[0];
        });
        bindField("inspector-prop-card-content", (value) => {
            item.content = value;
        });
        bindField("inspector-prop-card-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const DELIVERY_MODES = ["Whispered", "Flat", "Measured", "Urgent", "Cracked"];

export const dialogueCardStoryboardExtension = {
    id: "custom.dialogue-card",
    type: "dialogue_card",
    title: "Dialogue Card",
    canvasClass: "dialogue-card-item",
    toolbar: {
        buttonId: "storyboard-add-dialogue-card",
        label: "Dialogue Card",
        title: "Add Dialogue Card",
        iconKey: "dialogueCard",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 520, 240);
        return {
            id: `dialogue_card_${workspace.generateUUID()}`,
            type: "dialogue_card",
            x: position.x,
            y: position.y,
            w: 356,
            h: 158,
            label: "Mara",
            line_text: "If we wait for it to feel safe, we stay here forever.",
            delivery: "Measured",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("dialogue-card-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".dialogue-card-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "dialogue-card-body";
            body.innerHTML = `
                <div class="dialogue-card-topline">
                    <div class="dialogue-card-speaker"></div>
                    <div class="dialogue-card-delivery"></div>
                </div>
                <div class="dialogue-card-quote-mark">“</div>
                <div class="dialogue-card-line"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".dialogue-card-speaker").innerText = (item.label || "Speaker").trim() || "Speaker";
        body.querySelector(".dialogue-card-delivery").innerText = item.delivery || "Measured";
        body.querySelector(".dialogue-card-line").innerText = (item.line_text || "").trim() || "Dialogue line";
    },
    renderInspectorFields({ item }) {
        const currentDelivery = DELIVERY_MODES.includes(item.delivery) ? item.delivery : DELIVERY_MODES[0];
        const options = DELIVERY_MODES.map((delivery) => (
            `<option value="${delivery}" ${delivery === currentDelivery ? "selected" : ""}>${delivery}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Speaker</label>
                <input type="text" id="inspector-dialogue-card-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Line</label>
                <textarea id="inspector-dialogue-card-line" rows="4">${escapeHtml(item.line_text || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Delivery</label>
                <select id="inspector-dialogue-card-delivery">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-dialogue-card-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-dialogue-card-label", (value) => {
            item.label = value;
        });
        bindField("inspector-dialogue-card-line", (value) => {
            item.line_text = value;
        });
        bindField("inspector-dialogue-card-delivery", (value) => {
            item.delivery = value || DELIVERY_MODES[0];
        });
        bindField("inspector-dialogue-card-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

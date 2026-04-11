import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const DRESSING_ZONES = ["Foreground", "Midground", "Hero Wall", "Tabletop", "Back Layer"];

export const setDressingCardStoryboardExtension = {
    id: "custom.set-dressing-card",
    type: "set_dressing_card",
    title: "Set Dressing Card",
    canvasClass: "set-dressing-card-item",
    toolbar: {
        buttonId: "storyboard-add-set-dressing-card",
        label: "Set Dressing",
        title: "Add Set Dressing Card",
        iconKey: "setDressingCard",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 780, 240);
        return {
            id: `set_dressing_card_${workspace.generateUUID()}`,
            type: "set_dressing_card",
            x: position.x,
            y: position.y,
            w: 276,
            h: 186,
            label: "Rooftop utility clutter",
            dressing_zone: "Foreground",
            texture_stack: "Wet tarp, milk crate, rusted chain, old lantern glass",
            content: "Give the foreground one object that catches light and one that swallows it.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("set-dressing-card-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".set-dressing-card-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "set-dressing-card-body";
            body.innerHTML = `
                <div class="set-dressing-card-topline">
                    <div class="set-dressing-card-zone"></div>
                    <div class="set-dressing-card-kicker">Set Dressing</div>
                </div>
                <div class="set-dressing-card-title"></div>
                <div class="set-dressing-card-stack"></div>
                <div class="set-dressing-card-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".set-dressing-card-zone").innerText = item.dressing_zone || "Foreground";
        body.querySelector(".set-dressing-card-title").innerText = (item.label || "Set Dressing Card").trim();

        const stack = body.querySelector(".set-dressing-card-stack");
        const stackText = (item.texture_stack || "").trim();
        stack.innerText = stackText;
        stack.style.display = stackText ? "block" : "none";

        const copy = body.querySelector(".set-dressing-card-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentZone = DRESSING_ZONES.includes(item.dressing_zone) ? item.dressing_zone : DRESSING_ZONES[0];
        const options = DRESSING_ZONES.map((zone) => (
            `<option value="${zone}" ${zone === currentZone ? "selected" : ""}>${zone}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Area</label>
                <input type="text" id="inspector-set-dressing-card-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Zone</label>
                <select id="inspector-set-dressing-card-zone">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Texture Stack</label>
                <textarea id="inspector-set-dressing-card-stack" rows="3">${escapeHtml(item.texture_stack || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-set-dressing-card-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-set-dressing-card-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-set-dressing-card-label", (value) => {
            item.label = value;
        });
        bindField("inspector-set-dressing-card-zone", (value) => {
            item.dressing_zone = value || DRESSING_ZONES[0];
        });
        bindField("inspector-set-dressing-card-stack", (value) => {
            item.texture_stack = value;
        });
        bindField("inspector-set-dressing-card-content", (value) => {
            item.content = value;
        });
        bindField("inspector-set-dressing-card-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

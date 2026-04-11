import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const WARDROBE_PRIORITIES = ["Hero", "Support", "Background", "Alt Look", "Weathered"];

export const wardrobeCardStoryboardExtension = {
    id: "custom.wardrobe-card",
    type: "wardrobe_card",
    title: "Wardrobe Card",
    canvasClass: "wardrobe-card-item",
    toolbar: {
        buttonId: "storyboard-add-wardrobe-card",
        label: "Wardrobe Card",
        title: "Add Wardrobe Card",
        iconKey: "wardrobeCard",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 520, 240);
        return {
            id: `wardrobe_card_${workspace.generateUUID()}`,
            type: "wardrobe_card",
            x: position.x,
            y: position.y,
            w: 274,
            h: 188,
            label: "Harbor Coat",
            wardrobe_priority: "Hero",
            silhouette: "Long coat, sharp shoulder, worn hem, hidden inner pocket.",
            palette_note: "Stone, charcoal, salt-faded blue",
            content: "Fabric should hold shape in the wind without looking stiff.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("wardrobe-card-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".wardrobe-card-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "wardrobe-card-body";
            body.innerHTML = `
                <div class="wardrobe-card-topline">
                    <div class="wardrobe-card-kicker">Wardrobe</div>
                    <div class="wardrobe-card-priority"></div>
                </div>
                <div class="wardrobe-card-title"></div>
                <div class="wardrobe-card-silhouette"></div>
                <div class="wardrobe-card-palette"></div>
                <div class="wardrobe-card-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".wardrobe-card-priority").innerText = item.wardrobe_priority || "Hero";
        body.querySelector(".wardrobe-card-title").innerText = (item.label || "Wardrobe Card").trim();

        const silhouette = body.querySelector(".wardrobe-card-silhouette");
        const silhouetteText = (item.silhouette || "").trim();
        silhouette.innerText = silhouetteText;
        silhouette.style.display = silhouetteText ? "block" : "none";

        const palette = body.querySelector(".wardrobe-card-palette");
        const paletteText = (item.palette_note || "").trim();
        palette.innerText = paletteText;
        palette.style.display = paletteText ? "block" : "none";

        const copy = body.querySelector(".wardrobe-card-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentPriority = WARDROBE_PRIORITIES.includes(item.wardrobe_priority) ? item.wardrobe_priority : WARDROBE_PRIORITIES[0];
        const options = WARDROBE_PRIORITIES.map((priority) => (
            `<option value="${priority}" ${priority === currentPriority ? "selected" : ""}>${priority}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Piece</label>
                <input type="text" id="inspector-wardrobe-card-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Priority</label>
                <select id="inspector-wardrobe-card-priority">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Silhouette</label>
                <textarea id="inspector-wardrobe-card-silhouette" rows="3">${escapeHtml(item.silhouette || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Palette / Texture</label>
                <input type="text" id="inspector-wardrobe-card-palette" value="${escapeHtml(item.palette_note || "")}">
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-wardrobe-card-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-wardrobe-card-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-wardrobe-card-label", (value) => {
            item.label = value;
        });
        bindField("inspector-wardrobe-card-priority", (value) => {
            item.wardrobe_priority = value || WARDROBE_PRIORITIES[0];
        });
        bindField("inspector-wardrobe-card-silhouette", (value) => {
            item.silhouette = value;
        });
        bindField("inspector-wardrobe-card-palette", (value) => {
            item.palette_note = value;
        });
        bindField("inspector-wardrobe-card-content", (value) => {
            item.content = value;
        });
        bindField("inspector-wardrobe-card-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

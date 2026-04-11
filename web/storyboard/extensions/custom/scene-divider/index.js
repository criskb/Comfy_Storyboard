import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getViewportPlacement,
} from "../utils.js";

export const sceneDividerStoryboardExtension = {
    id: "custom.scene-divider",
    type: "scene_divider",
    title: "Scene Divider",
    canvasClass: "scene-divider-item",
    toolbar: {
        buttonId: "storyboard-add-scene-divider",
        label: "Scene Divider",
        title: "Add Scene Divider",
        iconKey: "sceneDivider",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 420, 290);
        return {
            id: `scene_divider_${workspace.generateUUID()}`,
            type: "scene_divider",
            x: position.x,
            y: position.y,
            w: 360,
            h: 86,
            label: "Sequence Two",
            content: "Night interiors",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("scene-divider-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".scene-divider-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "scene-divider-body";
            body.innerHTML = `
                <div class="scene-divider-hit-area" aria-hidden="true"></div>
                <div class="scene-divider-line"></div>
                <div class="scene-divider-pill"></div>
                <div class="scene-divider-subtitle"></div>
            `;
            element.appendChild(body);
        }

        const hitArea = body.querySelector(".scene-divider-hit-area");
        if (hitArea) {
            hitArea.onmousedown = (event) => workspace.beginItemDrag(item.id, event);
        }

        body.querySelector(".scene-divider-pill").innerText = (item.label || "Scene Divider").trim();
        const subtitle = body.querySelector(".scene-divider-subtitle");
        const content = (item.content || "").trim();
        subtitle.innerText = content;
        subtitle.style.display = content ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Label</label>
                <input type="text" id="inspector-scene-divider-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Subtitle</label>
                <input type="text" id="inspector-scene-divider-content" value="${escapeHtml(item.content || "")}">
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-scene-divider-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);

        bindField("inspector-scene-divider-label", (value) => {
            item.label = value;
        });
        bindField("inspector-scene-divider-content", (value) => {
            item.content = value;
        });
        bindField("inspector-scene-divider-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

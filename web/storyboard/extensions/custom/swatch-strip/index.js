import {
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    escapeHtml,
    formatColorList,
    getViewportPlacement,
    parseColorList,
} from "../utils.js";

const DEFAULT_SWATCHES = ["#f4efe6", "#cab9a5", "#7a8795", "#1f2937"];

function getSwatches(item) {
    return parseColorList(item?.swatches, DEFAULT_SWATCHES);
}

export const swatchStripStoryboardExtension = {
    id: "custom.swatch-strip",
    type: "swatch_strip",
    title: "Swatch Strip",
    canvasClass: "swatch-strip-item",
    toolbar: {
        buttonId: "storyboard-add-swatch-strip",
        label: "Swatch Strip",
        title: "Add Swatch Strip",
        iconKey: "swatchStrip",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 360, 210);
        return {
            id: `swatch_strip_${workspace.generateUUID()}`,
            type: "swatch_strip",
            x: position.x,
            y: position.y,
            w: 308,
            h: 136,
            label: "Base Palette",
            content: "Stone, canvas, fog, graphite",
            swatches: [...DEFAULT_SWATCHES],
        };
    },
    updateItemContent({ element, item }) {
        element.classList.add("swatch-strip-item");

        let body = element.querySelector(".swatch-strip-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "swatch-strip-body";
            body.innerHTML = `
                <div class="swatch-strip-header"></div>
                <div class="swatch-strip-swatches"></div>
                <div class="swatch-strip-note"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".swatch-strip-header").innerText = (item.label || "Swatch Strip").trim();
        const swatchesEl = body.querySelector(".swatch-strip-swatches");
        swatchesEl.innerHTML = "";
        getSwatches(item).forEach((color) => {
            const swatch = document.createElement("div");
            swatch.className = "swatch-strip-swatch";
            swatch.style.backgroundColor = color;
            swatch.title = color;
            swatchesEl.appendChild(swatch);
        });
        const note = body.querySelector(".swatch-strip-note");
        const content = (item.content || "").trim();
        note.innerText = content;
        note.style.display = content ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Title</label>
                <input type="text" id="inspector-swatch-strip-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Swatches</label>
                <input type="text" id="inspector-swatch-strip-colors" value="${escapeHtml(formatColorList(getSwatches(item)))}" placeholder="#ffffff, #111827">
            </div>
            <div class="inspector-field">
                <label>Note</label>
                <textarea id="inspector-swatch-strip-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);

        bindField("inspector-swatch-strip-label", (value) => {
            item.label = value;
        });
        bindField("inspector-swatch-strip-colors", (value) => {
            item.swatches = parseColorList(value, DEFAULT_SWATCHES);
        });
        bindField("inspector-swatch-strip-content", (value) => {
            item.content = value;
        });
    },
};

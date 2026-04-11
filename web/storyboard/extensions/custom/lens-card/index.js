import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const LENS_FAMILIES = ["Prime", "Zoom", "Anamorphic", "Vintage", "Macro"];

export const lensCardStoryboardExtension = {
    id: "custom.lens-card",
    type: "lens_card",
    title: "Lens Card",
    canvasClass: "lens-card-item",
    toolbar: {
        buttonId: "storyboard-add-lens-card",
        label: "Lens Card",
        title: "Add Lens Card",
        iconKey: "lensCard",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 560, 200);
        return {
            id: `lens_card_${workspace.generateUUID()}`,
            type: "lens_card",
            x: position.x,
            y: position.y,
            w: 274,
            h: 184,
            label: "50mm close tension",
            lens_family: "Prime",
            focal_length: "50mm T2",
            coverage: "Compressed shoulder-up with slight parallax",
            content: "Keep the falloff gentle so the background still breathes.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("lens-card-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".lens-card-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "lens-card-body";
            body.innerHTML = `
                <div class="lens-card-topline">
                    <div class="lens-card-family"></div>
                    <div class="lens-card-kicker">Lens</div>
                </div>
                <div class="lens-card-title"></div>
                <div class="lens-card-focal"></div>
                <div class="lens-card-coverage"></div>
                <div class="lens-card-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".lens-card-family").innerText = item.lens_family || "Prime";
        body.querySelector(".lens-card-title").innerText = (item.label || "Lens Card").trim();

        const focal = body.querySelector(".lens-card-focal");
        const focalText = (item.focal_length || "").trim();
        focal.innerText = focalText;
        focal.style.display = focalText ? "block" : "none";

        const coverage = body.querySelector(".lens-card-coverage");
        const coverageText = (item.coverage || "").trim();
        coverage.innerText = coverageText;
        coverage.style.display = coverageText ? "block" : "none";

        const copy = body.querySelector(".lens-card-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentFamily = LENS_FAMILIES.includes(item.lens_family) ? item.lens_family : LENS_FAMILIES[0];
        const options = LENS_FAMILIES.map((family) => (
            `<option value="${family}" ${family === currentFamily ? "selected" : ""}>${family}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Lens Beat</label>
                <input type="text" id="inspector-lens-card-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Family</label>
                <select id="inspector-lens-card-family">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Focal / Stop</label>
                <input type="text" id="inspector-lens-card-focal" value="${escapeHtml(item.focal_length || "")}">
            </div>
            <div class="inspector-field">
                <label>Coverage</label>
                <textarea id="inspector-lens-card-coverage" rows="3">${escapeHtml(item.coverage || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-lens-card-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-lens-card-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-lens-card-label", (value) => {
            item.label = value;
        });
        bindField("inspector-lens-card-family", (value) => {
            item.lens_family = value || LENS_FAMILIES[0];
        });
        bindField("inspector-lens-card-focal", (value) => {
            item.focal_length = value;
        });
        bindField("inspector-lens-card-coverage", (value) => {
            item.coverage = value;
        });
        bindField("inspector-lens-card-content", (value) => {
            item.content = value;
        });
        bindField("inspector-lens-card-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

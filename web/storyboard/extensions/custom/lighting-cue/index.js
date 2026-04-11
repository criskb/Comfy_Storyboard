import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const LIGHTING_STYLES = ["Soft Key", "Hard Slash", "Practical Glow", "Rim Light", "Silhouette"];

export const lightingCueStoryboardExtension = {
    id: "custom.lighting-cue",
    type: "lighting_cue",
    title: "Lighting Cue",
    canvasClass: "lighting-cue-item",
    toolbar: {
        buttonId: "storyboard-add-lighting-cue",
        label: "Lighting Cue",
        title: "Add Lighting Cue",
        iconKey: "lightingCue",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 620, 180);
        return {
            id: `lighting_cue_${workspace.generateUUID()}`,
            type: "lighting_cue",
            x: position.x,
            y: position.y,
            w: 292,
            h: 170,
            label: "Cool window spill",
            lighting_style: "Soft Key",
            source: "Window left + sodium practical in the distance",
            content: "Keep one cheek in shadow so the face never goes fully comfortable.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("lighting-cue-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".lighting-cue-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "lighting-cue-body";
            body.innerHTML = `
                <div class="lighting-cue-topline">
                    <div class="lighting-cue-style"></div>
                    <div class="lighting-cue-kicker">Lighting</div>
                </div>
                <div class="lighting-cue-title"></div>
                <div class="lighting-cue-source"></div>
                <div class="lighting-cue-note"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".lighting-cue-style").innerText = item.lighting_style || "Soft Key";
        body.querySelector(".lighting-cue-title").innerText = (item.label || "Lighting Cue").trim();
        const source = body.querySelector(".lighting-cue-source");
        const sourceText = (item.source || "").trim();
        source.innerText = sourceText;
        source.style.display = sourceText ? "block" : "none";
        const note = body.querySelector(".lighting-cue-note");
        const noteText = (item.content || "").trim();
        note.innerText = noteText;
        note.style.display = noteText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentStyle = LIGHTING_STYLES.includes(item.lighting_style) ? item.lighting_style : LIGHTING_STYLES[0];
        const options = LIGHTING_STYLES.map((style) => (
            `<option value="${style}" ${style === currentStyle ? "selected" : ""}>${style}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Cue</label>
                <input type="text" id="inspector-lighting-cue-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Lighting Style</label>
                <select id="inspector-lighting-cue-style">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Source</label>
                <input type="text" id="inspector-lighting-cue-source" value="${escapeHtml(item.source || "")}">
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-lighting-cue-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-lighting-cue-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-lighting-cue-label", (value) => {
            item.label = value;
        });
        bindField("inspector-lighting-cue-style", (value) => {
            item.lighting_style = value || LIGHTING_STYLES[0];
        });
        bindField("inspector-lighting-cue-source", (value) => {
            item.source = value;
        });
        bindField("inspector-lighting-cue-content", (value) => {
            item.content = value;
        });
        bindField("inspector-lighting-cue-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

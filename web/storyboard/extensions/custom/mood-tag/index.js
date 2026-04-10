import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getViewportPlacement,
} from "../utils.js";

export const moodTagStoryboardExtension = {
    id: "custom.mood-tag",
    type: "mood_tag",
    title: "Mood Tag",
    canvasClass: "mood-tag-item",
    toolbar: {
        buttonId: "storyboard-add-mood-tag",
        label: "Mood Tag",
        title: "Add Mood Tag",
        iconKey: "moodTag",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 220, 110);
        return {
            id: `mood_tag_${workspace.generateUUID()}`,
            type: "mood_tag",
            x: position.x,
            y: position.y,
            w: 220,
            h: 92,
            label: "Quiet Tension",
            content: "Soft light, restrained palette, held breath.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("mood-tag-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".mood-tag-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "mood-tag-body";
            body.innerHTML = `
                <div class="mood-tag-kicker">Mood</div>
                <div class="mood-tag-label"></div>
                <div class="mood-tag-note"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".mood-tag-label").innerText = (item.label || "Mood Tag").trim();
        const note = body.querySelector(".mood-tag-note");
        const noteText = (item.content || "").trim();
        note.innerText = noteText;
        note.style.display = noteText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Title</label>
                <input type="text" id="inspector-mood-tag-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Note</label>
                <textarea id="inspector-mood-tag-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-mood-tag-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-mood-tag-label", (value) => {
            item.label = value;
        });
        bindField("inspector-mood-tag-content", (value) => {
            item.content = value;
        });
        bindField("inspector-mood-tag-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

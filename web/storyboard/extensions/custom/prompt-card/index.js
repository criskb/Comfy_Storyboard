import {
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

export const promptCardStoryboardExtension = {
    id: "custom.prompt-card",
    type: "prompt_card",
    title: "Prompt Card",
    canvasClass: "prompt-card-item",
    toolbar: {
        buttonId: "storyboard-add-prompt-card",
        label: "Prompt Card",
        title: "Add Prompt Card",
        iconKey: "promptCard",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 560, 280);
        return {
            id: `prompt_card_${workspace.generateUUID()}`,
            type: "prompt_card",
            x: position.x,
            y: position.y,
            w: 340,
            h: 196,
            label: "Storm rooftop prompt",
            prompt_text: "cinematic rooftop at night, wind-torn coat, sodium haze, moody practicals, tense atmosphere",
            content: "Use this to push a curated prompt fragment into the storyboard prompt bar.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("prompt-card-item");
        element.style.setProperty("--storyboard-custom-accent", getAccentColor(item));
        element.style.setProperty("--storyboard-custom-accent-contrast", workspace.getContrastColor(getAccentColor(item)));

        let body = element.querySelector(".prompt-card-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "prompt-card-body";
            element.appendChild(body);
        }

        const promptText = String(item.prompt_text || "").trim();
        const noteText = String(item.content || "").trim();
        body.innerHTML = `
            <div class="prompt-card-topline">
                <div class="prompt-card-kicker">Prompt</div>
                <div class="prompt-card-chip">Utility</div>
            </div>
            <div class="prompt-card-title">${escapeHtml(item.label || "Prompt Card")}</div>
            <div class="prompt-card-copy">${escapeHtml(promptText || "No prompt text yet")}</div>
            <div class="prompt-card-note" ${noteText ? "" : 'style="display:none"'}>${escapeHtml(noteText)}</div>
            <div class="prompt-card-actions">
                <button type="button" class="prompt-card-action" data-action="set">Set Prompt</button>
                <button type="button" class="prompt-card-action ghost" data-action="append">Append</button>
            </div>
        `;

        body.querySelectorAll(".prompt-card-action").forEach((button) => {
            button.onclick = async (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!promptText) return;
                const mode = button.dataset.action === "append" ? "append" : "replace";
                workspace.setStoryboardPrompt(promptText, { mode });
            };
        });
    },
    renderInspectorFields({ item }) {
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Label</label>
                <input type="text" id="inspector-prompt-card-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Prompt Text</label>
                <textarea id="inspector-prompt-card-text" rows="5">${escapeHtml(item.prompt_text || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Note</label>
                <textarea id="inspector-prompt-card-content" rows="3">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-prompt-card-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-prompt-card-label", (value) => {
            item.label = value;
        });
        bindField("inspector-prompt-card-text", (value) => {
            item.prompt_text = value;
        });
        bindField("inspector-prompt-card-content", (value) => {
            item.content = value;
        });
        bindField("inspector-prompt-card-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

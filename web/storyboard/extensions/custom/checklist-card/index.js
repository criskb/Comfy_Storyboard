import {
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    formatChecklistText,
    getAccentColor,
    getViewportPlacement,
    parseChecklistText,
} from "../utils.js";

function ensureChecklistItems(item) {
    const parsed = Array.isArray(item.checklist_items) && item.checklist_items.length
        ? item.checklist_items
        : parseChecklistText(item.checklist_text || "");
    if (parsed.length) return parsed.slice(0, 8);
    return [
        { done: false, label: "Frame selected" },
        { done: false, label: "Lighting matched" },
        { done: false, label: "Prop checked" },
        { done: false, label: "Prompt ready" },
    ];
}

export const checklistCardStoryboardExtension = {
    id: "custom.checklist-card",
    type: "checklist_card",
    title: "Checklist Card",
    canvasClass: "checklist-card-item",
    toolbar: {
        buttonId: "storyboard-add-checklist-card",
        label: "Checklist Card",
        title: "Add Checklist Card",
        iconKey: "checklistCard",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 780, 280);
        const checklistItems = ensureChecklistItems({});
        return {
            id: `checklist_card_${workspace.generateUUID()}`,
            type: "checklist_card",
            x: position.x,
            y: position.y,
            w: 304,
            h: 220,
            label: "Shot Readiness",
            checklist_items: checklistItems,
            checklist_text: formatChecklistText(checklistItems),
            content: "Track what is truly ready before moving on.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("checklist-card-item");
        element.style.setProperty("--storyboard-custom-accent", getAccentColor(item));
        element.style.setProperty("--storyboard-custom-accent-contrast", workspace.getContrastColor(getAccentColor(item)));

        item.checklist_items = ensureChecklistItems(item);
        item.checklist_text = formatChecklistText(item.checklist_items);

        let body = element.querySelector(".checklist-card-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "checklist-card-body";
            element.appendChild(body);
        }

        const noteText = String(item.content || "").trim();
        body.innerHTML = `
            <div class="checklist-card-topline">
                <div class="checklist-card-kicker">Checklist</div>
                <div class="checklist-card-chip">${item.checklist_items.filter(entry => entry.done).length}/${item.checklist_items.length}</div>
            </div>
            <div class="checklist-card-title">${escapeHtml(item.label || "Checklist Card")}</div>
            <div class="checklist-card-list">
                ${item.checklist_items.map((entry, index) => `
                    <label class="checklist-card-row">
                        <input type="checkbox" data-index="${index}" ${entry.done ? "checked" : ""}>
                        <span>${escapeHtml(entry.label)}</span>
                    </label>
                `).join("")}
            </div>
            <div class="checklist-card-note" ${noteText ? "" : 'style="display:none"'}>${escapeHtml(noteText)}</div>
            <div class="checklist-card-actions">
                <button type="button" class="checklist-card-action ghost" data-action="reset">Reset</button>
                <button type="button" class="checklist-card-action" data-action="complete">Complete All</button>
            </div>
        `;

        body.querySelectorAll(".checklist-card-row input").forEach((input) => {
            input.onchange = async (event) => {
                event.stopPropagation();
                const index = Number(input.dataset.index);
                if (!Number.isFinite(index) || !item.checklist_items[index]) return;
                item.checklist_items[index].done = Boolean(input.checked);
                item.checklist_text = formatChecklistText(item.checklist_items);
                workspace.updateItemContent(element, item, false);
                await workspace.saveBoard();
            };
        });

        body.querySelectorAll(".checklist-card-action").forEach((button) => {
            button.onclick = async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const complete = button.dataset.action === "complete";
                item.checklist_items = item.checklist_items.map((entry) => ({ ...entry, done: complete }));
                item.checklist_text = formatChecklistText(item.checklist_items);
                workspace.updateItemContent(element, item, false);
                await workspace.saveBoard();
            };
        });
    },
    renderInspectorFields({ item }) {
        const items = ensureChecklistItems(item);
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Label</label>
                <input type="text" id="inspector-checklist-card-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Checklist Items</label>
                <textarea id="inspector-checklist-card-items" rows="8">${escapeHtml(formatChecklistText(items))}</textarea>
            </div>
            <div class="inspector-field">
                <label>Note</label>
                <textarea id="inspector-checklist-card-content" rows="3">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-checklist-card-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-checklist-card-label", (value) => {
            item.label = value;
        });
        bindField("inspector-checklist-card-items", (value) => {
            item.checklist_text = value;
            item.checklist_items = parseChecklistText(value);
        });
        bindField("inspector-checklist-card-content", (value) => {
            item.content = value;
        });
        bindField("inspector-checklist-card-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

import {
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

function getLinkedIds(item) {
    return Array.isArray(item.linked_ids) ? item.linked_ids.filter(Boolean) : [];
}

export const referenceBasketStoryboardExtension = {
    id: "custom.reference-basket",
    type: "reference_basket",
    title: "Reference Basket",
    canvasClass: "reference-basket-item",
    toolbar: {
        buttonId: "storyboard-add-reference-basket",
        label: "Reference Basket",
        title: "Add Reference Basket",
        iconKey: "referenceBasket",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 1020, 280);
        return {
            id: `reference_basket_${workspace.generateUUID()}`,
            type: "reference_basket",
            x: position.x,
            y: position.y,
            w: 322,
            h: 190,
            label: "Saved Reference Group",
            linked_ids: [],
            content: "Capture the current selection, then reselect it later with one click.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("reference-basket-item");
        element.style.setProperty("--storyboard-custom-accent", getAccentColor(item));
        element.style.setProperty("--storyboard-custom-accent-contrast", workspace.getContrastColor(getAccentColor(item)));

        const linkedIds = getLinkedIds(item);
        const linkedItems = linkedIds
            .map((id) => workspace.boardData.items.find((candidate) => candidate.id === id))
            .filter(Boolean);

        let body = element.querySelector(".reference-basket-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "reference-basket-body";
            element.appendChild(body);
        }

        const noteText = String(item.content || "").trim();
        const previewLines = linkedItems.slice(0, 4).map((linkedItem) => (
            `<div class="reference-basket-preview-line">${escapeHtml(workspace.getStoryboardItemLabel(linkedItem))}</div>`
        )).join("");

        body.innerHTML = `
            <div class="reference-basket-topline">
                <div class="reference-basket-kicker">Reference Basket</div>
                <div class="reference-basket-chip">${linkedItems.length}</div>
            </div>
            <div class="reference-basket-title">${escapeHtml(item.label || "Reference Basket")}</div>
            <div class="reference-basket-preview">
                ${previewLines || '<div class="reference-basket-empty">No linked items yet</div>'}
            </div>
            <div class="reference-basket-note" ${noteText ? "" : 'style="display:none"'}>${escapeHtml(noteText)}</div>
            <div class="reference-basket-actions">
                <button type="button" class="reference-basket-action" data-action="capture">Capture Selection</button>
                <button type="button" class="reference-basket-action ghost" data-action="select" ${linkedItems.length ? "" : "disabled"}>Select Basket</button>
            </div>
        `;

        body.querySelectorAll(".reference-basket-action").forEach((button) => {
            button.onclick = async (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (button.dataset.action === "capture") {
                    await workspace.captureReferenceBasket(item.id);
                } else {
                    workspace.selectStoryboardItems(linkedIds);
                }
            };
        });
    },
    renderInspectorFields({ item }) {
        const linkedIds = getLinkedIds(item);
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Label</label>
                <input type="text" id="inspector-reference-basket-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Linked Item IDs</label>
                <textarea id="inspector-reference-basket-ids" rows="6">${escapeHtml(linkedIds.join("\n"))}</textarea>
            </div>
            <div class="inspector-field">
                <label>Note</label>
                <textarea id="inspector-reference-basket-content" rows="3">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-reference-basket-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-reference-basket-label", (value) => {
            item.label = value;
        });
        bindField("inspector-reference-basket-ids", (value) => {
            item.linked_ids = String(value ?? "")
                .split(/\r?\n/)
                .map((entry) => entry.trim())
                .filter(Boolean);
        });
        bindField("inspector-reference-basket-content", (value) => {
            item.content = value;
        });
        bindField("inspector-reference-basket-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

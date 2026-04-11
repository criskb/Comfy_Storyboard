import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const EDIT_RHYTHMS = ["Hold", "Accelerate", "Interrupt", "Breath", "Smash"];

export const editorialCardStoryboardExtension = {
    id: "custom.editorial-card",
    type: "editorial_card",
    title: "Editorial Card",
    canvasClass: "editorial-card-item",
    toolbar: {
        buttonId: "storyboard-add-editorial-card",
        label: "Editorial Card",
        title: "Add Editorial Card",
        iconKey: "editorialCard",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 1080, 280);
        return {
            id: `editorial_card_${workspace.generateUUID()}`,
            type: "editorial_card",
            x: position.x,
            y: position.y,
            w: 292,
            h: 172,
            label: "Hold one beat after the glance",
            edit_rhythm: "Hold",
            cut_logic: "Let the look finish before the cut steals the tension",
            content: "The pause should feel intentional, not slow.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("editorial-card-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".editorial-card-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "editorial-card-body";
            body.innerHTML = `
                <div class="editorial-card-topline">
                    <div class="editorial-card-rhythm"></div>
                    <div class="editorial-card-kicker">Editorial</div>
                </div>
                <div class="editorial-card-title"></div>
                <div class="editorial-card-logic"></div>
                <div class="editorial-card-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".editorial-card-rhythm").innerText = item.edit_rhythm || "Hold";
        body.querySelector(".editorial-card-title").innerText = (item.label || "Editorial Card").trim();

        const logic = body.querySelector(".editorial-card-logic");
        const logicText = (item.cut_logic || "").trim();
        logic.innerText = logicText;
        logic.style.display = logicText ? "block" : "none";

        const copy = body.querySelector(".editorial-card-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentRhythm = EDIT_RHYTHMS.includes(item.edit_rhythm) ? item.edit_rhythm : EDIT_RHYTHMS[0];
        const options = EDIT_RHYTHMS.map((rhythm) => (
            `<option value="${rhythm}" ${rhythm === currentRhythm ? "selected" : ""}>${rhythm}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Editorial Beat</label>
                <input type="text" id="inspector-editorial-card-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Rhythm</label>
                <select id="inspector-editorial-card-rhythm">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Cut Logic</label>
                <textarea id="inspector-editorial-card-logic" rows="3">${escapeHtml(item.cut_logic || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-editorial-card-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-editorial-card-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-editorial-card-label", (value) => {
            item.label = value;
        });
        bindField("inspector-editorial-card-rhythm", (value) => {
            item.edit_rhythm = value || EDIT_RHYTHMS[0];
        });
        bindField("inspector-editorial-card-logic", (value) => {
            item.cut_logic = value;
        });
        bindField("inspector-editorial-card-content", (value) => {
            item.content = value;
        });
        bindField("inspector-editorial-card-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

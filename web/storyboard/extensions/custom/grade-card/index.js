import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const GRADE_DIRECTIONS = ["Cold Contrast", "Muted Fog", "Warm Sodium", "Silver Blue", "Soft Print"];

export const gradeCardStoryboardExtension = {
    id: "custom.grade-card",
    type: "grade_card",
    title: "Grade Card",
    canvasClass: "grade-card-item",
    toolbar: {
        buttonId: "storyboard-add-grade-card",
        label: "Grade Card",
        title: "Add Grade Card",
        iconKey: "gradeCard",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 1040, 320);
        return {
            id: `grade_card_${workspace.generateUUID()}`,
            type: "grade_card",
            x: position.x,
            y: position.y,
            w: 260,
            h: 180,
            label: "Night steel with gentle skin separation",
            grade_direction: "Silver Blue",
            palette_note: "Blue steel mids, pale highlights, restrained amber practicals",
            content: "Keep faces readable without letting the board drift into clean commercial contrast.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("grade-card-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".grade-card-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "grade-card-body";
            body.innerHTML = `
                <div class="grade-card-topline">
                    <div class="grade-card-direction"></div>
                    <div class="grade-card-kicker">Grade</div>
                </div>
                <div class="grade-card-title"></div>
                <div class="grade-card-palette"></div>
                <div class="grade-card-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".grade-card-direction").innerText = item.grade_direction || "Silver Blue";
        body.querySelector(".grade-card-title").innerText = (item.label || "Grade Card").trim();

        const palette = body.querySelector(".grade-card-palette");
        const paletteText = (item.palette_note || "").trim();
        palette.innerText = paletteText;
        palette.style.display = paletteText ? "block" : "none";

        const copy = body.querySelector(".grade-card-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentDirection = GRADE_DIRECTIONS.includes(item.grade_direction) ? item.grade_direction : GRADE_DIRECTIONS[0];
        const options = GRADE_DIRECTIONS.map((direction) => (
            `<option value="${direction}" ${direction === currentDirection ? "selected" : ""}>${direction}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Look</label>
                <input type="text" id="inspector-grade-card-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Direction</label>
                <select id="inspector-grade-card-direction">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Palette Notes</label>
                <textarea id="inspector-grade-card-palette" rows="3">${escapeHtml(item.palette_note || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-grade-card-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-grade-card-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-grade-card-label", (value) => {
            item.label = value;
        });
        bindField("inspector-grade-card-direction", (value) => {
            item.grade_direction = value || GRADE_DIRECTIONS[0];
        });
        bindField("inspector-grade-card-palette", (value) => {
            item.palette_note = value;
        });
        bindField("inspector-grade-card-content", (value) => {
            item.content = value;
        });
        bindField("inspector-grade-card-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

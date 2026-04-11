import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const BLOCKING_PATTERNS = ["Cross Left", "Circle In", "Static Hold", "Pass Through", "Foreground Drift"];

export const blockingNoteStoryboardExtension = {
    id: "custom.blocking-note",
    type: "blocking_note",
    title: "Blocking Note",
    canvasClass: "blocking-note-item",
    toolbar: {
        buttonId: "storyboard-add-blocking-note",
        label: "Blocking Note",
        title: "Add Blocking Note",
        iconKey: "blockingNote",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 980, 300);
        return {
            id: `blocking_note_${workspace.generateUUID()}`,
            type: "blocking_note",
            x: position.x,
            y: position.y,
            w: 298,
            h: 176,
            label: "Mara crosses foreground before reveal",
            blocking_pattern: "Cross Left",
            staging: "Start framed by door edge, then cut across lens line before settling on mark.",
            content: "Keep the move soft enough that the audience feels the reveal before they fully see it.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("blocking-note-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".blocking-note-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "blocking-note-body";
            body.innerHTML = `
                <div class="blocking-note-topline">
                    <div class="blocking-note-pattern"></div>
                    <div class="blocking-note-kicker">Blocking</div>
                </div>
                <div class="blocking-note-title"></div>
                <div class="blocking-note-staging"></div>
                <div class="blocking-note-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".blocking-note-pattern").innerText = item.blocking_pattern || "Cross Left";
        body.querySelector(".blocking-note-title").innerText = (item.label || "Blocking Note").trim();

        const staging = body.querySelector(".blocking-note-staging");
        const stagingText = (item.staging || "").trim();
        staging.innerText = stagingText;
        staging.style.display = stagingText ? "block" : "none";

        const copy = body.querySelector(".blocking-note-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentPattern = BLOCKING_PATTERNS.includes(item.blocking_pattern) ? item.blocking_pattern : BLOCKING_PATTERNS[0];
        const options = BLOCKING_PATTERNS.map((pattern) => (
            `<option value="${pattern}" ${pattern === currentPattern ? "selected" : ""}>${pattern}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Beat</label>
                <input type="text" id="inspector-blocking-note-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Pattern</label>
                <select id="inspector-blocking-note-pattern">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Staging</label>
                <textarea id="inspector-blocking-note-staging" rows="3">${escapeHtml(item.staging || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-blocking-note-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-blocking-note-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-blocking-note-label", (value) => {
            item.label = value;
        });
        bindField("inspector-blocking-note-pattern", (value) => {
            item.blocking_pattern = value || BLOCKING_PATTERNS[0];
        });
        bindField("inspector-blocking-note-staging", (value) => {
            item.staging = value;
        });
        bindField("inspector-blocking-note-content", (value) => {
            item.content = value;
        });
        bindField("inspector-blocking-note-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

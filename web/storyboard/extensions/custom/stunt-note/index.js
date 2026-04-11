import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const STUNT_LEVELS = ["Low Risk", "Coordination", "Rigged", "Precision", "Hero Beat"];

export const stuntNoteStoryboardExtension = {
    id: "custom.stunt-note",
    type: "stunt_note",
    title: "Stunt Note",
    canvasClass: "stunt-note-item",
    toolbar: {
        buttonId: "storyboard-add-stunt-note",
        label: "Stunt Note",
        title: "Add Stunt Note",
        iconKey: "stuntNote",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 560, 320);
        return {
            id: `stunt_note_${workspace.generateUUID()}`,
            type: "stunt_note",
            x: position.x,
            y: position.y,
            w: 302,
            h: 176,
            label: "Controlled slip into railing catch",
            stunt_level: "Coordination",
            rigging: "Hidden knee pads, soft edge on rail, reset mark taped camera side",
            content: "The move should feel accidental on camera but precise for the performer.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("stunt-note-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".stunt-note-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "stunt-note-body";
            body.innerHTML = `
                <div class="stunt-note-topline">
                    <div class="stunt-note-level"></div>
                    <div class="stunt-note-kicker">Stunt</div>
                </div>
                <div class="stunt-note-title"></div>
                <div class="stunt-note-rigging"></div>
                <div class="stunt-note-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".stunt-note-level").innerText = item.stunt_level || "Coordination";
        body.querySelector(".stunt-note-title").innerText = (item.label || "Stunt Note").trim();

        const rigging = body.querySelector(".stunt-note-rigging");
        const riggingText = (item.rigging || "").trim();
        rigging.innerText = riggingText;
        rigging.style.display = riggingText ? "block" : "none";

        const copy = body.querySelector(".stunt-note-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentLevel = STUNT_LEVELS.includes(item.stunt_level) ? item.stunt_level : STUNT_LEVELS[0];
        const options = STUNT_LEVELS.map((level) => (
            `<option value="${level}" ${level === currentLevel ? "selected" : ""}>${level}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Action Beat</label>
                <input type="text" id="inspector-stunt-note-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Level</label>
                <select id="inspector-stunt-note-level">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Rigging / Safety</label>
                <textarea id="inspector-stunt-note-rigging" rows="3">${escapeHtml(item.rigging || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-stunt-note-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-stunt-note-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-stunt-note-label", (value) => {
            item.label = value;
        });
        bindField("inspector-stunt-note-level", (value) => {
            item.stunt_level = value || STUNT_LEVELS[0];
        });
        bindField("inspector-stunt-note-rigging", (value) => {
            item.rigging = value;
        });
        bindField("inspector-stunt-note-content", (value) => {
            item.content = value;
        });
        bindField("inspector-stunt-note-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

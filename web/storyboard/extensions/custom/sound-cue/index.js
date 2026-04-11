import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const SOUND_TYPES = ["Ambience", "Impact", "Foley", "Voice", "Music"];

export const soundCueStoryboardExtension = {
    id: "custom.sound-cue",
    type: "sound_cue",
    title: "Sound Cue",
    canvasClass: "sound-cue-item",
    toolbar: {
        buttonId: "storyboard-add-sound-cue",
        label: "Sound Cue",
        title: "Add Sound Cue",
        iconKey: "soundCue",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 620, 430);
        return {
            id: `sound_cue_${workspace.generateUUID()}`,
            type: "sound_cue",
            x: position.x,
            y: position.y,
            w: 332,
            h: 132,
            label: "Ferry horn underneath",
            sound_type: "Ambience",
            content: "Bring it in before the cut so the location arrives early.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("sound-cue-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".sound-cue-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "sound-cue-body";
            body.innerHTML = `
                <div class="sound-cue-topline">
                    <div class="sound-cue-type"></div>
                    <div class="sound-cue-kicker">Sound</div>
                </div>
                <div class="sound-cue-title"></div>
                <div class="sound-cue-bars" aria-hidden="true">
                    <span></span><span></span><span></span><span></span><span></span><span></span>
                </div>
                <div class="sound-cue-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".sound-cue-type").innerText = item.sound_type || "Ambience";
        body.querySelector(".sound-cue-title").innerText = (item.label || "Sound Cue").trim();
        const copy = body.querySelector(".sound-cue-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentType = SOUND_TYPES.includes(item.sound_type) ? item.sound_type : SOUND_TYPES[0];
        const options = SOUND_TYPES.map((type) => (
            `<option value="${type}" ${type === currentType ? "selected" : ""}>${type}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Cue</label>
                <input type="text" id="inspector-sound-cue-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Sound Type</label>
                <select id="inspector-sound-cue-type">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-sound-cue-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-sound-cue-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-sound-cue-label", (value) => {
            item.label = value;
        });
        bindField("inspector-sound-cue-type", (value) => {
            item.sound_type = value || SOUND_TYPES[0];
        });
        bindField("inspector-sound-cue-content", (value) => {
            item.content = value;
        });
        bindField("inspector-sound-cue-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

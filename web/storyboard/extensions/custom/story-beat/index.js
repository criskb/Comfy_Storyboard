import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getViewportPlacement,
} from "../utils.js";

const BEAT_STAGES = ["Setup", "Inciting", "Conflict", "Twist", "Resolve"];

export const storyBeatStoryboardExtension = {
    id: "custom.story-beat",
    type: "story_beat",
    title: "Story Beat",
    canvasClass: "story-beat-item",
    toolbar: {
        buttonId: "storyboard-add-story-beat",
        label: "Story Beat",
        title: "Add Story Beat",
        iconKey: "storyBeat",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 310, 120);
        return {
            id: `story_beat_${workspace.generateUUID()}`,
            type: "story_beat",
            x: position.x,
            y: position.y,
            w: 268,
            h: 168,
            label: "The world shifts",
            beat_stage: "Conflict",
            content: "The board stops being reference-only and turns into a sequence with intent.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("story-beat-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".story-beat-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "story-beat-body";
            body.innerHTML = `
                <div class="story-beat-stage"></div>
                <div class="story-beat-title"></div>
                <div class="story-beat-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".story-beat-stage").innerText = item.beat_stage || "Setup";
        body.querySelector(".story-beat-title").innerText = (item.label || "Story Beat").trim();
        const copy = body.querySelector(".story-beat-copy");
        const content = (item.content || "").trim();
        copy.innerText = content;
        copy.style.display = content ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentStage = BEAT_STAGES.includes(item.beat_stage) ? item.beat_stage : BEAT_STAGES[0];
        const stageOptions = BEAT_STAGES.map((stage) => (
            `<option value="${stage}" ${stage === currentStage ? "selected" : ""}>${stage}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Title</label>
                <input type="text" id="inspector-story-beat-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Stage</label>
                <select id="inspector-story-beat-stage">${stageOptions}</select>
            </div>
            <div class="inspector-field">
                <label>Copy</label>
                <textarea id="inspector-story-beat-content" rows="5">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-story-beat-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);

        bindField("inspector-story-beat-label", (value) => {
            item.label = value;
        });
        bindField("inspector-story-beat-stage", (value) => {
            item.beat_stage = value || BEAT_STAGES[0];
        });
        bindField("inspector-story-beat-content", (value) => {
            item.content = value;
        });
        bindField("inspector-story-beat-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

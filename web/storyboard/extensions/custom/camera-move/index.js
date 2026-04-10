import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const CAMERA_MOVE_TYPES = ["Static", "Push In", "Pull Back", "Pan", "Tilt", "Track", "Handheld"];

export const cameraMoveStoryboardExtension = {
    id: "custom.camera-move",
    type: "camera_move",
    title: "Camera Move",
    canvasClass: "camera-move-item",
    toolbar: {
        buttonId: "storyboard-add-camera-move",
        label: "Camera Move",
        title: "Add Camera Move",
        iconKey: "cameraMove",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 560, 320);
        return {
            id: `camera_move_${workspace.generateUUID()}`,
            type: "camera_move",
            x: position.x,
            y: position.y,
            w: 356,
            h: 96,
            label: "Reveal the subject as the wind shifts",
            move_type: "Push In",
            duration: "4 beats",
            content: "Stay gentle and deliberate. Let the environment breathe before the face lands.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("camera-move-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".camera-move-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "camera-move-body";
            body.innerHTML = `
                <div class="camera-move-meta">
                    <div class="camera-move-type"></div>
                    <div class="camera-move-duration"></div>
                </div>
                <div class="camera-move-title"></div>
                <div class="camera-move-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".camera-move-type").innerText = item.move_type || "Static";
        const duration = body.querySelector(".camera-move-duration");
        const durationText = (item.duration || "").trim();
        duration.innerText = durationText;
        duration.style.display = durationText ? "inline-flex" : "none";
        body.querySelector(".camera-move-title").innerText = (item.label || "Camera Move").trim();
        const copy = body.querySelector(".camera-move-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentMove = CAMERA_MOVE_TYPES.includes(item.move_type) ? item.move_type : CAMERA_MOVE_TYPES[0];
        const options = CAMERA_MOVE_TYPES.map((move) => (
            `<option value="${move}" ${move === currentMove ? "selected" : ""}>${move}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Move Cue</label>
                <input type="text" id="inspector-camera-move-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Move Type</label>
                <select id="inspector-camera-move-type">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Duration</label>
                <input type="text" id="inspector-camera-move-duration" value="${escapeHtml(item.duration || "")}" placeholder="4 beats">
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-camera-move-content" rows="3">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-camera-move-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-camera-move-label", (value) => {
            item.label = value;
        });
        bindField("inspector-camera-move-type", (value) => {
            item.move_type = value || CAMERA_MOVE_TYPES[0];
        });
        bindField("inspector-camera-move-duration", (value) => {
            item.duration = value;
        });
        bindField("inspector-camera-move-content", (value) => {
            item.content = value;
        });
        bindField("inspector-camera-move-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const HMU_AREAS = ["Hair", "Makeup", "Skin FX", "Sweat Pass", "Aging Detail"];

export const hairMakeupNoteStoryboardExtension = {
    id: "custom.hair-makeup-note",
    type: "hair_makeup_note",
    title: "Hair + Makeup Note",
    canvasClass: "hair-makeup-note-item",
    toolbar: {
        buttonId: "storyboard-add-hair-makeup-note",
        label: "Hair + Makeup",
        title: "Add Hair + Makeup Note",
        iconKey: "hairMakeupNote",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 920, 260);
        return {
            id: `hair_makeup_note_${workspace.generateUUID()}`,
            type: "hair_makeup_note",
            x: position.x,
            y: position.y,
            w: 286,
            h: 178,
            label: "Wind-broken fringe and cold skin",
            hmu_area: "Hair",
            application: "Loose flyaways, slight temple dampness, lip tone pulled cooler",
            content: "The look should feel like the air changed her before the scene did.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("hair-makeup-note-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".hair-makeup-note-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "hair-makeup-note-body";
            body.innerHTML = `
                <div class="hair-makeup-note-topline">
                    <div class="hair-makeup-note-area"></div>
                    <div class="hair-makeup-note-kicker">Hair + Makeup</div>
                </div>
                <div class="hair-makeup-note-title"></div>
                <div class="hair-makeup-note-application"></div>
                <div class="hair-makeup-note-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".hair-makeup-note-area").innerText = item.hmu_area || "Hair";
        body.querySelector(".hair-makeup-note-title").innerText = (item.label || "Hair + Makeup Note").trim();

        const application = body.querySelector(".hair-makeup-note-application");
        const applicationText = (item.application || "").trim();
        application.innerText = applicationText;
        application.style.display = applicationText ? "block" : "none";

        const copy = body.querySelector(".hair-makeup-note-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentArea = HMU_AREAS.includes(item.hmu_area) ? item.hmu_area : HMU_AREAS[0];
        const options = HMU_AREAS.map((area) => (
            `<option value="${area}" ${area === currentArea ? "selected" : ""}>${area}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Look</label>
                <input type="text" id="inspector-hair-makeup-note-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Area</label>
                <select id="inspector-hair-makeup-note-area">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Application</label>
                <textarea id="inspector-hair-makeup-note-application" rows="3">${escapeHtml(item.application || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-hair-makeup-note-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-hair-makeup-note-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-hair-makeup-note-label", (value) => {
            item.label = value;
        });
        bindField("inspector-hair-makeup-note-area", (value) => {
            item.hmu_area = value || HMU_AREAS[0];
        });
        bindField("inspector-hair-makeup-note-application", (value) => {
            item.application = value;
        });
        bindField("inspector-hair-makeup-note-content", (value) => {
            item.content = value;
        });
        bindField("inspector-hair-makeup-note-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

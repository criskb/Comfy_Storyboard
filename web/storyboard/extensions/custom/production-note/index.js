import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const PRODUCTION_DEPARTMENTS = ["Art", "Locations", "AD", "Props", "Wardrobe"];

export const productionNoteStoryboardExtension = {
    id: "custom.production-note",
    type: "production_note",
    title: "Production Note",
    canvasClass: "production-note-item",
    toolbar: {
        buttonId: "storyboard-add-production-note",
        label: "Production Note",
        title: "Add Production Note",
        iconKey: "productionNote",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 820, 320);
        return {
            id: `production_note_${workspace.generateUUID()}`,
            type: "production_note",
            x: position.x,
            y: position.y,
            w: 272,
            h: 170,
            label: "Access rooftop one hour before dusk",
            production_department: "Locations",
            status: "Confirm elevator key + rain cover",
            content: "Build setup time into the board so the mood references stay achievable.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("production-note-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".production-note-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "production-note-body";
            body.innerHTML = `
                <div class="production-note-topline">
                    <div class="production-note-department"></div>
                    <div class="production-note-kicker">Production</div>
                </div>
                <div class="production-note-title"></div>
                <div class="production-note-status"></div>
                <div class="production-note-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".production-note-department").innerText = item.production_department || "Art";
        body.querySelector(".production-note-title").innerText = (item.label || "Production Note").trim();

        const status = body.querySelector(".production-note-status");
        const statusText = (item.status || "").trim();
        status.innerText = statusText;
        status.style.display = statusText ? "block" : "none";

        const copy = body.querySelector(".production-note-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentDepartment = PRODUCTION_DEPARTMENTS.includes(item.production_department) ? item.production_department : PRODUCTION_DEPARTMENTS[0];
        const options = PRODUCTION_DEPARTMENTS.map((department) => (
            `<option value="${department}" ${department === currentDepartment ? "selected" : ""}>${department}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Task</label>
                <input type="text" id="inspector-production-note-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Department</label>
                <select id="inspector-production-note-department">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Status / Need</label>
                <input type="text" id="inspector-production-note-status" value="${escapeHtml(item.status || "")}">
            </div>
            <div class="inspector-field">
                <label>Notes</label>
                <textarea id="inspector-production-note-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-production-note-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-production-note-label", (value) => {
            item.label = value;
        });
        bindField("inspector-production-note-department", (value) => {
            item.production_department = value || PRODUCTION_DEPARTMENTS[0];
        });
        bindField("inspector-production-note-status", (value) => {
            item.status = value;
        });
        bindField("inspector-production-note-content", (value) => {
            item.content = value;
        });
        bindField("inspector-production-note-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

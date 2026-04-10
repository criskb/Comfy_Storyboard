import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const TIMES_OF_DAY = ["Dawn", "Day", "Dusk", "Night", "Blue Hour"];

export const locationCardStoryboardExtension = {
    id: "custom.location-card",
    type: "location_card",
    title: "Location Card",
    canvasClass: "location-card-item",
    toolbar: {
        buttonId: "storyboard-add-location-card",
        label: "Location Card",
        title: "Add Location Card",
        iconKey: "locationCard",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 420, 180);
        return {
            id: `location_card_${workspace.generateUUID()}`,
            type: "location_card",
            x: position.x,
            y: position.y,
            w: 252,
            h: 178,
            label: "Harbor Rooftop",
            time_of_day: "Night",
            content: "Wet concrete, sodium haze, gulls gone quiet, fabric moving in the wind.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("location-card-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".location-card-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "location-card-body";
            body.innerHTML = `
                <div class="location-card-topline">
                    <div class="location-card-time"></div>
                    <div class="location-card-kicker">Location</div>
                </div>
                <div class="location-card-title"></div>
                <div class="location-card-copy"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".location-card-time").innerText = item.time_of_day || "Night";
        body.querySelector(".location-card-title").innerText = (item.label || "Location Card").trim();
        const copy = body.querySelector(".location-card-copy");
        const copyText = (item.content || "").trim();
        copy.innerText = copyText;
        copy.style.display = copyText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentTime = TIMES_OF_DAY.includes(item.time_of_day) ? item.time_of_day : TIMES_OF_DAY[0];
        const options = TIMES_OF_DAY.map((time) => (
            `<option value="${time}" ${time === currentTime ? "selected" : ""}>${time}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Location</label>
                <input type="text" id="inspector-location-card-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Time Of Day</label>
                <select id="inspector-location-card-time">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Atmosphere</label>
                <textarea id="inspector-location-card-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-location-card-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-location-card-label", (value) => {
            item.label = value;
        });
        bindField("inspector-location-card-time", (value) => {
            item.time_of_day = value || TIMES_OF_DAY[0];
        });
        bindField("inspector-location-card-content", (value) => {
            item.content = value;
        });
        bindField("inspector-location-card-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

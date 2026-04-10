import {
    applyAccentVariables,
    createCustomFieldBinder,
    CUSTOM_EXTENSION_INSPECTOR_SUMMARY,
    DEFAULT_CUSTOM_ACCENT,
    escapeHtml,
    getAccentColor,
    getViewportPlacement,
} from "../utils.js";

const CHARACTER_ROLES = ["Lead", "Support", "Antagonist", "Witness", "Ensemble"];

export const characterCardStoryboardExtension = {
    id: "custom.character-card",
    type: "character_card",
    title: "Character Card",
    canvasClass: "character-card-item",
    toolbar: {
        buttonId: "storyboard-add-character-card",
        label: "Character Card",
        title: "Add Character Card",
        iconKey: "characterCard",
        section: "Sandbox Items",
    },
    createItem(workspace) {
        const position = getViewportPlacement(workspace, 280, 280);
        return {
            id: `character_card_${workspace.generateUUID()}`,
            type: "character_card",
            x: position.x,
            y: position.y,
            w: 268,
            h: 196,
            label: "Ari Vale",
            character_role: "Lead",
            look: "Weathered coat, silver ring, eyes that never fully relax.",
            content: "Reserved but alert. Moves like every room might still change its mind.",
            accent: DEFAULT_CUSTOM_ACCENT,
        };
    },
    updateItemContent({ workspace, element, item }) {
        element.classList.add("character-card-item");
        applyAccentVariables(workspace, element, item);

        let body = element.querySelector(".character-card-body");
        if (!body) {
            body = document.createElement("div");
            body.className = "character-card-body";
            body.innerHTML = `
                <div class="character-card-header">
                    <div class="character-card-kicker">Character</div>
                    <div class="character-card-role"></div>
                </div>
                <div class="character-card-name"></div>
                <div class="character-card-look"></div>
                <div class="character-card-note"></div>
            `;
            element.appendChild(body);
        }

        body.querySelector(".character-card-role").innerText = item.character_role || "Lead";
        body.querySelector(".character-card-name").innerText = (item.label || "Character Card").trim();

        const look = body.querySelector(".character-card-look");
        const lookText = (item.look || "").trim();
        look.innerText = lookText;
        look.style.display = lookText ? "block" : "none";

        const note = body.querySelector(".character-card-note");
        const noteText = (item.content || "").trim();
        note.innerText = noteText;
        note.style.display = noteText ? "block" : "none";
    },
    renderInspectorFields({ item }) {
        const currentRole = CHARACTER_ROLES.includes(item.character_role) ? item.character_role : CHARACTER_ROLES[0];
        const options = CHARACTER_ROLES.map((role) => (
            `<option value="${role}" ${role === currentRole ? "selected" : ""}>${role}</option>`
        )).join("");
        return `
            ${CUSTOM_EXTENSION_INSPECTOR_SUMMARY}
            <div class="inspector-field">
                <label>Name</label>
                <input type="text" id="inspector-character-card-label" value="${escapeHtml(item.label || "")}">
            </div>
            <div class="inspector-field">
                <label>Role</label>
                <select id="inspector-character-card-role">${options}</select>
            </div>
            <div class="inspector-field">
                <label>Look / Wardrobe</label>
                <textarea id="inspector-character-card-look" rows="3">${escapeHtml(item.look || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Character Note</label>
                <textarea id="inspector-character-card-content" rows="4">${escapeHtml(item.content || "")}</textarea>
            </div>
            <div class="inspector-field">
                <label>Accent</label>
                <input type="color" id="inspector-character-card-accent" value="${escapeHtml(getAccentColor(item))}">
            </div>
        `;
    },
    bindInspector({ workspace, item }) {
        const bindField = createCustomFieldBinder(workspace, item);
        bindField("inspector-character-card-label", (value) => {
            item.label = value;
        });
        bindField("inspector-character-card-role", (value) => {
            item.character_role = value || CHARACTER_ROLES[0];
        });
        bindField("inspector-character-card-look", (value) => {
            item.look = value;
        });
        bindField("inspector-character-card-content", (value) => {
            item.content = value;
        });
        bindField("inspector-character-card-accent", (value) => {
            item.accent = value || DEFAULT_CUSTOM_ACCENT;
        });
    },
};

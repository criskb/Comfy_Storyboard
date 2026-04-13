export const DEFAULT_CUSTOM_ACCENT = "#ffffff";
export const CUSTOM_EXTENSION_INSPECTOR_SUMMARY = '<div class="inspector-summary">Custom storyboard extension</div>';

export function getViewportPlacement(workspace, x = 100, y = 100) {
    return {
        x: -workspace.offset.x / workspace.scale + x,
        y: -workspace.offset.y / workspace.scale + y,
    };
}

export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function normalizeHexColor(value, fallback = DEFAULT_CUSTOM_ACCENT) {
    const text = String(value ?? "").trim();
    if (!text) return fallback;
    const normalized = text.startsWith("#") ? text : `#${text}`;
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
        return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
    }
    return fallback;
}

export function getAccentColor(item, fallback = DEFAULT_CUSTOM_ACCENT) {
    return normalizeHexColor(item?.accent, fallback);
}

export function applyAccentVariables(workspace, element, item, fallback = DEFAULT_CUSTOM_ACCENT) {
    const accent = getAccentColor(item, fallback);
    element.style.setProperty("--storyboard-custom-accent", accent);
    element.style.setProperty("--storyboard-custom-accent-contrast", workspace.getContrastColor(accent));
    return accent;
}

export function refreshCustomItem(workspace, item) {
    const element = workspace.itemElements.get(item.id);
    if (element) workspace.updateItemContent(element, item, false);
}

export function attachDirectItemDrag(workspace, item, element, options = {}) {
    const { selector = null, clearLegacyPinned = false } = options;
    const dragTarget = selector ? element.querySelector(selector) : element;
    if (!dragTarget) return null;
    let pointerDragActive = false;

    const beginDrag = (event) => {
        if (typeof event.button === "number" && event.button !== 0) return;
        if (clearLegacyPinned && item.__custom_drag_migrated !== true) {
            item.pinned = false;
            item.__custom_drag_migrated = true;
        }
        workspace.beginItemDrag(item.id, event);
    };

    dragTarget.style.cursor = item.pinned ? "default" : "grab";
    dragTarget.onpointerdown = null;
    dragTarget.onmousedown = null;
    if (typeof window !== "undefined" && "PointerEvent" in window) {
        dragTarget.onpointerdown = (event) => {
            pointerDragActive = true;
            beginDrag(event);
        };
        dragTarget.onpointerup = () => {
            pointerDragActive = false;
        };
        dragTarget.onpointercancel = () => {
            pointerDragActive = false;
        };
        dragTarget.onmousedown = (event) => {
            if (pointerDragActive) return;
            beginDrag(event);
        };
    } else {
        dragTarget.onmousedown = beginDrag;
    }
    return dragTarget;
}

export function bindValueField(id, handlers = {}) {
    const input = document.getElementById(id);
    if (!input) return null;
    const { onInput = null, onChange = null } = handlers;
    if (typeof onInput === "function") {
        input.oninput = () => onInput(input.value, input);
    }
    if (typeof onChange === "function") {
        input.onchange = () => onChange(input.value, input);
    }
    return input;
}

export function createCustomFieldBinder(workspace, item) {
    return (id, assign, { refresh = true } = {}) => bindValueField(id, {
        onInput: (value, input) => {
            assign(value, input);
            if (refresh) refreshCustomItem(workspace, item);
        },
        onChange: (value, input) => {
            assign(value, input);
            if (refresh) refreshCustomItem(workspace, item);
            workspace.saveBoard();
        },
    });
}

export function parseColorList(value, fallbackColors = []) {
    const tokens = String(value ?? "")
        .split(/[\s,;|]+/)
        .map(token => token.trim())
        .filter(Boolean);
    const colors = tokens
        .map(token => normalizeHexColor(token, ""))
        .filter(Boolean)
        .slice(0, 6);
    if (colors.length) return colors;
    return (fallbackColors || [])
        .map(color => normalizeHexColor(color, ""))
        .filter(Boolean)
        .slice(0, 6);
}

export function formatColorList(colors) {
    return (colors || [])
        .map(color => normalizeHexColor(color, ""))
        .filter(Boolean)
        .join(", ");
}

export function parseChecklistText(value) {
    return String(value ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 8)
        .map((line) => {
            const match = line.match(/^\[(x|X| )\]\s*(.+)$/);
            if (match) {
                return {
                    done: match[1].toLowerCase() === "x",
                    label: match[2].trim(),
                };
            }
            return {
                done: false,
                label: line.replace(/^[-*]\s*/, "").trim(),
            };
        })
        .filter((item) => item.label);
}

export function formatChecklistText(items) {
    return (items || [])
        .map((item) => `[${item?.done ? "x" : " "}] ${String(item?.label || "").trim()}`)
        .join("\n");
}

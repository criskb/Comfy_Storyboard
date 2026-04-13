import {
    isStoryboardItemVisible,
    normalizeStoryboardItemState,
} from "./item_state.js";

function deepCloneValue(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

export function normalizePixelRect(startX, startY, endX, endY) {
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);
    return { x, y, w, h };
}

export function pixelRectExceedsThreshold(rect, threshold = 4) {
    return Boolean(rect) && (rect.w >= threshold || rect.h >= threshold);
}

export function pixelRectToWorldRect(rect, offset, scale) {
    return {
        x: (rect.x - offset.x) / scale,
        y: (rect.y - offset.y) / scale,
        w: rect.w / scale,
        h: rect.h / scale,
    };
}

export function itemIntersectsWorldRect(item, rect) {
    if (!item || !rect) return false;
    const itemLeft = Number(item.x) || 0;
    const itemTop = Number(item.y) || 0;
    const itemRight = itemLeft + Math.max(1, Number(item.w) || 1);
    const itemBottom = itemTop + Math.max(1, Number(item.h) || 1);
    const rectRight = rect.x + rect.w;
    const rectBottom = rect.y + rect.h;
    return itemLeft <= rectRight && itemRight >= rect.x && itemTop <= rectBottom && itemBottom >= rect.y;
}

export function getItemIdsIntersectingWorldRect(items, rect, options = {}) {
    const { includeHidden = false } = options;
    return (items || [])
        .filter((item) => item?.id && (includeHidden || isStoryboardItemVisible(item)) && itemIntersectsWorldRect(item, rect))
        .map((item) => item.id);
}

export function cloneStoryboardItemsForPaste(items, { generateId, offsetX = 20, offsetY = 20 } = {}) {
    const sourceItems = (items || []).filter(Boolean).map((item) => deepCloneValue(item));
    const idMap = new Map();

    sourceItems.forEach((item) => {
        if (!item?.id) return;
        const nextId = typeof generateId === "function" ? generateId(item) : item.id;
        idMap.set(item.id, nextId);
    });

    return sourceItems.map((item) => {
        const cloned = deepCloneValue(item);
        cloned.id = idMap.get(item.id) || cloned.id;
        cloned.x = (Number(cloned.x) || 0) + offsetX;
        cloned.y = (Number(cloned.y) || 0) + offsetY;

        if (Array.isArray(cloned.linked_ids)) {
            cloned.linked_ids = cloned.linked_ids.map((id) => idMap.get(id) || id);
        }

        normalizeStoryboardItemState(cloned);
        return cloned;
    });
}

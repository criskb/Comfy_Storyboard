function normalizeBooleanFlag(value) {
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (!normalized || ["0", "false", "no", "off", "null", "undefined"].includes(normalized)) {
            return false;
        }
        return true;
    }
    return Boolean(value);
}

export function isStoryboardItemHidden(item) {
    return normalizeBooleanFlag(item?.hidden);
}

export function isStoryboardItemLocked(item) {
    return normalizeBooleanFlag(item?.locked) || normalizeBooleanFlag(item?.pinned);
}

export function isStoryboardItemVisible(item) {
    return Boolean(item) && !isStoryboardItemHidden(item);
}

export function isStoryboardItemEditable(item) {
    return isStoryboardItemVisible(item) && !isStoryboardItemLocked(item);
}

export function normalizeStoryboardItemState(item, options = {}) {
    if (!item || typeof item !== "object") return item;

    const { mirrorLegacyPinned = false } = options;
    const hidden = isStoryboardItemHidden(item);
    const locked = isStoryboardItemLocked(item);

    if (hidden) item.hidden = true;
    else delete item.hidden;

    if (locked) item.locked = true;
    else delete item.locked;

    if (mirrorLegacyPinned) {
        if (locked) item.pinned = true;
        else delete item.pinned;
    } else {
        delete item.pinned;
    }

    return item;
}

export function normalizeStoryboardItems(items, options = {}) {
    (items || []).forEach((item) => {
        normalizeStoryboardItemState(item, options);
    });
    return items || [];
}

export function getStoryboardVisibleItems(items) {
    return (items || []).filter((item) => isStoryboardItemVisible(item));
}

export function getStoryboardHiddenItems(items) {
    return (items || []).filter((item) => isStoryboardItemHidden(item));
}

export function getStoryboardLockedItems(items) {
    return (items || []).filter((item) => isStoryboardItemLocked(item));
}

export function filterStoryboardSelectionIds(itemIds, items, options = {}) {
    const { includeHidden = false } = options;
    const allowedIds = new Set(
        (items || [])
            .filter((item) => item?.id && (includeHidden || isStoryboardItemVisible(item)))
            .map((item) => item.id),
    );

    return Array.from(new Set(
        (itemIds || [])
            .map((itemId) => String(itemId || "").trim())
            .filter((itemId) => itemId && allowedIds.has(itemId)),
    ));
}

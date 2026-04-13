export const DEFAULT_STORYBOARD_COLLECTION_COLORS = [
    "#7dd3fc",
    "#fda4af",
    "#86efac",
    "#fde68a",
    "#c4b5fd",
    "#f9a8d4",
];

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeStoryboardCollectionColor(value, fallback = DEFAULT_STORYBOARD_COLLECTION_COLORS[0]) {
    const color = String(value ?? "").trim();
    if (!HEX_COLOR_PATTERN.test(color)) return fallback;
    if (color.length === 4) {
        return `#${color.slice(1).split("").map((channel) => channel + channel).join("")}`.toLowerCase();
    }
    return color.toLowerCase();
}

export function normalizeStoryboardCollections(groups, items, options = {}) {
    const generateId = typeof options.generateId === "function"
        ? options.generateId
        : () => `collection_${Math.random().toString(36).slice(2, 10)}`;
    const itemIdSet = new Set((items || []).map((item) => item?.id).filter(Boolean));
    const seenCollectionIds = new Set();
    const normalized = [];

    (groups || []).forEach((rawGroup, index) => {
        if (!rawGroup || typeof rawGroup !== "object") return;

        let id = String(rawGroup.id || "").trim();
        if (!id || seenCollectionIds.has(id)) id = generateId();
        while (seenCollectionIds.has(id)) id = generateId();
        seenCollectionIds.add(id);

        const name = String(rawGroup.name || "").trim() || `Collection ${normalized.length + 1}`;
        const fallbackColor = DEFAULT_STORYBOARD_COLLECTION_COLORS[index % DEFAULT_STORYBOARD_COLLECTION_COLORS.length];
        const color = normalizeStoryboardCollectionColor(rawGroup.color, fallbackColor);
        const rawItemIds = Array.isArray(rawGroup.item_ids) ? rawGroup.item_ids : Array.isArray(rawGroup.items) ? rawGroup.items : [];
        const seenItemIds = new Set();
        const item_ids = rawItemIds
            .map((itemId) => String(itemId || "").trim())
            .filter((itemId) => itemId && itemIdSet.has(itemId) && !seenItemIds.has(itemId) && seenItemIds.add(itemId));

        const group = { id, name, color, item_ids };
        if (rawGroup.created_at) group.created_at = rawGroup.created_at;
        if (rawGroup.updated_at) group.updated_at = rawGroup.updated_at;
        normalized.push(group);
    });

    return normalized;
}

export function createStoryboardCollection({ name, itemIds, color = null, generateId = null, createdAt = null, updatedAt = null, index = 0 } = {}) {
    const buildId = typeof generateId === "function"
        ? generateId
        : () => `collection_${Math.random().toString(36).slice(2, 10)}`;
    const fallbackColor = DEFAULT_STORYBOARD_COLLECTION_COLORS[index % DEFAULT_STORYBOARD_COLLECTION_COLORS.length];
    const collection = {
        id: buildId(),
        name: String(name || "").trim() || "Collection",
        color: normalizeStoryboardCollectionColor(color, fallbackColor),
        item_ids: Array.from(new Set((itemIds || []).map((itemId) => String(itemId || "").trim()).filter(Boolean))),
    };
    if (createdAt) collection.created_at = createdAt;
    if (updatedAt) collection.updated_at = updatedAt;
    return collection;
}

export function getStoryboardCollectionItems(collection, items) {
    const itemMap = new Map((items || []).map((item) => [item?.id, item]));
    return (collection?.item_ids || []).map((itemId) => itemMap.get(itemId)).filter(Boolean);
}

export function storyboardCollectionMatchesSelection(collection, selection) {
    const left = Array.from(new Set(collection?.item_ids || []));
    const right = Array.from(new Set((selection || []).filter(Boolean)));
    if (left.length !== right.length) return false;
    const rightSet = new Set(right);
    return left.every((itemId) => rightSet.has(itemId));
}

export const STORYBOARD_MAX_PINNED_EXTENSIONS = 6;

const STORYBOARD_EXTENSION_FAVORITES_KEY = "storyboard.toolbarFavorites";

function getAvailableExtensionTypes(extensions) {
    return new Set(
        (extensions || [])
            .map((extension) => extension?.type)
            .filter((type) => typeof type === "string" && type.length > 0),
    );
}

export function isStoryboardCoreExtension(extension) {
    return extension?.toolbar?.section === "Core Items";
}

export function normalizeStoryboardExtensionFavorites(value, extensions) {
    const availableTypes = getAvailableExtensionTypes(extensions);
    const seen = new Set();
    const rawFavorites = Array.isArray(value) ? value : [];
    const normalized = [];

    rawFavorites.forEach((type) => {
        if (typeof type !== "string") return;
        const trimmed = type.trim();
        if (!trimmed || seen.has(trimmed) || !availableTypes.has(trimmed)) return;
        seen.add(trimmed);
        normalized.push(trimmed);
    });

    return normalized.slice(0, STORYBOARD_MAX_PINNED_EXTENSIONS);
}

export function loadStoryboardExtensionFavorites(extensions, storage = globalThis.localStorage) {
    let parsed = [];
    try {
        const raw = storage?.getItem?.(STORYBOARD_EXTENSION_FAVORITES_KEY);
        parsed = raw ? JSON.parse(raw) : [];
    } catch (error) {
        parsed = [];
    }
    return saveStoryboardExtensionFavorites(parsed, extensions, storage);
}

export function saveStoryboardExtensionFavorites(favorites, extensions, storage = globalThis.localStorage) {
    const normalized = normalizeStoryboardExtensionFavorites(favorites, extensions);
    try {
        storage?.setItem?.(STORYBOARD_EXTENSION_FAVORITES_KEY, JSON.stringify(normalized));
    } catch (error) {
        // Ignore storage failures so the picker still works in restricted contexts.
    }
    return normalized;
}

function getExtensionSearchTerms(extension) {
    const toolbar = extension?.toolbar || {};
    return [
        extension?.type,
        extension?.title,
        toolbar.label,
        toolbar.title,
        toolbar.section,
    ].filter(Boolean);
}

export function matchesStoryboardExtensionQuery(extension, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return true;
    const haystack = getExtensionSearchTerms(extension).join(" ").toLowerCase();
    return normalizedQuery.split(/\s+/).every((term) => haystack.includes(term));
}

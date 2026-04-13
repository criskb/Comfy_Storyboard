function deepClone(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

function serialize(value) {
    return JSON.stringify(value);
}

export function createStoryboardHistorySnapshot(boardData) {
    return serialize({
        items: deepClone(boardData?.items || []),
        groups: deepClone(boardData?.groups || []),
        selection: deepClone(boardData?.selection || []),
        settings: deepClone(boardData?.settings || {}),
    });
}

export function createStoryboardHistorySignature(boardData) {
    return serialize({
        items: deepClone(boardData?.items || []),
        groups: deepClone(boardData?.groups || []),
        settings: deepClone(boardData?.settings || {}),
    });
}

export function parseStoryboardHistorySnapshot(snapshot) {
    const parsed = typeof snapshot === "string" ? JSON.parse(snapshot) : deepClone(snapshot || {});
    return {
        items: Array.isArray(parsed.items) ? parsed.items : [],
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        selection: Array.isArray(parsed.selection) ? parsed.selection : [],
        settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {},
    };
}

export function pushStoryboardHistoryEntry(stack, snapshot, maxEntries = 80) {
    if (!snapshot) return stack || [];
    const nextStack = Array.isArray(stack) ? [...stack, snapshot] : [snapshot];
    if (nextStack.length <= maxEntries) return nextStack;
    return nextStack.slice(nextStack.length - maxEntries);
}

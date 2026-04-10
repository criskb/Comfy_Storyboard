export function sortItemsByStoryboardOrder(items, rowTolerance = 72) {
    return [...(items || [])]
        .filter(Boolean)
        .sort((a, b) => {
            if (Math.abs(a.y - b.y) > rowTolerance) return a.y - b.y;
            return a.x - b.x;
        });
}

export function formatStoryboardSceneCode(index, minimumDigits = 2) {
    const numeric = Number(index);
    const safe = Number.isFinite(numeric) ? Math.max(1, Math.round(numeric)) : 1;
    return String(safe).padStart(Math.max(1, minimumDigits), "0");
}

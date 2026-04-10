export const MOODBOARD_ROTATION_PATTERN = [-7, 5, -4, 6, -6, 4, -3, 7];

const STACK_ROTATION_PATTERN = [0, -6, 5, -4, 4, -3, 3, -2];
const STACK_OFFSET_PATTERN = [
    { x: 0, y: 0 },
    { x: 1.1, y: 0.75 },
    { x: -1.0, y: 0.6 },
    { x: 0.85, y: -0.7 },
    { x: -0.7, y: -0.9 },
    { x: 0.6, y: 1.1 },
    { x: -0.55, y: 1.0 },
    { x: 1.2, y: -0.15 },
];

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function resizeItems(items, fitScale, minWidth = 80, minHeight = 60) {
    items.forEach(item => {
        item.w = Math.max(minWidth, Math.round(item.w * fitScale));
        item.h = Math.max(minHeight, Math.round(item.h * fitScale));
    });
}

export function isStoryboardContentItem(item) {
    return Boolean(item) && item.type !== "frame" && item.type !== "palette";
}

export function isStoryboardTiltableItem(item) {
    return Boolean(item) && ["image", "video", "slot", "note"].includes(item.type);
}

export function normalizeRotation(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(-25, Math.min(25, Math.round(numeric)));
}

export function getItemRotation(item) {
    if (!isStoryboardTiltableItem(item)) return 0;
    return normalizeRotation(item.rotation || 0);
}

export function setItemRotation(item, value) {
    if (!isStoryboardTiltableItem(item)) return 0;
    const normalized = normalizeRotation(value);
    if (normalized === 0) delete item.rotation;
    else item.rotation = normalized;
    return normalized;
}

export function getItemsBounds(items) {
    const validItems = (items || []).filter(Boolean);
    if (!validItems.length) return null;

    const minX = Math.min(...validItems.map(item => item.x));
    const minY = Math.min(...validItems.map(item => item.y));
    const maxX = Math.max(...validItems.map(item => item.x + item.w));
    const maxY = Math.max(...validItems.map(item => item.y + item.h));

    return {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
        minX,
        minY,
        maxX,
        maxY,
        centerX: minX + ((maxX - minX) / 2),
        centerY: minY + ((maxY - minY) / 2),
    };
}

export function arrangeItemsAsMoodboard(items, options = {}) {
    const contentItems = (items || []).filter(item => isStoryboardContentItem(item));
    if (contentItems.length < 2) return false;

    const {
        bounds = null,
        padding = 28,
        allowResize = false,
    } = options;

    const sortedItems = [...contentItems].sort((a, b) => (b.w * b.h) - (a.w * a.h));
    const count = sortedItems.length;
    const cols = Math.max(2, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / cols);

    const scatterOffsets = [
        { x: -0.18, y: -0.12 },
        { x: 0.16, y: -0.08 },
        { x: -0.10, y: 0.13 },
        { x: 0.19, y: 0.06 },
        { x: -0.15, y: 0.17 },
        { x: 0.08, y: 0.18 },
        { x: -0.06, y: -0.18 },
        { x: 0.15, y: -0.01 },
    ];

    let maxW = Math.max(...sortedItems.map(item => item.w));
    let maxH = Math.max(...sortedItems.map(item => item.h));
    let cellW = Math.max(140, maxW * 0.8);
    let cellH = Math.max(120, maxH * 0.82);
    let layoutW = maxW + ((cols - 1) * cellW);
    let layoutH = maxH + ((rows - 1) * cellH);

    if (bounds && allowResize) {
        const availableW = Math.max(120, bounds.w - (padding * 2));
        const availableH = Math.max(120, bounds.h - (padding * 2));
        const fitScale = Math.min(1, availableW / Math.max(1, layoutW), availableH / Math.max(1, layoutH));
        if (fitScale < 1) {
            resizeItems(sortedItems, fitScale);
            maxW = Math.max(...sortedItems.map(item => item.w));
            maxH = Math.max(...sortedItems.map(item => item.h));
            cellW = Math.max(140, maxW * 0.8);
            cellH = Math.max(120, maxH * 0.82);
            layoutW = maxW + ((cols - 1) * cellW);
            layoutH = maxH + ((rows - 1) * cellH);
        }
    }

    let baseX;
    let baseY;
    if (bounds) {
        const availableW = Math.max(120, bounds.w - (padding * 2));
        const availableH = Math.max(120, bounds.h - (padding * 2));
        baseX = bounds.x + padding + Math.max(0, (availableW - layoutW) / 2);
        baseY = bounds.y + padding + Math.max(0, (availableH - layoutH) / 2);
    } else {
        const sourceBounds = getItemsBounds(sortedItems);
        baseX = sourceBounds.centerX - (layoutW / 2);
        baseY = sourceBounds.centerY - (layoutH / 2);
    }

    const jitterX = Math.min(42, cellW * 0.18);
    const jitterY = Math.min(38, cellH * 0.16);

    sortedItems.forEach((item, index) => {
        const row = Math.floor(index / cols);
        const rowIndex = index % cols;
        const col = row % 2 === 0 ? rowIndex : (cols - 1 - rowIndex);
        const offset = scatterOffsets[index % scatterOffsets.length];
        const staggerY = (col % 2 === 0 ? -1 : 1) * cellH * 0.08;

        let x = baseX + (col * cellW) + ((maxW - item.w) / 2) + (offset.x * jitterX);
        let y = baseY + (row * cellH) + ((maxH - item.h) / 2) + (offset.y * jitterY) + staggerY;

        if (bounds) {
            const minX = bounds.x + padding;
            const maxX = (bounds.x + bounds.w) - padding - item.w;
            const minY = bounds.y + padding;
            const maxY = (bounds.y + bounds.h) - padding - item.h;
            x = Math.min(Math.max(x, minX), Math.max(minX, maxX));
            y = Math.min(Math.max(y, minY), Math.max(minY, maxY));
        }

        item.x = Math.round(x);
        item.y = Math.round(y);
        if (isStoryboardTiltableItem(item)) {
            const tilt = MOODBOARD_ROTATION_PATTERN[index % MOODBOARD_ROTATION_PATTERN.length];
            setItemRotation(item, tilt);
        }
    });

    return true;
}

export function arrangeItemsAsStoryStrip(items, options = {}) {
    const contentItems = (items || []).filter(item => isStoryboardContentItem(item));
    if (contentItems.length < 2) return false;

    const {
        bounds = null,
        padding = 28,
        gap = 26,
        allowResize = false,
    } = options;

    const sortedItems = [...contentItems].sort((a, b) => {
        if (Math.abs(a.y - b.y) > 40) return a.y - b.y;
        return a.x - b.x;
    });

    let totalW = sortedItems.reduce((sum, item) => sum + item.w, 0) + ((sortedItems.length - 1) * gap);
    let maxH = Math.max(...sortedItems.map(item => item.h));

    if (bounds && allowResize) {
        const availableW = Math.max(120, bounds.w - (padding * 2));
        const availableH = Math.max(80, bounds.h - (padding * 2));
        const fitScale = Math.min(1, availableW / Math.max(1, totalW), availableH / Math.max(1, maxH));
        if (fitScale < 1) {
            resizeItems(sortedItems, fitScale);
            totalW = sortedItems.reduce((sum, item) => sum + item.w, 0) + ((sortedItems.length - 1) * gap);
            maxH = Math.max(...sortedItems.map(item => item.h));
        }
    }

    let startX;
    let rowY;
    if (bounds) {
        const availableW = Math.max(120, bounds.w - (padding * 2));
        const availableH = Math.max(80, bounds.h - (padding * 2));
        startX = bounds.x + padding + Math.max(0, (availableW - totalW) / 2);
        rowY = bounds.y + padding + Math.max(0, (availableH - maxH) / 2);
    } else {
        const sourceBounds = getItemsBounds(sortedItems);
        startX = sourceBounds.centerX - (totalW / 2);
        rowY = sourceBounds.centerY - (maxH / 2);
    }

    let cursorX = startX;
    sortedItems.forEach(item => {
        item.x = Math.round(cursorX);
        item.y = Math.round(rowY + ((maxH - item.h) / 2));
        setItemRotation(item, 0);
        cursorX += item.w + gap;
    });

    return true;
}

export function arrangeItemsAsStack(items, options = {}) {
    const contentItems = (items || []).filter(item => isStoryboardContentItem(item));
    if (contentItems.length < 2) return false;

    const {
        bounds = null,
        padding = 28,
        allowResize = false,
    } = options;

    const sortedItems = [...contentItems].sort((a, b) => (b.w * b.h) - (a.w * a.h));
    const sourceBounds = getItemsBounds(sortedItems);
    if (!sourceBounds) return false;

    if (bounds && allowResize) {
        const availableW = Math.max(120, bounds.w - (padding * 2));
        const availableH = Math.max(120, bounds.h - (padding * 2));
        const fitScale = Math.min(1, availableW / Math.max(1, sourceBounds.w * 1.2), availableH / Math.max(1, sourceBounds.h * 1.2));
        if (fitScale < 1) {
            resizeItems(sortedItems, fitScale);
        }
    }

    const currentBounds = getItemsBounds(sortedItems);
    const centerX = bounds ? bounds.x + (bounds.w / 2) : currentBounds.centerX;
    const centerY = bounds ? bounds.y + (bounds.h / 2) : currentBounds.centerY;
    const offsetStepX = Math.min(26, Math.max(12, currentBounds.w * 0.05));
    const offsetStepY = Math.min(22, Math.max(10, currentBounds.h * 0.05));

    sortedItems.forEach((item, index) => {
        const offset = STACK_OFFSET_PATTERN[index % STACK_OFFSET_PATTERN.length];
        let x = centerX - (item.w / 2) + (offset.x * offsetStepX);
        let y = centerY - (item.h / 2) + (offset.y * offsetStepY);

        if (bounds) {
            const minX = bounds.x + padding;
            const maxX = bounds.x + bounds.w - padding - item.w;
            const minY = bounds.y + padding;
            const maxY = bounds.y + bounds.h - padding - item.h;
            x = clamp(x, minX, Math.max(minX, maxX));
            y = clamp(y, minY, Math.max(minY, maxY));
        }

        item.x = Math.round(x);
        item.y = Math.round(y);
        if (isStoryboardTiltableItem(item)) {
            const tilt = STACK_ROTATION_PATTERN[index % STACK_ROTATION_PATTERN.length];
            setItemRotation(item, tilt);
        }
    });

    return true;
}

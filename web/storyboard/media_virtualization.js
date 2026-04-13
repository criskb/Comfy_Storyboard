import { itemIntersectsWorldRect } from "./selection_utils.js";

export const STORYBOARD_MEDIA_PRELOAD_MARGIN_PX = 960;
export const STORYBOARD_MEDIA_MIN_MARGIN_WORLD = 280;
export const STORYBOARD_MEDIA_RETAIN_MARGIN_MULTIPLIER = 1.35;
export const STORYBOARD_MEDIA_ACTIVATION_BATCH_SIZE = 6;
export const STORYBOARD_MEDIA_PREWARM_MARGIN_PX = 2200;

export function isStoryboardMediaItem(item) {
    return item?.type === "image" || item?.type === "video";
}

export function getStoryboardViewportWorldRect({ offset, scale, width, height }) {
    const safeScale = Math.max(0.0001, Number(scale) || 1);
    return {
        x: -(Number(offset?.x) || 0) / safeScale,
        y: -(Number(offset?.y) || 0) / safeScale,
        w: Math.max(1, (Number(width) || 1) / safeScale),
        h: Math.max(1, (Number(height) || 1) / safeScale),
    };
}

export function expandStoryboardWorldRect(rect, marginX, marginY = marginX) {
    return {
        x: rect.x - marginX,
        y: rect.y - marginY,
        w: rect.w + (marginX * 2),
        h: rect.h + (marginY * 2),
    };
}

export function getStoryboardMediaActivationRect(viewportRect, options = {}) {
    const scale = Math.max(0.0001, Number(options.scale) || 1);
    const marginPx = Math.max(0, Number(options.marginPx) || STORYBOARD_MEDIA_PRELOAD_MARGIN_PX);
    const minMarginWorld = Math.max(0, Number(options.minMarginWorld) || STORYBOARD_MEDIA_MIN_MARGIN_WORLD);
    const worldMargin = Math.max(minMarginWorld, marginPx / scale);
    return expandStoryboardWorldRect(viewportRect, worldMargin);
}

export function shouldActivateStoryboardMedia(item, viewportRect, options = {}) {
    if (!isStoryboardMediaItem(item)) return true;
    if (!viewportRect) return true;
    if (options.forceActivate) return true;
    if (Array.isArray(options.forceActiveIds) && options.forceActiveIds.includes(item.id)) return true;
    const retainMultiplier = Math.max(1, Number(options.retainMarginMultiplier) || STORYBOARD_MEDIA_RETAIN_MARGIN_MULTIPLIER);
    const activationRect = getStoryboardMediaActivationRect(
        viewportRect,
        options.currentActive
            ? {
                ...options,
                marginPx: (Number(options.marginPx) || STORYBOARD_MEDIA_PRELOAD_MARGIN_PX) * retainMultiplier,
                minMarginWorld: (Number(options.minMarginWorld) || STORYBOARD_MEDIA_MIN_MARGIN_WORLD) * retainMultiplier,
            }
            : options,
    );
    return itemIntersectsWorldRect(item, activationRect);
}

export function getStoryboardMediaViewportDistance(item, viewportRect) {
    if (!item || !viewportRect) return Number.POSITIVE_INFINITY;
    const itemLeft = Number(item.x) || 0;
    const itemTop = Number(item.y) || 0;
    const itemRight = itemLeft + Math.max(1, Number(item.w) || 1);
    const itemBottom = itemTop + Math.max(1, Number(item.h) || 1);
    const rectRight = viewportRect.x + viewportRect.w;
    const rectBottom = viewportRect.y + viewportRect.h;

    const dx = itemRight < viewportRect.x
        ? viewportRect.x - itemRight
        : itemLeft > rectRight
            ? itemLeft - rectRight
            : 0;
    const dy = itemBottom < viewportRect.y
        ? viewportRect.y - itemBottom
        : itemTop > rectBottom
            ? itemTop - rectBottom
            : 0;

    return (dx * dx) + (dy * dy);
}

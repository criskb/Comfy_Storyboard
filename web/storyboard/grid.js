import { clampGridSpacing, normalizeStoryboardSettings, snapValueToGrid } from "./settings.js";

function getModuloOffset(value, spacing) {
    const normalized = value % spacing;
    return normalized < 0 ? normalized + spacing : normalized;
}

export function getGridOverlayStyles(scale, offset, settings) {
    const resolved = normalizeStoryboardSettings(settings);
    const scaledSpacing = Math.max(6, clampGridSpacing(resolved.grid_spacing) * Math.max(0.15, scale || 1));
    const offsetX = getModuloOffset(offset?.x || 0, scaledSpacing);
    const offsetY = getModuloOffset(offset?.y || 0, scaledSpacing);
    const dotOffsetX = getModuloOffset((offset?.x || 0) + (scaledSpacing / 2), scaledSpacing);
    const dotOffsetY = getModuloOffset((offset?.y || 0) + (scaledSpacing / 2), scaledSpacing);

    return {
        visible: resolved.grid,
        backgroundSize: [
            `${scaledSpacing}px ${scaledSpacing}px`,
            `${scaledSpacing}px ${scaledSpacing}px`,
            `${scaledSpacing}px ${scaledSpacing}px`,
        ].join(", "),
        backgroundPosition: [
            `${offsetX}px ${offsetY}px`,
            `${offsetX}px ${offsetY}px`,
            `${dotOffsetX}px ${dotOffsetY}px`,
        ].join(", "),
    };
}

export function snapPointToGrid(point, settings) {
    return {
        x: snapValueToGrid(point.x, settings),
        y: snapValueToGrid(point.y, settings),
    };
}

export function snapSizeToGrid(size, settings) {
    return {
        w: Math.max(50, snapValueToGrid(size.w, settings)),
        h: Math.max(50, snapValueToGrid(size.h, settings)),
    };
}

import { STORYBOARD_DESIGN_SYSTEM } from "./design_system.js";

export const DEFAULT_STORYBOARD_SETTINGS = {
    snap: true,
    grid: false,
    grid_spacing: STORYBOARD_DESIGN_SYSTEM.spacing.gridDefault,
    auto_receive_generated: true,
    show_prompt: true,
    show_minimap: true,
    show_inspector: true,
};

export function clampGridSpacing(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return STORYBOARD_DESIGN_SYSTEM.spacing.gridDefault;
    return Math.max(
        STORYBOARD_DESIGN_SYSTEM.spacing.gridMin,
        Math.min(STORYBOARD_DESIGN_SYSTEM.spacing.gridMax, Math.round(numeric)),
    );
}

export function normalizeStoryboardSettings(settings) {
    const merged = {
        ...DEFAULT_STORYBOARD_SETTINGS,
        ...(settings && typeof settings === "object" ? settings : {}),
    };
    merged.snap = Boolean(merged.snap);
    merged.grid = Boolean(merged.grid);
    merged.auto_receive_generated = Boolean(merged.auto_receive_generated);
    merged.show_prompt = Boolean(merged.show_prompt);
    merged.show_minimap = Boolean(merged.show_minimap);
    merged.show_inspector = Boolean(merged.show_inspector);
    merged.grid_spacing = clampGridSpacing(merged.grid_spacing);
    return merged;
}

export function snapValueToGrid(value, settings) {
    const resolved = normalizeStoryboardSettings(settings);
    if (!resolved.snap) return value;
    return Math.round(value / resolved.grid_spacing) * resolved.grid_spacing;
}

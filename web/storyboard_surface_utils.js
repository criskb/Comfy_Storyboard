const MEDIA_PRESENTATION_VALUES = new Set(["clean", "panel", "polaroid"]);
const FRAME_PRESENTATION_VALUES = new Set(["outline", "board", "spotlight"]);

export const MEDIA_PRESENTATION_OPTIONS = [
    { value: "clean", label: "Clean" },
    { value: "panel", label: "Story Panel" },
    { value: "polaroid", label: "Polaroid" },
];

export const FRAME_PRESENTATION_OPTIONS = [
    { value: "outline", label: "Outline" },
    { value: "board", label: "Board Card" },
    { value: "spotlight", label: "Spotlight" },
];

export function isMediaPresentationItem(item) {
    return Boolean(item) && (item.type === "image" || item.type === "video");
}

export function getMediaPresentation(item) {
    if (!isMediaPresentationItem(item)) return "clean";
    const value = typeof item.media_presentation === "string" ? item.media_presentation.trim().toLowerCase() : "";
    if (MEDIA_PRESENTATION_VALUES.has(value)) return value;
    return "clean";
}

export function setMediaPresentation(item, value) {
    if (!isMediaPresentationItem(item)) return "clean";
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    const resolved = MEDIA_PRESENTATION_VALUES.has(normalized) ? normalized : "clean";
    if (resolved === "clean") delete item.media_presentation;
    else item.media_presentation = resolved;
    return resolved;
}

export function getMediaCaptionText(item, presentation = null) {
    const resolvedPresentation = presentation || getMediaPresentation(item);
    const label = (item?.label || "").trim();
    const tags = (item?.tags || []).filter(Boolean);

    if (label) return label;
    if (resolvedPresentation === "polaroid") {
        return tags.length ? `#${tags[0]}` : "";
    }
    if (!tags.length) return "";
    return tags.slice(0, 3).map(tag => `#${tag}`).join("  ");
}

export function isFramePresentationItem(item) {
    return Boolean(item) && item.type === "frame";
}

export function getFramePresentation(item) {
    if (!isFramePresentationItem(item)) return "outline";
    const value = typeof item.frame_presentation === "string" ? item.frame_presentation.trim().toLowerCase() : "";
    if (FRAME_PRESENTATION_VALUES.has(value)) return value;
    return "outline";
}

export function setFramePresentation(item, value) {
    if (!isFramePresentationItem(item)) return "outline";
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    const resolved = FRAME_PRESENTATION_VALUES.has(normalized) ? normalized : "outline";
    if (resolved === "outline") delete item.frame_presentation;
    else item.frame_presentation = resolved;
    return resolved;
}

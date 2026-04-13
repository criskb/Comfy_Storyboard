function getDataTransferTypes(dataTransfer) {
    if (!dataTransfer?.types) return [];
    return Array.from(dataTransfer.types);
}

export function hasStoryboardExternalDragPayload(dataTransfer) {
    if (!dataTransfer) return false;
    if (Array.isArray(dataTransfer.items) && dataTransfer.items.some((item) => item?.kind === "file")) {
        return true;
    }
    if (typeof dataTransfer.files?.length === "number" && dataTransfer.files.length > 0) {
        return true;
    }
    const types = getDataTransferTypes(dataTransfer);
    return types.includes("Files") || types.includes("text/uri-list");
}

export function eventTargetsStoryboardSurface(event, overlay) {
    if (!event || !overlay) return false;
    if (typeof event.composedPath === "function") {
        const path = event.composedPath();
        if (Array.isArray(path) && path.includes(overlay)) return true;
    }
    const target = event.target;
    return Boolean(target && typeof overlay.contains === "function" && overlay.contains(target));
}

export function shouldCaptureStoryboardDragEvent(event, overlay, isOpen = true) {
    if (!isOpen || !event || !overlay) return false;
    if (!eventTargetsStoryboardSurface(event, overlay)) return false;
    return hasStoryboardExternalDragPayload(event.dataTransfer);
}

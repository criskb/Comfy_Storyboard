const INVALID_BOARD_NAME_PATTERN = /[<>:"/\\|?*\u0000-\u001f]+/g;
const INVALID_FILE_TOKEN_PATTERN = /[^a-z0-9._-]+/gi;

export function sanitizeStoryboardBoardName(value, fallback = "storyboard") {
    const normalized = String(value ?? "")
        .replace(INVALID_BOARD_NAME_PATTERN, "-")
        .replace(/\s+/g, " ")
        .replace(/\s*-\s*/g, " - ")
        .replace(/^[- ]+|[- ]+$/g, "")
        .trim();
    return normalized || fallback;
}

export function sanitizeStoryboardFileToken(value, fallback = "storyboard") {
    const normalized = String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(INVALID_FILE_TOKEN_PATTERN, "-")
        .replace(/-+/g, "-")
        .replace(/^[-._]+|[-._]+$/g, "");
    return normalized || fallback;
}

export function createStoryboardPackageFilename(boardId, exportedAt = null) {
    const token = sanitizeStoryboardFileToken(boardId, "storyboard");
    const date = exportedAt ? new Date(exportedAt) : new Date();
    const stamp = Number.isFinite(date.getTime())
        ? date.toISOString().replace(/[:]/g, "-").replace(/\.\d+Z$/, "Z")
        : "export";
    return `${token}-${stamp}.storyboard.json`;
}

export function suggestStoryboardImportName(packageData, fallback = "Imported Storyboard") {
    const boardId = packageData?.board?.board_id;
    if (boardId) {
        return sanitizeStoryboardBoardName(`${boardId} Copy`, fallback);
    }
    return sanitizeStoryboardBoardName(fallback, "Imported Storyboard");
}

export function downloadStoryboardJsonFile(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

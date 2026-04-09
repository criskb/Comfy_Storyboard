export async function copyTextToClipboard(text) {
    if (!text) return false;
    const value = String(text);

    // Try modern async clipboard APIs first.
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch (err) {
            console.warn("Async clipboard writeText failed; trying fallback", err);
        }
    }

    if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== "undefined") {
        try {
            const blob = new Blob([value], { type: "text/plain" });
            const item = new ClipboardItem({ "text/plain": blob });
            await navigator.clipboard.write([item]);
            return true;
        } catch (err) {
            console.warn("Async clipboard write failed; trying fallback", err);
        }
    }

    // Legacy fallback for non-secure contexts or denied permissions.
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.setAttribute("readonly", "readonly");
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);

    const activeEl = document.activeElement;

    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);

    let success = false;
    try {
        success = document.execCommand("copy");
    } catch (err) {
        console.error("Legacy clipboard fallback failed", err);
    }

    document.body.removeChild(textArea);

    if (!success) {
        // Secondary legacy fallback: contentEditable + Selection API.
        const copyTarget = document.createElement("div");
        copyTarget.textContent = value;
        copyTarget.contentEditable = "true";
        copyTarget.style.position = "fixed";
        copyTarget.style.left = "-9999px";
        copyTarget.style.top = "0";
        copyTarget.style.opacity = "0";
        document.body.appendChild(copyTarget);

        const selection = window.getSelection();
        if (selection) {
            const range = document.createRange();
            range.selectNodeContents(copyTarget);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        try {
            success = document.execCommand("copy");
        } catch (err) {
            console.error("ContentEditable clipboard fallback failed", err);
        }

        if (selection) {
            selection.removeAllRanges();
        }
        document.body.removeChild(copyTarget);
    }

    if (activeEl && typeof activeEl.focus === "function") {
        activeEl.focus();
    }

    return success;
}

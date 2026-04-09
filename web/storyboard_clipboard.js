export async function copyTextToClipboard(text) {
    if (!text) return false;

    // Prefer async clipboard API when available.
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn("Async clipboard writeText failed; trying fallback", err);
        }

        try {
            const blob = new Blob([text], { type: "text/plain" });
            const item = new ClipboardItem({ "text/plain": blob });
            await navigator.clipboard.write([item]);
            return true;
        } catch (err) {
            console.warn("Async clipboard write failed; trying fallback", err);
        }
    }

    // Legacy fallback for non-secure contexts or denied permissions.
    const textArea = document.createElement("textarea");
    textArea.value = text;
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

    if (activeEl && typeof activeEl.focus === "function") {
        activeEl.focus();
    }

    return success;
}

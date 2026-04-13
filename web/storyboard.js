import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { createImageItem, createVideoItem } from "./storyboard_item_utils.js";
import { copyTextToClipboard } from "./storyboard_clipboard.js";
import { DEFAULT_FRAME_COLOR } from "./storyboard/design_system.js";
import { shouldCaptureStoryboardDragEvent } from "./storyboard/drag_guard.js";
import {
    getGridOverlayStyles,
    snapPointToGrid,
    snapSizeToGrid,
} from "./storyboard/grid.js";
import { normalizeStoryboardSettings, snapValueToGrid } from "./storyboard/settings.js";
import {
    createStoryboardCollection,
    getStoryboardCollectionItems,
    normalizeStoryboardCollections,
    storyboardCollectionMatchesSelection,
} from "./storyboard/collections.js";
import {
    createStoryboardHistorySignature,
    createStoryboardHistorySnapshot,
    parseStoryboardHistorySnapshot,
    pushStoryboardHistoryEntry,
} from "./storyboard/history.js";
import {
    STORYBOARD_MEDIA_ACTIVATION_BATCH_SIZE,
    STORYBOARD_MEDIA_PREWARM_MARGIN_PX,
    getStoryboardMediaActivationRect,
    getStoryboardMediaViewportDistance,
    getStoryboardViewportWorldRect,
    shouldActivateStoryboardMedia,
} from "./storyboard/media_virtualization.js";
import {
    filterStoryboardSelectionIds,
    getStoryboardHiddenItems,
    getStoryboardLockedItems,
    getStoryboardVisibleItems,
    isStoryboardItemEditable,
    isStoryboardItemHidden,
    isStoryboardItemLocked,
    normalizeStoryboardItemState,
    normalizeStoryboardItems,
} from "./storyboard/item_state.js";
import {
    cloneStoryboardItemsForPaste,
    getItemIdsIntersectingWorldRect,
    itemIntersectsWorldRect,
    normalizePixelRect,
    pixelRectExceedsThreshold,
    pixelRectToWorldRect,
} from "./storyboard/selection_utils.js";
import {
    isStoryboardCoreExtension,
    loadStoryboardExtensionFavorites,
    matchesStoryboardExtensionQuery,
    saveStoryboardExtensionFavorites,
    STORYBOARD_MAX_PINNED_EXTENSIONS,
} from "./storyboard/extension_picker.js";
import {
    createStoryboardPackageFilename,
    downloadStoryboardJsonFile,
    sanitizeStoryboardBoardName,
    suggestStoryboardImportName,
} from "./storyboard/board_portability.js";
import { createStoryboardExtensionRegistry } from "./storyboard/extensions/registry.js";
import { coreStoryboardExtensions } from "./storyboard/extensions/core/index.js";
import { customStoryboardExtensions } from "./storyboard/extensions/custom/index.js";
import {
    arrangeItemsAsMoodboard as arrangeMoodboardLayout,
    arrangeItemsAsStack as arrangeStackLayout,
    arrangeItemsAsStoryStrip as arrangeStoryStripLayout,
    getItemRotation as getStoryboardItemRotation,
    getItemsBounds as getStoryboardItemsBounds,
    isStoryboardContentItem,
    isStoryboardTiltableItem,
    normalizeRotation as normalizeStoryboardRotation,
    setItemRotation as setStoryboardItemRotation,
} from "./storyboard_layout_utils.js";
import {
    formatStoryboardSceneCode,
    sortItemsByStoryboardOrder,
} from "./storyboard_sequence_utils.js";
import {
    FRAME_PRESENTATION_OPTIONS,
    getMediaCaptionText,
    getFramePresentation as getStoryboardFramePresentation,
    getMediaPresentation as getStoryboardMediaPresentation,
    isFramePresentationItem,
    isMediaPresentationItem,
    MEDIA_PRESENTATION_OPTIONS,
    setFramePresentation as setStoryboardFramePresentation,
    setMediaPresentation as setStoryboardMediaPresentation,
} from "./storyboard_surface_utils.js";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const TOOLBAR_ICONS = {
    slot: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="4.5" width="15" height="15" rx="3"></rect>
            <path d="M12 8.5v7"></path>
            <path d="M8.5 12h7"></path>
        </svg>
    `,
    note: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 4.5h10a2.5 2.5 0 0 1 2.5 2.5v10L15.5 20H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5Z"></path>
            <path d="M15.5 20v-3h4"></path>
            <path d="M12 8.5v5"></path>
            <path d="M9.5 11h5"></path>
        </svg>
    `,
    frame: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="6" width="15" height="12" rx="2.5"></rect>
            <path d="M12 9v6"></path>
            <path d="M9 12h6"></path>
        </svg>
    `,
    delete: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4.5 7.5h15"></path>
            <path d="M9.5 4.5h5"></path>
            <path d="M8 7.5v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-10"></path>
            <path d="M10 10.5v5"></path>
            <path d="M14 10.5v5"></path>
        </svg>
    `,
    settings: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3.2"></circle>
            <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.1a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.1a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.1a1 1 0 0 0 .6.9h.1a1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.1a1 1 0 0 0-.9.6Z"></path>
        </svg>
    `,
    undo: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 7H4v5"></path>
            <path d="M4 12c1.8-3.8 5-6 9-6 4.7 0 8 3.3 8 8"></path>
        </svg>
    `,
    redo: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 7h5v5"></path>
            <path d="M20 12c-1.8-3.8-5-6-9-6-4.7 0-8 3.3-8 8"></path>
        </svg>
    `,
    themeSystem: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v18"></path>
            <path d="M12 5a7 7 0 0 1 0 14"></path>
            <path d="M12 5a7 7 0 0 0 0 14"></path>
        </svg>
    `,
    themeLight: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2.5v3"></path>
            <path d="M12 18.5v3"></path>
            <path d="M4.93 4.93l2.12 2.12"></path>
            <path d="M16.95 16.95l2.12 2.12"></path>
            <path d="M2.5 12h3"></path>
            <path d="M18.5 12h3"></path>
            <path d="M4.93 19.07l2.12-2.12"></path>
            <path d="M16.95 7.05l2.12-2.12"></path>
        </svg>
    `,
    themeDark: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 14.5A7.5 7.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"></path>
        </svg>
    `,
    moodTag: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h8l3.5 3.5v8A2.5 2.5 0 0 1 16.5 19h-9A2.5 2.5 0 0 1 5 16.5Z"></path>
            <path d="M9 10h6"></path>
            <path d="M9 13.5h4"></path>
        </svg>
    `,
    shotCard: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="5" width="15" height="14" rx="3"></rect>
            <path d="M8 9h8"></path>
            <path d="M8 12.5h5"></path>
            <path d="M8 16h8"></path>
        </svg>
    `,
    storyBeat: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="4.5" width="15" height="15" rx="3"></rect>
            <path d="M8 8.5h8"></path>
            <path d="M8 12h8"></path>
            <path d="M8 15.5h5"></path>
        </svg>
    `,
    swatchStrip: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="7" width="15" height="10" rx="3"></rect>
            <path d="M8.5 7v10"></path>
            <path d="M12 7v10"></path>
            <path d="M15.5 7v10"></path>
        </svg>
    `,
    sceneDivider: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12h5"></path>
            <path d="M15 12h5"></path>
            <rect x="9" y="8.5" width="6" height="7" rx="3"></rect>
        </svg>
    `,
    demoPack: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="5" width="7" height="6" rx="2"></rect>
            <rect x="12.5" y="5" width="7" height="6" rx="2"></rect>
            <rect x="4.5" y="13" width="15" height="6" rx="2"></rect>
        </svg>
    `,
    promptCard: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="6" width="15" height="12" rx="2"></rect>
            <path d="M8 10h8"></path>
            <path d="M8 14h5"></path>
            <path d="M18 19.5v-4"></path>
        </svg>
    `,
    checklistCard: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 7.5h10"></path>
            <path d="M8 12h10"></path>
            <path d="M8 16.5h10"></path>
            <path d="M4.5 7.5 5.8 8.8 7.5 6.8"></path>
            <path d="M4.5 12 5.8 13.3 7.5 11.3"></path>
            <path d="M4.5 16.5 5.8 17.8 7.5 15.8"></path>
        </svg>
    `,
    referenceBasket: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5.5 9h13l-1 9h-11z"></path>
            <path d="M9 9 12 5.5 15 9"></path>
            <path d="M9 13.5h6"></path>
        </svg>
    `,
    characterCard: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="3"></circle>
            <path d="M6.5 18.5c1.6-3 3.5-4.5 5.5-4.5s3.9 1.5 5.5 4.5"></path>
            <path d="M4.5 5.5v13"></path>
        </svg>
    `,
    locationCard: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20s5-5.5 5-9.2A5 5 0 1 0 7 10.8C7 14.5 12 20 12 20Z"></path>
            <circle cx="12" cy="10" r="1.8"></circle>
        </svg>
    `,
    dialogueCard: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 7.5h8a3.5 3.5 0 0 1 3.5 3.5v4A3.5 3.5 0 0 1 14 18.5H10l-4 2v-5A3.5 3.5 0 0 1 2.5 12V11A3.5 3.5 0 0 1 6 7.5Z"></path>
            <path d="M8 12h4"></path>
            <path d="M8 15h6"></path>
        </svg>
    `,
    cameraMove: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="7" width="6.5" height="10" rx="2"></rect>
            <path d="M13.5 9.5h4"></path>
            <path d="M15.5 7.5l2 2-2 2"></path>
            <path d="M13.5 14.5h4"></path>
            <path d="M15.5 12.5l2 2-2 2"></path>
        </svg>
    `,
    lightingCue: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3.5 7 11h3l-1 9 5-7.5h-3l1-9Z"></path>
            <path d="M5 19.5h14"></path>
        </svg>
    `,
    propCard: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="6" width="15" height="12" rx="3"></rect>
            <path d="M9 10h6"></path>
            <path d="M12 6v12"></path>
        </svg>
    `,
    soundCue: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 14h2"></path>
            <path d="M8 10v8"></path>
            <path d="M12 7v14"></path>
            <path d="M16 10v8"></path>
            <path d="M20 14h-2"></path>
        </svg>
    `,
    transitionCard: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4.5 12h11"></path>
            <path d="M12.5 8.5 16 12l-3.5 3.5"></path>
            <path d="M18 6v12"></path>
        </svg>
    `,
    wardrobeCard: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6.5 10.5 4h3L16 6.5"></path>
            <path d="M7 20V9l2.5-2.5"></path>
            <path d="M17 20V9l-2.5-2.5"></path>
            <path d="M9.5 6.5 12 9l2.5-2.5"></path>
        </svg>
    `,
    lensCard: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="6.5"></circle>
            <circle cx="12" cy="12" r="2.5"></circle>
            <path d="M19 8.5 21 6.5"></path>
        </svg>
    `,
    setDressingCard: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="8" width="15" height="11" rx="2"></rect>
            <path d="M8 8V5.5"></path>
            <path d="M16 8V5.5"></path>
            <path d="M8 12h8"></path>
        </svg>
    `,
    hairMakeupNote: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 18.5c0-4 2.2-6.5 5-6.5s5 2.5 5 6.5"></path>
            <path d="M8 9.5c.8-2.5 2.2-4 4-4s3.2 1.5 4 4"></path>
            <path d="M12 12V9.5"></path>
        </svg>
    `,
    stuntNote: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 18.5 12 5.5l5 13"></path>
            <path d="M9 13h6"></path>
        </svg>
    `,
    continuityNote: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5.5 8.5h8"></path>
            <path d="M10.5 5.5 13.5 8.5l-3 3"></path>
            <path d="M18.5 15.5h-8"></path>
            <path d="M13.5 12.5 10.5 15.5l3 3"></path>
        </svg>
    `,
    productionNote: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="6" width="14" height="12.5" rx="2"></rect>
            <path d="M8 10h8"></path>
            <path d="M8 13.5h5"></path>
        </svg>
    `,
    vfxNote: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 4.5v4"></path>
            <path d="M12 15.5v4"></path>
            <path d="M4.5 12h4"></path>
            <path d="M15.5 12h4"></path>
            <circle cx="12" cy="12" r="3.5"></circle>
        </svg>
    `,
    graphicsNote: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4.5" y="6" width="15" height="12" rx="2"></rect>
            <path d="M8 10h8"></path>
            <path d="M8 14h4"></path>
            <path d="M15.5 14h.01"></path>
        </svg>
    `,
    blockingNote: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="7" cy="8" r="1.5"></circle>
            <circle cx="17" cy="16" r="1.5"></circle>
            <path d="M8.5 9.5 15.5 14.5"></path>
            <path d="M13 14.5h2.5v-2.5"></path>
        </svg>
    `,
    editorialCard: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 6.5h14"></path>
            <path d="M5 12h8"></path>
            <path d="M5 17.5h14"></path>
            <path d="M16 10.5 19 12l-3 1.5"></path>
        </svg>
    `,
    gradeCard: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 16.5 9 12l3 2.5 3-4 4 6"></path>
            <path d="M5 19.5h14"></path>
        </svg>
    `,
    picker: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="10.5" cy="10.5" r="5.5"></circle>
            <path d="M15 15l4.5 4.5"></path>
            <path d="M10.5 8v5"></path>
            <path d="M8 10.5h5"></path>
        </svg>
    `,
    pin: `
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 4.5h6"></path>
            <path d="M8 9.5h8"></path>
            <path d="M9.5 9.5v4.5l-2 2"></path>
            <path d="M14.5 9.5v4.5l2 2"></path>
            <path d="M12 15v5"></path>
        </svg>
    `,
};

const STORYBOARD_ITEM_INTERACTION_VERSION = "2026-04-11-drag-refresh";

// Load CSS
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = new URL("./storyboard.css", import.meta.url).href;
document.head.appendChild(link);

// Main Storyboard Workspace Extension
app.registerExtension({
    name: "Comfypencil.Storyboard",
    async setup() {
        const callback = (event) => {
            const detail = event.detail;
            console.log("Storyboard update event received:", detail);
            if (StoryboardWorkspace.instance) {
                if (!detail || !detail.board_id || StoryboardWorkspace.instance.boardId === detail.board_id) {
                    console.log("Reloading board:", detail?.board_id || "current");
                    StoryboardWorkspace.instance.loadBoard();
                }
            }
        };
        api.addEventListener("storyboard_update", callback);
    },
    async nodeCreated(node) {
        if (node.comfyClass === "Storyboard") {
            // Add custom button to the Storyboard node
            node.addWidget("button", "Open Storyboard", "open", () => {
                const boardId = node.widgets.find(w => w.name === "board_id")?.value || "default";
                StoryboardWorkspace.open(boardId, node);
            });
        }
    }
});

class StoryboardWorkspace {
    static instance = null;

    static open(boardId, node) {
        if (!this.instance) {
            this.instance = new StoryboardWorkspace();
        }
        this.instance.show(boardId, node);
    }

    constructor() {
        this.themeMode = this.normalizeThemeMode(localStorage.getItem("storyboard.themeMode"));
        this.systemThemeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
        this.fontOptions = this.getDefaultFontOptions();
        this.extensionRegistry = createStoryboardExtensionRegistry(coreStoryboardExtensions, customStoryboardExtensions);
        this.extensionFavorites = loadStoryboardExtensionFavorites(this.extensionRegistry.listToolbarExtensions());
        this.boardId = "default";
        this.node = null;
        this.boardData = null;
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.itemElements = new Map();
        this.minimapItemElements = new Map();
        this.itemLookup = new Map();
        this.visibleItemsCache = [];
        this.hiddenItemsCache = [];
        this.lockedItemsCache = [];
        this.worldBoundsBaseCache = null;
        this.isInteracting = false;
        this.mediaLoadQueue = [];
        this.mediaLoadsInFlight = new Set();
        this.mediaUnloadTimers = new Map();
        this.mediaPrewarmQueue = [];
        this.mediaPrewarmsInFlight = new Set();
        this.mediaPrewarmedSrcs = new Set();
        this.maxConcurrentMediaLoads = 8;
        this.maxConcurrentMediaPrewarms = 4;
        this.mediaDeactivationHoldUntil = 0;
        this.mediaDeactivationTimer = null;
        this.paletteCache = new Map(); // frameId -> colors[]
        this.paletteLoading = new Set(); // frameIds currently fetching
        this.internalClipboard = [];
        this.needsReload = false;
        this.viewportSaveTimer = null;
        this.selectionPreviewIds = null;
        this.historyUndoStack = [];
        this.historyRedoStack = [];
        this.historySnapshot = null;
        this.historySignature = null;
        this.isApplyingHistory = false;
        this.inspectorOpen = false;
        this.settingsOpen = false;
        this.extensionPickerOpen = false;
        this.extensionPickerStatus = "";
        this.chromeVisibilitySignature = "";
        this.inspectorRenderSignature = "";
        this.settingsPanelSignature = "";
        this.mediaActivationFrame = null;
        this.minimapFrame = null;
        this.createWindow();
        this.refreshFontOptions();
        this.handleStoryboardGlobalDragCapture = (event) => {
            if (!shouldCaptureStoryboardDragEvent(event, this.overlay, this.overlay?.style?.display === "flex")) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === "function") {
                event.stopImmediatePropagation();
            }
            if (event.type === "dragover" && event.dataTransfer) {
                event.dataTransfer.dropEffect = "copy";
            }
        };
        ["dragenter", "dragover", "drop"].forEach((eventName) => {
            window.addEventListener(eventName, this.handleStoryboardGlobalDragCapture, true);
        });

        // Global shortcuts
        window.addEventListener("keydown", (e) => {
            if (this.overlay.style.display === "flex") {
                if (e.key === "Escape") {
                    e.preventDefault();
                    if (this.extensionPickerOpen) {
                        this.closeExtensionPicker();
                        return;
                    }
                    this.hide();
                    return;
                }
                const focused = document.activeElement;
                if (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA" || focused.isContentEditable) return;

                if (e.key === "Delete") {
                    if (this.boardData.selection.length > 0) {
                        this.removeSelectedItems();
                    }
                } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
                    e.preventDefault();
                    void this.undoHistory();
                } else if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y")) {
                    e.preventDefault();
                    void this.redoHistory();
                } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
                    e.preventDefault();
                    this.handleCopy();
                } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
                    e.preventDefault();
                    this.handlePaste();
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
                    e.preventDefault();
                    this.selectAllItems();
                } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
                    e.preventDefault();
                    this.duplicateSelectedItems();
                }
            }
        });

        window.addEventListener("paste", (e) => {
            if (this.overlay.style.display === "flex") {
                const focused = document.activeElement;
                if (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA" || focused.isContentEditable) return;
                
                const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                for (let index in items) {
                    const item = items[index];
                    if (item.kind === 'file' && item.type.startsWith('image/')) {
                        const blob = item.getAsFile();
                        this.handlePasteImage(blob);
                    }
                }
            }
        });
    }

    getToolbarExtensions() {
        return this.extensionRegistry.listToolbarExtensions();
    }

    getExtensionToolbarLabel(extension) {
        return extension?.toolbar?.label || extension?.title || extension?.type || "Storyboard Item";
    }

    getExtensionToolbarTitle(extension) {
        return extension?.toolbar?.title || this.getExtensionToolbarLabel(extension);
    }

    getExtensionIconMarkup(extension) {
        const toolbar = extension?.toolbar || {};
        return toolbar.iconSvg || (toolbar.iconKey ? TOOLBAR_ICONS[toolbar.iconKey] : "") || "";
    }

    getExtensionPickerSubtitle(extension) {
        const kind = typeof extension?.createItem === "function" ? "Widget" : "Action";
        const section = extension?.toolbar?.section || "Insert";
        return `${section} · ${kind}`;
    }

    createToolbarExtensionButton(extension, extraClassName = "") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `storyboard-tool-btn storyboard-create-btn${extraClassName ? ` ${extraClassName}` : ""}`;
        button.title = this.getExtensionToolbarTitle(extension);
        const iconMarkup = this.getExtensionIconMarkup(extension);
        button.innerHTML = `
            ${iconMarkup ? `<span class="toolbar-glyph">${iconMarkup}</span>` : ""}
            <span>${this.getExtensionToolbarLabel(extension)}</span>
        `;
        button.onclick = () => {
            void this.runToolbarExtension(extension.type);
        };
        return button;
    }

    getCoreToolbarExtensions() {
        return this.getToolbarExtensions().filter((extension) => isStoryboardCoreExtension(extension));
    }

    getFavoriteToolbarExtensions() {
        const extensionsByType = new Map(
            this.getToolbarExtensions().map((extension) => [extension.type, extension]),
        );
        return this.extensionFavorites
            .map((type) => extensionsByType.get(type))
            .filter((extension) => extension && !isStoryboardCoreExtension(extension));
    }

    renderToolbarExtensions() {
        if (!this.coreToolbarRail || !this.favoriteToolbarRail) return;

        const coreButtons = this.getCoreToolbarExtensions().map((extension) => (
            this.createToolbarExtensionButton(extension)
        ));
        this.coreToolbarRail.replaceChildren(...coreButtons);

        const favoriteButtons = this.getFavoriteToolbarExtensions().map((extension) => {
            const button = this.createToolbarExtensionButton(extension, "storyboard-favorite-btn");
            button.title = `Pinned Favorite: ${this.getExtensionToolbarTitle(extension)}`;
            return button;
        });
        this.favoriteToolbarRail.replaceChildren(...favoriteButtons);
        this.favoriteToolbarRail.classList.toggle("has-items", favoriteButtons.length > 0);
    }

    setExtensionPickerStatus(message = "") {
        this.extensionPickerStatus = message;
        if (this.extensionPickerStatusEl) {
            this.extensionPickerStatusEl.textContent = this.extensionPickerStatus || "Click any node or widget to add it. Right-click to pin it to the top bar.";
        }
    }

    getFilteredPickerSections(query = "") {
        const favoriteSet = new Set(this.extensionFavorites);
        const favoriteOrder = new Map(this.extensionFavorites.map((type, index) => [type, index]));
        const sectionOrder = [];
        const sections = new Map();

        this.getToolbarExtensions()
            .filter((extension) => matchesStoryboardExtensionQuery(extension, query))
            .forEach((extension) => {
                const section = extension?.toolbar?.section || "Insert";
                if (!sections.has(section)) {
                    sections.set(section, []);
                    sectionOrder.push(section);
                }
                sections.get(section).push(extension);
            });

        return sectionOrder.map((section) => ({
            section,
            extensions: sections.get(section).slice().sort((left, right) => {
                const favoriteDelta = Number(favoriteSet.has(right.type)) - Number(favoriteSet.has(left.type));
                if (favoriteDelta) return favoriteDelta;
                if (favoriteSet.has(left.type) && favoriteSet.has(right.type)) {
                    return (favoriteOrder.get(left.type) ?? 0) - (favoriteOrder.get(right.type) ?? 0);
                }
                return this.getExtensionToolbarLabel(left).localeCompare(
                    this.getExtensionToolbarLabel(right),
                    undefined,
                    { sensitivity: "base" },
                );
            }),
        }));
    }

    createExtensionPickerItem(extension) {
        const button = document.createElement("button");
        button.type = "button";
        const isFavorite = this.extensionFavorites.includes(extension.type);
        const isCore = isStoryboardCoreExtension(extension);
        button.className = "storyboard-picker-item";
        button.classList.toggle("is-favorite", isFavorite);
        button.classList.toggle("is-core", isCore);
        button.title = `${this.getExtensionToolbarTitle(extension)}\nClick to add it. Right-click to ${isFavorite ? "unpin" : "pin"}.`;

        const iconMarkup = this.getExtensionIconMarkup(extension);
        const pinLabel = isCore ? "Core" : isFavorite ? "Pinned" : "Pin";
        button.innerHTML = `
            <span class="storyboard-picker-item-main">
                ${iconMarkup ? `<span class="toolbar-glyph">${iconMarkup}</span>` : ""}
                <span class="storyboard-picker-item-copy">
                    <span class="storyboard-picker-item-label">${this.getExtensionToolbarLabel(extension)}</span>
                    <span class="storyboard-picker-item-subtitle">${this.getExtensionPickerSubtitle(extension)}</span>
                </span>
            </span>
            <span class="storyboard-picker-item-pin" aria-hidden="true">
                <span class="toolbar-glyph">${TOOLBAR_ICONS.pin}</span>
                <span class="storyboard-picker-item-pin-label">${pinLabel}</span>
            </span>
        `;

        button.onclick = async () => {
            this.closeExtensionPicker();
            await this.runToolbarExtension(extension.type);
        };
        button.oncontextmenu = (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggleExtensionFavorite(extension.type);
        };
        return button;
    }

    renderExtensionPicker() {
        if (!this.extensionPickerList) return;
        const query = this.extensionPickerSearchInput?.value || "";
        const sections = this.getFilteredPickerSections(query);
        const fragment = document.createDocumentFragment();
        let resultCount = 0;

        sections.forEach(({ section, extensions }) => {
            if (!extensions.length) return;
            resultCount += extensions.length;

            const header = document.createElement("div");
            header.className = "storyboard-picker-section-header";
            header.textContent = section;
            fragment.appendChild(header);

            extensions.forEach((extension) => {
                fragment.appendChild(this.createExtensionPickerItem(extension));
            });
        });

        if (!resultCount) {
            const emptyState = document.createElement("div");
            emptyState.className = "storyboard-picker-empty";
            emptyState.textContent = "No nodes or widgets match that search.";
            fragment.appendChild(emptyState);
        }

        this.extensionPickerList.replaceChildren(fragment);
        if (this.extensionPickerMeta) {
            const resultLabel = `${resultCount} result${resultCount === 1 ? "" : "s"}`;
            this.extensionPickerMeta.textContent = `${resultLabel} • ${this.extensionFavorites.length}/${STORYBOARD_MAX_PINNED_EXTENSIONS} pinned`;
        }
        this.setExtensionPickerStatus(this.extensionPickerStatus);
    }

    toggleExtensionFavorite(type) {
        const extension = this.extensionRegistry.get(type);
        if (!extension) return false;

        const label = this.getExtensionToolbarLabel(extension);
        if (isStoryboardCoreExtension(extension)) {
            this.setExtensionPickerStatus(`${label} already stays pinned in the core toolbar.`);
            this.renderExtensionPicker();
            return false;
        }

        if (this.extensionFavorites.includes(type)) {
            this.extensionFavorites = saveStoryboardExtensionFavorites(
                this.extensionFavorites.filter((favoriteType) => favoriteType !== type),
                this.getToolbarExtensions(),
            );
            this.setExtensionPickerStatus(`${label} removed from the top bar.`);
            this.renderToolbarExtensions();
            this.renderExtensionPicker();
            return true;
        }

        if (this.extensionFavorites.length >= STORYBOARD_MAX_PINNED_EXTENSIONS) {
            this.setExtensionPickerStatus(`Top-bar favorites are full. Unpin one before adding ${label}.`);
            this.renderExtensionPicker();
            return false;
        }

        this.extensionFavorites = saveStoryboardExtensionFavorites(
            [...this.extensionFavorites, type],
            this.getToolbarExtensions(),
        );
        this.setExtensionPickerStatus(`${label} pinned to the top bar.`);
        this.renderToolbarExtensions();
        this.renderExtensionPicker();
        return true;
    }

    positionExtensionPicker({ anchorEl = null, clientX = null, clientY = null } = {}) {
        if (!this.window || !this.extensionPicker) return;
        const windowRect = this.window.getBoundingClientRect();
        let left = 18;
        let top = 72;

        if (anchorEl) {
            const anchorRect = anchorEl.getBoundingClientRect();
            left = anchorRect.left - windowRect.left;
            top = anchorRect.bottom - windowRect.top + 10;
        }

        if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
            left = clientX - windowRect.left + 12;
            top = clientY - windowRect.top + 12;
        }

        const pickerWidth = this.extensionPicker.offsetWidth || 360;
        const pickerHeight = this.extensionPicker.offsetHeight || 440;
        const maxLeft = Math.max(12, windowRect.width - pickerWidth - 12);
        const maxTop = Math.max(64, windowRect.height - pickerHeight - 12);

        this.extensionPicker.style.left = `${Math.min(maxLeft, Math.max(12, left))}px`;
        this.extensionPicker.style.top = `${Math.min(maxTop, Math.max(64, top))}px`;
    }

    openExtensionPicker(options = {}) {
        if (!this.extensionPicker) return;
        this.contextMenu.style.display = "none";
        this.extensionPickerOpen = true;
        this.extensionPicker.classList.add("open");
        if (this.extensionPickerSearchInput) {
            this.extensionPickerSearchInput.value = "";
        }
        this.setExtensionPickerStatus("");
        this.renderExtensionPicker();
        this.positionExtensionPicker(options);
        requestAnimationFrame(() => {
            this.positionExtensionPicker(options);
            this.extensionPickerSearchInput?.focus();
            this.extensionPickerSearchInput?.select();
        });
    }

    closeExtensionPicker() {
        if (!this.extensionPicker) return;
        this.extensionPickerOpen = false;
        this.extensionPicker.classList.remove("open");
        if (this.extensionPickerSearchInput) {
            this.extensionPickerSearchInput.value = "";
        }
        this.setExtensionPickerStatus("");
    }

    toggleExtensionPicker(options = {}) {
        if (this.extensionPickerOpen) {
            this.closeExtensionPicker();
            return;
        }
        this.openExtensionPicker(options);
    }

    isCanvasBackgroundTarget(target) {
        return target === this.canvas || target === this.canvasContainer || target === this.gridLayer;
    }

    createWindow() {
        this.overlay = document.createElement("div");
        this.overlay.className = "storyboard-overlay";
        this.overlay.style.display = "none";
        
        this.window = document.createElement("div");
        this.window.className = "storyboard-window";
        
        const header = document.createElement("div");
        header.className = "storyboard-header";
        header.innerHTML = `
            <div class="storyboard-header-left">
                <span>Storyboard:</span>
                <select id="storyboard-selector"></select>
                <button id="storyboard-refresh-board" class="board-action-btn board-icon-btn" title="Refresh Board" aria-label="Refresh Board">⟳</button>
                <button id="storyboard-new-board" class="board-action-btn" title="New Board">＋ New</button>
                <button id="storyboard-undo" class="board-action-btn board-icon-btn" title="Undo" aria-label="Undo">
                    <span class="toolbar-glyph">${TOOLBAR_ICONS.undo}</span>
                </button>
                <button id="storyboard-redo" class="board-action-btn board-icon-btn" title="Redo" aria-label="Redo">
                    <span class="toolbar-glyph">${TOOLBAR_ICONS.redo}</span>
                </button>
                <button id="storyboard-duplicate-board" class="board-action-btn" title="Duplicate Board">⧉ Copy</button>
                <button id="storyboard-rename-board" class="board-action-btn" title="Rename Board">✎ Rename</button>
                <button id="storyboard-delete-board" class="board-action-btn danger" title="Delete Board">
                    <span class="toolbar-glyph">${TOOLBAR_ICONS.delete}</span>
                    <span>Delete</span>
                </button>
            </div>
            <div class="storyboard-controls">
                <div class="storyboard-toolbar-rail">
                    <div id="storyboard-core-tools" class="storyboard-toolbar-group"></div>
                    <div id="storyboard-favorite-tools" class="storyboard-toolbar-group storyboard-toolbar-favorites"></div>
                </div>
                <button id="storyboard-open-picker" class="storyboard-tool-btn storyboard-create-btn" title="Open the node and widget picker">
                    <span class="toolbar-glyph">${TOOLBAR_ICONS.picker}</span>
                    <span>Add Node/Widget</span>
                </button>
                <button id="storyboard-settings-toggle" class="storyboard-tool-btn storyboard-create-btn" title="Storyboard Settings">
                    <span class="toolbar-glyph">${TOOLBAR_ICONS.settings}</span>
                    <span>Settings</span>
                </button>
                <button id="storyboard-theme-toggle" class="storyboard-tool-btn storyboard-create-btn storyboard-theme-toggle" title="Theme: System">
                    <span id="storyboard-theme-toggle-glyph" class="toolbar-glyph">${TOOLBAR_ICONS.themeSystem}</span>
                    <span id="storyboard-theme-toggle-label">System</span>
                </button>
                <button id="storyboard-close">✕</button>
            </div>
        `;
        
        const main = document.createElement("div");
        main.className = "storyboard-main";
        
        this.canvasContainer = document.createElement("div");
        this.canvasContainer.className = "storyboard-canvas-container";

        this.gridLayer = document.createElement("div");
        this.gridLayer.className = "storyboard-grid-layer";
        
        this.canvas = document.createElement("div");
        this.canvas.className = "storyboard-canvas";

        this.selectionMarquee = document.createElement("div");
        this.selectionMarquee.className = "storyboard-selection-marquee";
        this.selectionMarquee.style.display = "none";

        this.minimap = document.createElement("div");
        this.minimap.className = "storyboard-minimap";
        this.minimap.innerHTML = `
            <div class="storyboard-minimap-items"></div>
            <div class="storyboard-minimap-viewport"></div>
        `;
        this.minimapItems = this.minimap.querySelector(".storyboard-minimap-items");
        this.minimapViewport = this.minimap.querySelector(".storyboard-minimap-viewport");
        this.minimapView = null;

        this.minimapControls = document.createElement("div");
        this.minimapControls.className = "storyboard-minimap-controls";
        this.minimapControls.innerHTML = `
            <button id="storyboard-minimap-fit" title="Fit view to content">Fit</button>
            <button id="storyboard-minimap-center" title="Center on content">Center</button>
            <div class="storyboard-minimap-zoom">
                <button id="storyboard-minimap-zoom-out" title="Zoom out">−</button>
                <span id="storyboard-minimap-zoom-label">100%</span>
                <button id="storyboard-minimap-zoom-in" title="Zoom in">+</button>
            </div>
        `;
        
        this.inspector = document.createElement("div");
        this.inspector.className = "storyboard-inspector";
        this.inspector.innerHTML = `
            <div class="storyboard-inspector-header">
                <h3>Inspector</h3>
                <button id="storyboard-inspector-close" type="button">✕</button>
            </div>
            <div id="inspector-content">Select an item to see details</div>
        `;

        this.settingsPanel = document.createElement("div");
        this.settingsPanel.className = "storyboard-settings-panel";
        this.settingsPanel.innerHTML = `
            <div class="storyboard-settings-header">
                <h3>Settings</h3>
                <button id="storyboard-settings-close" type="button">✕</button>
            </div>
            <div class="storyboard-settings-section">
                <h4>Canvas</h4>
                <label class="storyboard-setting-row">
                    <span>Show Grid</span>
                    <input id="storyboard-setting-grid" type="checkbox">
                </label>
                <label class="storyboard-setting-row">
                    <span>Snap To Grid</span>
                    <input id="storyboard-setting-snap" type="checkbox">
                </label>
                <label class="storyboard-setting-row">
                    <span>Grid Spacing</span>
                    <input id="storyboard-setting-grid-spacing" type="number" min="8" max="256" step="1">
                </label>
            </div>
            <div class="storyboard-settings-section">
                <h4>Panels</h4>
                <label class="storyboard-setting-row">
                    <span>Show Prompt Bar</span>
                    <input id="storyboard-setting-show-prompt" type="checkbox">
                </label>
                <label class="storyboard-setting-row">
                    <span>Show Minimap</span>
                    <input id="storyboard-setting-show-minimap" type="checkbox">
                </label>
                <label class="storyboard-setting-row">
                    <span>Show Inspector</span>
                    <input id="storyboard-setting-show-inspector" type="checkbox">
                </label>
            </div>
        `;

        this.extensionPicker = document.createElement("div");
        this.extensionPicker.className = "storyboard-extension-picker";
        this.extensionPicker.innerHTML = `
            <div class="storyboard-picker-header">
                <div class="storyboard-picker-heading">
                    <h3>Node / Widget Picker</h3>
                    <p>Click an item to add it. Double-click empty canvas to open.</p>
                </div>
                <button id="storyboard-picker-close" type="button">✕</button>
            </div>
            <label class="storyboard-picker-search">
                <span class="toolbar-glyph">${TOOLBAR_ICONS.picker}</span>
                <input id="storyboard-picker-search" type="search" placeholder="Search nodes and widgets to add">
            </label>
            <div class="storyboard-picker-meta-row">
                <span id="storyboard-picker-meta">0 results</span>
                <span id="storyboard-picker-status">Click any node or widget to add it. Right-click to pin it to the top bar.</span>
            </div>
            <div id="storyboard-picker-list" class="storyboard-picker-list"></div>
        `;

        this.inspectorToggle = document.createElement("button");
        this.inspectorToggle.className = "storyboard-inspector-toggle";
        this.inspectorToggle.title = "Open Inspector";
        this.inspectorToggle.innerText = "☰";
        this.inspectorToggle.onclick = () => this.setInspectorOpen(!this.inspectorOpen);

        this.canvasContainer.appendChild(this.gridLayer);
        this.canvasContainer.appendChild(this.canvas);
        this.canvasContainer.appendChild(this.selectionMarquee);
        this.canvasContainer.appendChild(this.minimap);
        this.canvasContainer.appendChild(this.minimapControls);
        main.appendChild(this.canvasContainer);
        main.appendChild(this.inspector);
        main.appendChild(this.settingsPanel);
        main.appendChild(this.inspectorToggle);
        
        const footer = document.createElement("div");
        footer.className = "storyboard-footer";
        footer.classList.add("storyboard-floating-prompt");
        footer.innerHTML = `
            <textarea id="storyboard-prompt" placeholder="Enter prompt..."></textarea>
            <button id="storyboard-queue">Queue Prompt</button>
        `;

        this.window.appendChild(header);
        this.canvasContainer.appendChild(footer);
        this.window.appendChild(main);
        this.window.appendChild(this.extensionPicker);
        
        this.contextMenu = document.createElement("div");
        this.contextMenu.className = "storyboard-context-menu";
        this.contextMenu.style.display = "none";
        document.body.appendChild(this.contextMenu);
        
        this.overlay.appendChild(this.window);
        document.body.appendChild(this.overlay);

        this.slotFileInput = document.createElement("input");
        this.slotFileInput.type = "file";
        this.slotFileInput.accept = "image/*,video/*";
        this.slotFileInput.style.display = "none";
        document.body.appendChild(this.slotFileInput);

        this.boardPackageInput = document.createElement("input");
        this.boardPackageInput.type = "file";
        this.boardPackageInput.accept = ".json,.storyboard.json,application/json";
        this.boardPackageInput.style.display = "none";
        document.body.appendChild(this.boardPackageInput);
        this.boardPackageInput.onchange = async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
                await this.importBoardPackageFile(file);
            }
        };

        document.getElementById("storyboard-close").onclick = () => this.hide();
        this.coreToolbarRail = document.getElementById("storyboard-core-tools");
        this.favoriteToolbarRail = document.getElementById("storyboard-favorite-tools");
        this.openPickerButton = document.getElementById("storyboard-open-picker");
        this.themeToggleButton = document.getElementById("storyboard-theme-toggle");
        this.themeToggleGlyph = document.getElementById("storyboard-theme-toggle-glyph");
        this.themeToggleLabel = document.getElementById("storyboard-theme-toggle-label");
        this.undoButton = document.getElementById("storyboard-undo");
        this.redoButton = document.getElementById("storyboard-redo");
        this.extensionPickerSearchInput = document.getElementById("storyboard-picker-search");
        this.extensionPickerList = document.getElementById("storyboard-picker-list");
        this.extensionPickerMeta = document.getElementById("storyboard-picker-meta");
        this.extensionPickerStatusEl = document.getElementById("storyboard-picker-status");
        this.updateHistoryButtons();
        if (this.themeToggleButton) {
            this.themeToggleButton.onclick = () => this.cycleThemeMode();
        }
        if (this.openPickerButton) {
            this.openPickerButton.onclick = () => this.toggleExtensionPicker({ anchorEl: this.openPickerButton });
        }
        this.renderToolbarExtensions();
        this.renderExtensionPicker();
        this.applyThemeMode();
        if (this.systemThemeQuery?.addEventListener) {
            this.systemThemeQuery.addEventListener("change", () => {
                if (this.themeMode === "system") this.applyThemeMode();
            });
        }
        document.getElementById("storyboard-minimap-fit").onclick = () => this.fitViewToContent();
        document.getElementById("storyboard-minimap-center").onclick = () => this.centerOnContent();
        document.getElementById("storyboard-minimap-zoom-in").onclick = () => this.zoomAtCenter(1.15);
        document.getElementById("storyboard-minimap-zoom-out").onclick = () => this.zoomAtCenter(1 / 1.15);
        
        this.boardSelector = document.getElementById("storyboard-selector");
        this.boardSelector.onchange = (e) => this.show(e.target.value, this.node);

        document.getElementById("storyboard-refresh-board").onclick = () => this.loadBoard();
        if (this.undoButton) {
            this.undoButton.onclick = () => {
                void this.undoHistory();
            };
        }
        if (this.redoButton) {
            this.redoButton.onclick = () => {
                void this.redoHistory();
            };
        }

        document.getElementById("storyboard-new-board").onclick = async () => {
            const requestedName = prompt("Enter new storyboard name:");
            if (requestedName !== null) {
                const name = this.sanitizeBoardNameInput(requestedName, "Storyboard");
                this.show(name, this.node);
            }
        };

        document.getElementById("storyboard-duplicate-board").onclick = async () => {
            await this.duplicateCurrentBoard();
        };

        document.getElementById("storyboard-rename-board").onclick = async () => {
            const requestedName = prompt("Enter new name for this storyboard:", this.boardId);
            const newName = this.sanitizeBoardNameInput(requestedName, this.boardId);
            if (requestedName !== null && newName !== this.boardId) {
                const response = await fetch(
                    `/mkr/storyboard/${encodeURIComponent(this.boardId)}/rename/${encodeURIComponent(newName)}`,
                    { method: "POST" },
                );
                const result = await response.json();
                if (result.status === "ok") {
                    this.show(newName, this.node);
                } else {
                    alert("Rename failed. Name might already exist.");
                }
            }
        };

        document.getElementById("storyboard-delete-board").onclick = async () => {
            if (confirm(`Delete storyboard "${this.boardId}"?\n\nChoose OK for Yes, or Cancel for No. This cannot be undone.`)) {
                const response = await fetch(`/mkr/storyboard/${this.boardId}`, { method: "DELETE" });
                const result = await response.json();
                if (result.status === "ok") {
                    this.show("default", this.node);
                }
            }
        };

        const settingsToggleButton = document.getElementById("storyboard-settings-toggle");
        if (settingsToggleButton) {
            settingsToggleButton.onclick = () => this.setSettingsOpen(!this.settingsOpen);
        }
        const settingsCloseButton = document.getElementById("storyboard-settings-close");
        if (settingsCloseButton) {
            settingsCloseButton.onclick = () => this.setSettingsOpen(false);
        }
        const inspectorCloseButton = document.getElementById("storyboard-inspector-close");
        if (inspectorCloseButton) {
            inspectorCloseButton.onclick = () => this.setInspectorOpen(false);
        }
        const pickerCloseButton = document.getElementById("storyboard-picker-close");
        if (pickerCloseButton) {
            pickerCloseButton.onclick = () => this.closeExtensionPicker();
        }
        if (this.extensionPickerSearchInput) {
            this.extensionPickerSearchInput.oninput = () => this.renderExtensionPicker();
            this.extensionPickerSearchInput.onkeydown = (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    const firstResult = this.extensionPickerList?.querySelector(".storyboard-picker-item");
                    if (firstResult) firstResult.click();
                } else if (event.key === "Escape") {
                    event.preventDefault();
                    this.closeExtensionPicker();
                }
            };
        }
        this.bindSettingsPanel();

        const promptEl = document.getElementById("storyboard-prompt");
        promptEl.oninput = () => {
            if (this.node) {
                const promptWidget = this.node.widgets.find(w => w.name === "prompt");
                if (promptWidget) {
                    promptWidget.value = promptEl.value;
                }
            }
        };

        document.getElementById("storyboard-queue").onclick = () => {
            app.queuePrompt(0);
        };

        this.setupInteractions();
        this.setInspectorOpen(false);
    }

    promptImportForSlot(itemId) {
        const input = this.slotFileInput;
        if (!input) return;
        input.value = "";
        input.onchange = async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const item = this.getItemById(itemId);
            if (!item || item.type !== "slot" || this.isItemLocked(item)) return;
            try {
                await this.importFileIntoSlot(item, file);
            } catch (err) {
                console.error("Slot import failed:", err);
                alert("Failed to import file into slot.");
            }
        };
        input.click();
    }

    async importFileIntoSlot(item, file) {
        const formData = new FormData();
        const isImage = file.type.startsWith("image/");
        if (isImage) formData.append("image", file);
        else formData.append("asset", file);

        const response = await fetch(`/mkr/storyboard/${this.boardId}/upload`, {
            method: "POST",
            body: formData
        });
        if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
        const result = await response.json();
        if (!result.filename) throw new Error("Upload response missing filename");

        if (isImage) {
            const sourceW = Number(result.width) || item.w || 512;
            const sourceH = Number(result.height) || item.h || 512;
            const aspect = sourceW / Math.max(1, sourceH);
            const currentW = Math.max(50, Number(item.w) || 512);
            item.type = "image";
            item.image_ref = result.filename;
            item.image_width = sourceW;
            item.image_height = sourceH;
            item.aspect = aspect;
            item.h = Math.max(50, Math.round(currentW / aspect));
            item.w = currentW;
            item.label = item.label || file.name || "Imported Image";
            delete item.video_ref;
        } else {
            const videoSize = await new Promise((resolve) => {
                const probe = document.createElement("video");
                const objectUrl = URL.createObjectURL(file);
                probe.preload = "metadata";
                probe.onloadedmetadata = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve({ w: probe.videoWidth || 640, h: probe.videoHeight || 360 });
                };
                probe.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve({ w: 640, h: 360 });
                };
                probe.src = objectUrl;
            });
            const aspect = videoSize.w / Math.max(1, videoSize.h);
            const currentW = Math.max(50, Number(item.w) || 512);
            item.type = "video";
            item.video_ref = result.filename;
            item.image_width = videoSize.w;
            item.image_height = videoSize.h;
            item.aspect = aspect;
            item.h = Math.max(50, Math.round(currentW / aspect));
            item.w = currentW;
            item.label = item.label || file.name || "Imported Video";
            delete item.image_ref;
            delete item.crop;
        }
        this.renderBoard();
        await this.saveBoard();
    }

    async createStoryboardItemFromDroppedFile(file, worldX, worldY, options = {}) {
        if (!file) return null;
        const label = options.label || file.name || (file.type.startsWith("video/") ? "Dropped Video" : "Dropped Image");

        if (file.type.startsWith("image/")) {
            const formData = new FormData();
            formData.append("image", file);

            const response = await fetch(`/mkr/storyboard/${this.boardId}/upload`, {
                method: "POST",
                body: formData,
            });
            const result = await response.json();
            if (!result.filename) return null;

            return createImageItem({
                x: worldX,
                y: worldY,
                imageRef: result.filename,
                label,
                imageWidth: result.width,
                imageHeight: result.height,
                generateId: () => this.generateUUID(),
            });
        }

        if (file.type.startsWith("video/")) {
            const formData = new FormData();
            formData.append("asset", file);

            const response = await fetch(`/mkr/storyboard/${this.boardId}/upload`, {
                method: "POST",
                body: formData,
            });
            const result = await response.json();
            if (!result.filename) return null;

            const videoSize = await new Promise((resolve) => {
                const probe = document.createElement("video");
                const objectUrl = URL.createObjectURL(file);
                probe.preload = "metadata";
                probe.onloadedmetadata = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve({ w: probe.videoWidth || 640, h: probe.videoHeight || 360 });
                };
                probe.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve({ w: 640, h: 360 });
                };
                probe.src = objectUrl;
            });

            return createVideoItem({
                x: worldX,
                y: worldY,
                videoRef: result.filename,
                label,
                videoWidth: videoSize.w,
                videoHeight: videoSize.h,
                generateId: () => this.generateUUID(),
            });
        }

        return null;
    }

    ensureBoardSettings() {
        if (!this.boardData) {
            this.boardData = {
                board_id: this.boardId,
                viewport: { x: 0, y: 0, zoom: 1 },
                items: [],
                groups: [],
                selection: [],
                settings: normalizeStoryboardSettings(),
            };
        }
        if (!this.boardData.viewport || typeof this.boardData.viewport !== "object") {
            this.boardData.viewport = { x: 0, y: 0, zoom: 1 };
        }
        if (!Array.isArray(this.boardData.items)) this.boardData.items = [];
        if (!Array.isArray(this.boardData.selection)) this.boardData.selection = [];
        this.boardData.settings = normalizeStoryboardSettings(this.boardData.settings);
        this.ensureBoardCollections();
        return this.boardData.settings;
    }

    getBoardSettings() {
        return this.ensureBoardSettings();
    }

    ensureBoardCollections() {
        if (!this.boardData) return [];
        this.boardData.groups = normalizeStoryboardCollections(this.boardData.groups, this.boardData.items, {
            generateId: () => this.generateUUID(),
        });
        return this.boardData.groups;
    }

    normalizeBoardItemStates(options = {}) {
        if (!this.boardData) return;
        normalizeStoryboardItems(this.boardData.items, options);
        const items = this.boardData.items || [];
        this.boardData.selection = filterStoryboardSelectionIds(this.boardData.selection, items);
        this.itemLookup = new Map(items.filter((item) => item?.id).map((item) => [item.id, item]));
        this.visibleItemsCache = getStoryboardVisibleItems(items);
        this.hiddenItemsCache = getStoryboardHiddenItems(items);
        this.lockedItemsCache = getStoryboardLockedItems(items);
    }

    getItemById(itemId) {
        return this.itemLookup.get(itemId) || null;
    }

    getSelectedItems() {
        return (this.boardData?.selection || [])
            .map((itemId) => this.itemLookup.get(itemId))
            .filter((item) => item && !this.isItemHidden(item));
    }

    getVisibleBoardItems() {
        return this.visibleItemsCache;
    }

    getHiddenBoardItems() {
        return this.hiddenItemsCache;
    }

    getLockedBoardItems() {
        return this.lockedItemsCache;
    }

    isItemHidden(item) {
        return isStoryboardItemHidden(item);
    }

    isItemLocked(item) {
        return isStoryboardItemLocked(item);
    }

    isItemEditable(item) {
        return isStoryboardItemEditable(item);
    }

    updateHiddenItemsButton() {
        return;
    }

    openBoardImportPicker() {
        this.boardPackageInput?.click();
    }

    async revealAllHiddenItems() {
        const hiddenItems = this.getHiddenBoardItems();
        if (!hiddenItems.length) return;

        hiddenItems.forEach((item) => {
            delete item.hidden;
            normalizeStoryboardItemState(item, { mirrorLegacyPinned: true });
        });
        this.normalizeBoardItemStates({ mirrorLegacyPinned: true });
        this.renderBoard();
        await this.saveBoard();
    }

    async setItemsHidden(items, hidden) {
        const targetItems = (items || [])
            .filter(Boolean)
            .filter((item) => !hidden || !this.isItemLocked(item));
        if (!targetItems.length) return false;

        targetItems.forEach((item) => {
            if (hidden) item.hidden = true;
            else delete item.hidden;
            normalizeStoryboardItemState(item, { mirrorLegacyPinned: true });
        });

        this.normalizeBoardItemStates({ mirrorLegacyPinned: true });
        this.renderBoard();
        await this.saveBoard();
        return true;
    }

    async setItemsLocked(items, locked) {
        const targetItems = (items || []).filter(Boolean);
        if (!targetItems.length) return false;

        targetItems.forEach((item) => {
            if (locked) item.locked = true;
            else delete item.locked;
            normalizeStoryboardItemState(item, { mirrorLegacyPinned: true });
        });

        this.normalizeBoardItemStates({ mirrorLegacyPinned: true });
        this.renderBoard();
        await this.saveBoard();
        return true;
    }

    initializeHistoryState() {
        this.normalizeBoardItemStates({ mirrorLegacyPinned: true });
        this.historyUndoStack = [];
        this.historyRedoStack = [];
        this.historySnapshot = createStoryboardHistorySnapshot(this.boardData);
        this.historySignature = createStoryboardHistorySignature(this.boardData);
        this.updateHistoryButtons();
    }

    updateHistoryButtons() {
        if (this.undoButton) {
            const canUndo = this.historyUndoStack.length > 0;
            this.undoButton.disabled = !canUndo;
            this.undoButton.title = canUndo ? "Undo (Cmd/Ctrl+Z)" : "Nothing to undo";
        }
        if (this.redoButton) {
            const canRedo = this.historyRedoStack.length > 0;
            this.redoButton.disabled = !canRedo;
            this.redoButton.title = canRedo ? "Redo (Shift+Cmd/Ctrl+Z)" : "Nothing to redo";
        }
        this.updateHiddenItemsButton();
    }

    captureHistoryState() {
        const nextSnapshot = createStoryboardHistorySnapshot(this.boardData);
        const nextSignature = createStoryboardHistorySignature(this.boardData);

        if (this.historySnapshot === null || this.historySignature === null) {
            this.historySnapshot = nextSnapshot;
            this.historySignature = nextSignature;
            this.updateHistoryButtons();
            return;
        }

        if (this.isApplyingHistory) {
            this.historySnapshot = nextSnapshot;
            this.historySignature = nextSignature;
            this.updateHistoryButtons();
            return;
        }

        if (nextSignature !== this.historySignature) {
            this.historyUndoStack = pushStoryboardHistoryEntry(this.historyUndoStack, this.historySnapshot);
            this.historyRedoStack = [];
            this.historySignature = nextSignature;
            this.historySnapshot = nextSnapshot;
            this.updateHistoryButtons();
            return;
        }

        if (nextSnapshot !== this.historySnapshot) {
            this.historySnapshot = nextSnapshot;
        }
        this.updateHistoryButtons();
    }

    applyHistorySnapshot(snapshot) {
        const restored = parseStoryboardHistorySnapshot(snapshot);
        this.boardData.items = restored.items;
        this.boardData.groups = restored.groups;
        this.boardData.selection = restored.selection;
        this.boardData.settings = normalizeStoryboardSettings(restored.settings);
        this.normalizeBoardItemStates({ mirrorLegacyPinned: true });
        this.ensureBoardCollections();
    }

    async undoHistory() {
        if (!this.historyUndoStack.length) return;
        const previousSnapshot = this.historyUndoStack[this.historyUndoStack.length - 1];
        const currentSnapshot = this.historySnapshot || createStoryboardHistorySnapshot(this.boardData);
        this.historyUndoStack = this.historyUndoStack.slice(0, -1);
        this.historyRedoStack = pushStoryboardHistoryEntry(this.historyRedoStack, currentSnapshot);
        this.isApplyingHistory = true;
        this.applyHistorySnapshot(previousSnapshot);
        this.renderBoard();
        await this.saveBoard();
        this.isApplyingHistory = false;
        this.updateHistoryButtons();
    }

    async redoHistory() {
        if (!this.historyRedoStack.length) return;
        const nextSnapshot = this.historyRedoStack[this.historyRedoStack.length - 1];
        const currentSnapshot = this.historySnapshot || createStoryboardHistorySnapshot(this.boardData);
        this.historyRedoStack = this.historyRedoStack.slice(0, -1);
        this.historyUndoStack = pushStoryboardHistoryEntry(this.historyUndoStack, currentSnapshot);
        this.isApplyingHistory = true;
        this.applyHistorySnapshot(nextSnapshot);
        this.renderBoard();
        await this.saveBoard();
        this.isApplyingHistory = false;
        this.updateHistoryButtons();
    }

    storeViewportState() {
        if (!this.boardData) return;
        this.boardData.viewport = {
            x: Number(this.offset.x) || 0,
            y: Number(this.offset.y) || 0,
            zoom: Number(this.scale) || 1,
        };
    }

    restoreViewportState() {
        const viewport = this.boardData?.viewport || {};
        const zoom = Number(viewport.zoom);
        const x = Number(viewport.x);
        const y = Number(viewport.y);
        this.scale = Number.isFinite(zoom) && zoom > 0 ? Math.max(0.15, Math.min(5, zoom)) : 1;
        this.offset = {
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
        };
    }

    scheduleViewportSave() {
        if (!this.boardData) return;
        const scheduledBoardId = this.boardId;
        if (this.viewportSaveTimer) window.clearTimeout(this.viewportSaveTimer);
        this.viewportSaveTimer = window.setTimeout(() => {
            this.viewportSaveTimer = null;
            if (scheduledBoardId !== this.boardId) return;
            this.saveBoard();
        }, 180);
    }

    bindSettingsPanel() {
        const bindCheckbox = (id, key, onChange = null) => {
            const input = document.getElementById(id);
            if (!input) return;
            input.onchange = () => {
                const settings = this.getBoardSettings();
                settings[key] = Boolean(input.checked);
                this.boardData.settings = normalizeStoryboardSettings(settings);
                if (typeof onChange === "function") onChange(this.boardData.settings);
                this.renderSettingsPanel();
                this.renderBoard();
                this.saveBoard();
            };
        };

        bindCheckbox("storyboard-setting-grid", "grid", () => this.updateGridOverlay());
        bindCheckbox("storyboard-setting-snap", "snap");
        bindCheckbox("storyboard-setting-show-prompt", "show_prompt", () => this.updateChromeVisibility());
        bindCheckbox("storyboard-setting-show-minimap", "show_minimap", () => this.updateChromeVisibility());
        bindCheckbox("storyboard-setting-show-inspector", "show_inspector", () => {
            if (!this.getBoardSettings().show_inspector) this.inspectorOpen = false;
            this.updateChromeVisibility();
        });

        const spacingInput = document.getElementById("storyboard-setting-grid-spacing");
        if (spacingInput) {
            spacingInput.onchange = () => {
                const settings = this.getBoardSettings();
                settings.grid_spacing = spacingInput.value;
                this.boardData.settings = normalizeStoryboardSettings(settings);
                this.renderSettingsPanel();
                this.updateGridOverlay();
                this.saveBoard();
            };
        }
    }

    renderSettingsPanel() {
        const settings = this.getBoardSettings();
        const signature = JSON.stringify({
            grid: Boolean(settings.grid),
            snap: Boolean(settings.snap),
            show_prompt: Boolean(settings.show_prompt),
            show_minimap: Boolean(settings.show_minimap),
            show_inspector: Boolean(settings.show_inspector),
            grid_spacing: Number(settings.grid_spacing) || 0,
            settingsOpen: Boolean(this.settingsOpen),
        });
        if (signature === this.settingsPanelSignature) return;
        this.settingsPanelSignature = signature;
        const map = [
            ["storyboard-setting-grid", settings.grid],
            ["storyboard-setting-snap", settings.snap],
            ["storyboard-setting-show-prompt", settings.show_prompt],
            ["storyboard-setting-show-minimap", settings.show_minimap],
            ["storyboard-setting-show-inspector", settings.show_inspector],
        ];
        map.forEach(([id, value]) => {
            const input = document.getElementById(id);
            if (input) input.checked = Boolean(value);
        });
        const spacingInput = document.getElementById("storyboard-setting-grid-spacing");
        if (spacingInput) spacingInput.value = String(settings.grid_spacing);
        if (this.settingsPanel) {
            this.settingsPanel.classList.toggle("open", this.settingsOpen);
        }
    }

    setSettingsOpen(open) {
        this.settingsOpen = open;
        if (open) {
            this.inspectorOpen = false;
            this.closeExtensionPicker();
        }
        this.updateInspectorToggleState();
        this.updateChromeVisibility();
    }

    updateInspectorToggleState() {
        if (!this.inspectorToggle) return;
        this.inspectorToggle.innerText = this.inspectorOpen ? "✕" : "☰";
        this.inspectorToggle.title = this.inspectorOpen ? "Close Inspector" : "Open Inspector";
        this.inspectorToggle.setAttribute("aria-label", this.inspectorToggle.title);
    }

    updateChromeVisibility() {
        const settings = this.getBoardSettings();
        const canShowInspector = Boolean(settings.show_inspector);
        const signature = JSON.stringify({
            show_minimap: Boolean(settings.show_minimap),
            show_prompt: Boolean(settings.show_prompt),
            canShowInspector,
            inspectorOpen: Boolean(canShowInspector && this.inspectorOpen),
            settingsOpen: Boolean(this.settingsOpen),
        });
        if (signature === this.chromeVisibilitySignature) return;
        this.chromeVisibilitySignature = signature;

        if (this.minimap) this.minimap.style.display = settings.show_minimap ? "block" : "none";
        if (this.minimapControls) this.minimapControls.style.display = settings.show_minimap ? "grid" : "none";
        const prompt = this.canvasContainer.querySelector(".storyboard-floating-prompt");
        if (prompt) prompt.style.display = settings.show_prompt ? "flex" : "none";
        if (this.inspector) {
            this.inspector.classList.toggle("storyboard-inspector-hidden", !canShowInspector);
            this.inspector.classList.toggle("open", canShowInspector && this.inspectorOpen);
        }
        if (this.inspectorToggle) this.inspectorToggle.style.display = settings.show_inspector ? "block" : "none";
        if (this.settingsPanel) {
            this.settingsPanel.classList.toggle("open", this.settingsOpen);
        }
        if (this.window) {
            this.window.dataset.settingsOpen = this.settingsOpen ? "true" : "false";
            this.window.dataset.inspectorOpen = canShowInspector && this.inspectorOpen ? "true" : "false";
        }
    }

    updateGridOverlay() {
        if (!this.gridLayer) return;
        const styles = getGridOverlayStyles(this.scale, this.offset, this.getBoardSettings());
        this.gridLayer.style.display = styles.visible ? "block" : "none";
        this.gridLayer.style.backgroundSize = styles.backgroundSize;
        this.gridLayer.style.backgroundPosition = styles.backgroundPosition;
    }

    addExtensionItems(items, selectionIds = null) {
        const nextItems = (items || []).filter(Boolean);
        if (!nextItems.length) return [];

        const settings = this.getBoardSettings();
        const preparedItems = nextItems.map((item) => {
            const prepared = { ...item };
            if (settings.snap && Number.isFinite(prepared.x) && Number.isFinite(prepared.y)) {
                const snapped = snapPointToGrid({ x: prepared.x, y: prepared.y }, settings);
                prepared.x = snapped.x;
                prepared.y = snapped.y;
            }
            return prepared;
        });

        this.boardData.items.push(...preparedItems);
        this.boardData.selection = Array.isArray(selectionIds) && selectionIds.length
            ? selectionIds
            : preparedItems.map(item => item.id);
        this.renderBoard();
        return preparedItems;
    }

    async runToolbarExtension(type) {
        const extension = this.extensionRegistry.get(type);
        if (!extension) return;
        this.closeExtensionPicker();

        if (typeof extension.onTrigger === "function") {
            const result = await extension.onTrigger(this);
            if (result === false || result == null) return;
            if (result && result.handled) {
                this.renderBoard();
                await this.saveBoard();
                return;
            }
            if (Array.isArray(result)) {
                this.addExtensionItems(result);
            } else if (Array.isArray(result.items)) {
                this.addExtensionItems(result.items, result.selection);
            } else if (result.item) {
                this.addExtensionItems([result.item], result.selection);
            } else {
                this.renderBoard();
            }
            await this.saveBoard();
            return;
        }

        if (!extension.createItem) return;
        const item = extension.createItem(this);
        if (!item) return;
        this.addExtensionItems([item], [item.id]);
        await this.saveBoard();
    }

    setInspectorOpen(open) {
        this.inspectorOpen = open;
        if (open) {
            this.settingsOpen = false;
            this.closeExtensionPicker();
            this.renderInspector();
        }
        this.updateInspectorToggleState();
        this.updateChromeVisibility();
    }

    async show(boardId, node) {
        // Clear cache when switching boards
        if (this.boardId !== boardId) {
            this.itemElements.forEach(el => el.remove());
            this.itemElements.clear();
            this.canvas.innerHTML = "";
        }
        
        this.boardId = boardId;
        this.node = node;
        this.overlay.style.display = "flex";
        
        // Sync node widget if it exists
        if (this.node) {
            const boardIdWidget = this.node.widgets.find(w => w.name === "board_id");
            if (boardIdWidget && boardIdWidget.value !== this.boardId) {
                boardIdWidget.value = this.boardId;
            }
        }

        await this.loadBoard();
        await this.refreshBoardList();
    }

    async refreshBoardList() {
        const response = await fetch("/mkr/storyboard/list");
        const { boards } = await response.json();
        
        this.boardSelector.innerHTML = "";
        boards.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b;
            opt.innerText = b;
            if (b === this.boardId) opt.selected = true;
            this.boardSelector.appendChild(opt);
        });

        // Ensure current board is in the list even if it's new
        if (!boards.includes(this.boardId)) {
            const opt = document.createElement("option");
            opt.value = this.boardId;
            opt.innerText = this.boardId;
            opt.selected = true;
            this.boardSelector.appendChild(opt);
        }
    }

    sanitizeBoardNameInput(value, fallback = "Storyboard") {
        return sanitizeStoryboardBoardName(value, fallback);
    }

    async duplicateCurrentBoard() {
        const suggestedName = this.sanitizeBoardNameInput(`${this.boardId} Copy`, `${this.boardId} Copy`);
        const requestedName = prompt("Duplicate this storyboard as:", suggestedName);
        if (requestedName === null) return;

        const newName = this.sanitizeBoardNameInput(requestedName, suggestedName);
        if (!newName || newName === this.boardId) {
            alert("Choose a new name for the duplicated storyboard.");
            return;
        }

        try {
            const response = await fetch(
                `/mkr/storyboard/${encodeURIComponent(this.boardId)}/duplicate/${encodeURIComponent(newName)}`,
                { method: "POST" },
            );
            const result = await response.json();
            if (!response.ok || result.status !== "ok") {
                alert(result.error || "Duplicate failed. Name might already exist.");
                return;
            }
            await this.show(newName, this.node);
        } catch (err) {
            console.error("Storyboard duplicate failed:", err);
            alert("Duplicate failed. Check console/server logs and retry.");
        }
    }

    async exportCurrentBoardPackage() {
        try {
            const response = await fetch(`/mkr/storyboard/${encodeURIComponent(this.boardId)}/export`);
            const packageData = await response.json();
            if (!response.ok) {
                alert(packageData?.error || "Export failed.");
                return;
            }

            downloadStoryboardJsonFile(
                createStoryboardPackageFilename(this.boardId, packageData.exported_at),
                packageData,
            );

            if (packageData.missing_assets?.length) {
                alert(`Exported with missing assets: ${packageData.missing_assets.join(", ")}`);
            }
        } catch (err) {
            console.error("Storyboard export failed:", err);
            alert("Export failed. Check console/server logs and retry.");
        }
    }

    async importBoardPackageFile(file) {
        let packageData = null;
        try {
            packageData = JSON.parse(await file.text());
        } catch (err) {
            console.error("Storyboard package parse failed:", err);
            alert("That file is not valid storyboard package JSON.");
            return;
        }

        const suggestedName = suggestStoryboardImportName(packageData, file.name.replace(/\.[^.]+$/, ""));
        const requestedName = prompt("Import this storyboard as:", suggestedName);
        if (requestedName === null) return;

        const boardName = this.sanitizeBoardNameInput(requestedName, suggestedName);
        try {
            const response = await fetch("/mkr/storyboard/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    board_id: boardName,
                    package: packageData,
                }),
            });
            const result = await response.json();
            if (!response.ok || result.status !== "ok") {
                alert(result.error || "Import failed.");
                return;
            }

            await this.show(result.board_id, this.node);
            if (result.missing_assets?.length) {
                alert(`Imported "${result.board_id}" with missing assets: ${result.missing_assets.join(", ")}`);
            }
        } catch (err) {
            console.error("Storyboard import failed:", err);
            alert("Import failed. Check console/server logs and retry.");
        }
    }

    hide() {
        this.overlay.style.display = "none";
        this.closeExtensionPicker();
        if (this.contextMenu) this.contextMenu.style.display = "none";
        this.hideSelectionMarquee();
        this.clearSelectionPreview();
        if (this.mediaActivationFrame !== null) {
            cancelAnimationFrame(this.mediaActivationFrame);
            this.mediaActivationFrame = null;
        }
        this.mediaLoadQueue = [];
        this.mediaLoadsInFlight.clear();
        this.mediaUnloadTimers.forEach((timer) => window.clearTimeout(timer));
        this.mediaUnloadTimers.clear();
        this.mediaPrewarmQueue = [];
        this.mediaPrewarmsInFlight.clear();
        if (this.mediaDeactivationTimer) {
            window.clearTimeout(this.mediaDeactivationTimer);
            this.mediaDeactivationTimer = null;
        }
        if (this.minimapFrame !== null) {
            cancelAnimationFrame(this.minimapFrame);
            this.minimapFrame = null;
        }
        if (this.viewportSaveTimer) {
            window.clearTimeout(this.viewportSaveTimer);
            this.viewportSaveTimer = null;
        }
        this.node = null;
    }

    async loadBoard() {
        if (this.isInteracting) {
            this.needsReload = true;
            return;
        }
        this.needsReload = false;
        const response = await fetch(`/mkr/storyboard/${this.boardId}?t=${Date.now()}`);
        this.boardData = await response.json();
        this.ensureBoardSettings();
        this.normalizeBoardItemStates({ mirrorLegacyPinned: true });
        this.restoreViewportState();
        this.initializeHistoryState();
        console.log("Storyboard loaded:", this.boardData);
        this.renderBoard();
        this.updateTransform();
        this.renderSettingsPanel();
        this.updateChromeVisibility();
        this.updateGridOverlay();

        // Sync prompt if node exists
        if (this.node) {
            const promptWidget = this.node.widgets.find(w => w.name === "prompt");
            const promptEl = document.getElementById("storyboard-prompt");
            if (promptWidget && promptEl) {
                promptEl.value = promptWidget.value || "";
            }
        }
    }

    async saveBoard(notify = false) {
        this.ensureBoardSettings();
        this.normalizeBoardItemStates({ mirrorLegacyPinned: true });
        this.storeViewportState();
        this.captureHistoryState();
        await fetch(`/mkr/storyboard/${this.boardId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...this.boardData, notify })
        });

        // Update node version to trigger ComfyUI execution
        if (this.node) {
            const versionWidget = this.node.widgets.find(w => w.name === "version");
            if (versionWidget) {
                versionWidget.value = (versionWidget.value || 0) + 1;
            }
        }
    }

    setStoryboardPrompt(nextPrompt, { mode = "replace" } = {}) {
        const promptEl = document.getElementById("storyboard-prompt");
        const currentValue = promptEl?.value || "";
        const trimmedNext = String(nextPrompt ?? "").trim();
        if (!trimmedNext) return currentValue;

        const mergedValue = mode === "append" && currentValue.trim()
            ? `${currentValue.trim()}\n${trimmedNext}`
            : trimmedNext;

        if (promptEl) promptEl.value = mergedValue;
        if (this.node) {
            const promptWidget = this.node.widgets.find(w => w.name === "prompt");
            if (promptWidget) promptWidget.value = mergedValue;
        }
        return mergedValue;
    }

    getStoryboardItemLabel(item) {
        if (!item) return "Unknown item";
        const label = String(item.label || "").trim();
        if (label) return label;
        return String(item.type || "item")
            .replace(/_/g, " ")
            .replace(/\b\w/g, (match) => match.toUpperCase());
    }

    getCollectionById(collectionId) {
        return this.ensureBoardCollections().find((group) => group.id === collectionId) || null;
    }

    getCollectionItems(collection) {
        return getStoryboardCollectionItems(collection, this.boardData.items);
    }

    focusViewOnItems(items, padding = 120) {
        const targetItems = getStoryboardVisibleItems(items || []);
        if (!targetItems.length || !this.canvasContainer) return false;
        const bounds = this.getItemsBounds(targetItems);
        if (!bounds) return false;

        const targetWidth = Math.max(1, bounds.w + (padding * 2));
        const targetHeight = Math.max(1, bounds.h + (padding * 2));
        const scaleX = this.canvasContainer.clientWidth / targetWidth;
        const scaleY = this.canvasContainer.clientHeight / targetHeight;
        this.scale = Math.max(0.15, Math.min(5, Math.min(scaleX, scaleY)));
        this.centerOnWorldPoint(bounds.x + (bounds.w * 0.5), bounds.y + (bounds.h * 0.5));
        this.scheduleViewportSave();
        return true;
    }

    createCollectionFromSelection() {
        const selection = this.boardData.selection.filter(Boolean);
        if (!selection.length) return null;

        const suggestedName = selection.length === 1
            ? `${this.getStoryboardItemLabel(this.boardData.items.find((item) => item.id === selection[0]))} Collection`
            : `Collection ${this.ensureBoardCollections().length + 1}`;
        const requestedName = prompt("Name this collection:", suggestedName);
        if (requestedName === null) return null;

        const createdAt = new Date().toISOString();
        const collection = createStoryboardCollection({
            name: requestedName,
            itemIds: selection,
            generateId: () => this.generateUUID(),
            createdAt,
            updatedAt: createdAt,
            index: this.ensureBoardCollections().length,
        });
        this.ensureBoardCollections().push(collection);
        this.renderBoard();
        this.saveBoard();
        return collection;
    }

    updateCollectionFromSelection(collectionId) {
        const collection = this.getCollectionById(collectionId);
        if (!collection) return;
        collection.item_ids = Array.from(new Set(this.boardData.selection.filter(Boolean)));
        collection.updated_at = new Date().toISOString();
        this.ensureBoardCollections();
        this.renderBoard();
        this.saveBoard();
    }

    renameCollection(collectionId) {
        const collection = this.getCollectionById(collectionId);
        if (!collection) return;
        const requestedName = prompt("Rename collection:", collection.name || "Collection");
        if (requestedName === null) return;
        collection.name = String(requestedName || "").trim() || collection.name || "Collection";
        collection.updated_at = new Date().toISOString();
        this.renderBoard();
        this.saveBoard();
    }

    deleteCollection(collectionId) {
        const collection = this.getCollectionById(collectionId);
        if (!collection) return;
        if (!confirm(`Delete collection "${collection.name}"?`)) return;
        this.boardData.groups = this.ensureBoardCollections().filter((group) => group.id !== collectionId);
        this.renderBoard();
        this.saveBoard();
    }

    applyCollectionSelection(collectionId, { append = false, focus = false } = {}) {
        const collection = this.getCollectionById(collectionId);
        if (!collection) return;
        const collectionItems = this.getCollectionItems(collection);
        const visibleItems = collectionItems.filter((item) => !this.isItemHidden(item));
        const itemIds = visibleItems.map((item) => item.id);
        if (!itemIds.length) {
            alert("This collection has no visible items right now. Use Show to reveal it first.");
            return;
        }
        const nextSelection = append
            ? Array.from(new Set([...this.boardData.selection.filter(Boolean), ...itemIds]))
            : itemIds;
        this.selectStoryboardItems(nextSelection);
        if (focus) this.focusViewOnItems(visibleItems);
        this.saveBoard();
    }

    async setCollectionHidden(collectionId, hidden) {
        const collection = this.getCollectionById(collectionId);
        if (!collection) return;
        const collectionItems = this.getCollectionItems(collection);
        const targetItems = hidden
            ? collectionItems.filter((item) => !this.isItemHidden(item))
            : collectionItems.filter((item) => this.isItemHidden(item));
        if (!targetItems.length) return;
        await this.setItemsHidden(targetItems, hidden);
    }

    async setCollectionLocked(collectionId, locked) {
        const collection = this.getCollectionById(collectionId);
        if (!collection) return;
        const collectionItems = this.getCollectionItems(collection);
        const targetItems = locked
            ? collectionItems.filter((item) => !this.isItemLocked(item))
            : collectionItems.filter((item) => this.isItemLocked(item));
        if (!targetItems.length) return;
        await this.setItemsLocked(targetItems, locked);
    }

    renderCollectionsSection(options = {}) {
        const {
            allowCreateFromSelection = false,
            title = "Collections",
            emptyMessage = "Save a selection as a collection to reselect and focus it later.",
        } = options;
        const collections = this.ensureBoardCollections();
        const selection = this.boardData.selection.filter(Boolean);
        const hasSelection = selection.length > 0;

        const createButton = allowCreateFromSelection
            ? `<button type="button" id="action-create-collection"${hasSelection ? "" : " disabled"}>Save Selection as Collection</button>`
            : "";

        const cards = collections.length
            ? collections.map((collection) => {
                const collectionItems = this.getCollectionItems(collection);
                const itemCount = collectionItems.length;
                const hiddenCount = collectionItems.filter((item) => this.isItemHidden(item)).length;
                const lockedCount = collectionItems.filter((item) => this.isItemLocked(item)).length;
                const hideableCount = collectionItems.filter((item) => !this.isItemHidden(item) && !this.isItemLocked(item)).length;
                const isSelected = storyboardCollectionMatchesSelection(collection, selection);
                const statusBits = [
                    hiddenCount ? `${hiddenCount} hidden` : "",
                    lockedCount ? `${lockedCount} locked` : "",
                ].filter(Boolean).join(" • ");
                return `
                    <div class="storyboard-collection-card${isSelected ? " is-selected" : ""}" data-collection-id="${escapeHtml(collection.id)}">
                        <div class="storyboard-collection-card-header">
                            <div class="storyboard-collection-title-row">
                                <span class="storyboard-collection-swatch" style="--collection-color: ${escapeHtml(collection.color || "#7dd3fc")}"></span>
                                <strong>${escapeHtml(collection.name || "Collection")}</strong>
                            </div>
                            <div class="storyboard-collection-meta">
                                <span class="storyboard-collection-count">${itemCount} item${itemCount === 1 ? "" : "s"}</span>
                                ${statusBits ? `<span class="storyboard-collection-state">${escapeHtml(statusBits)}</span>` : ""}
                            </div>
                        </div>
                        <div class="storyboard-collection-actions-row">
                            <button type="button" data-collection-action="select" data-collection-id="${escapeHtml(collection.id)}">Select</button>
                            <button type="button" data-collection-action="add" data-collection-id="${escapeHtml(collection.id)}">Add</button>
                            <button type="button" data-collection-action="focus" data-collection-id="${escapeHtml(collection.id)}">Focus</button>
                            <button type="button" data-collection-action="hide" data-collection-id="${escapeHtml(collection.id)}"${hideableCount > 0 ? "" : " disabled"}>Hide</button>
                            <button type="button" data-collection-action="show" data-collection-id="${escapeHtml(collection.id)}"${hiddenCount > 0 ? "" : " disabled"}>Show</button>
                            <button type="button" data-collection-action="lock" data-collection-id="${escapeHtml(collection.id)}"${lockedCount < itemCount ? "" : " disabled"}>Lock</button>
                            <button type="button" data-collection-action="unlock" data-collection-id="${escapeHtml(collection.id)}"${lockedCount > 0 ? "" : " disabled"}>Unlock</button>
                            ${hasSelection ? `<button type="button" data-collection-action="update" data-collection-id="${escapeHtml(collection.id)}">Update</button>` : ""}
                            <button type="button" data-collection-action="rename" data-collection-id="${escapeHtml(collection.id)}">Rename</button>
                            <button type="button" class="danger" data-collection-action="delete" data-collection-id="${escapeHtml(collection.id)}">Delete</button>
                        </div>
                    </div>
                `;
            }).join("")
            : `<div class="storyboard-collection-empty">${escapeHtml(emptyMessage)}</div>`;

        return `
            <div class="storyboard-collection-section">
                <div class="storyboard-collection-section-header">
                    <h4>${escapeHtml(title)}</h4>
                    <span>${collections.length} saved</span>
                </div>
                ${createButton}
                <div class="storyboard-collection-list">${cards}</div>
            </div>
        `;
    }

    bindCollectionInspectorActions() {
        const createButton = document.getElementById("action-create-collection");
        if (createButton) {
            createButton.onclick = () => {
                this.createCollectionFromSelection();
            };
        }

        document.querySelectorAll("[data-collection-action]").forEach((button) => {
            button.onclick = async () => {
                const collectionId = button.getAttribute("data-collection-id");
                const action = button.getAttribute("data-collection-action");
                if (!collectionId || !action) return;

                if (action === "select") this.applyCollectionSelection(collectionId);
                else if (action === "add") this.applyCollectionSelection(collectionId, { append: true });
                else if (action === "focus") this.applyCollectionSelection(collectionId, { focus: true });
                else if (action === "hide") await this.setCollectionHidden(collectionId, true);
                else if (action === "show") await this.setCollectionHidden(collectionId, false);
                else if (action === "lock") await this.setCollectionLocked(collectionId, true);
                else if (action === "unlock") await this.setCollectionLocked(collectionId, false);
                else if (action === "update") this.updateCollectionFromSelection(collectionId);
                else if (action === "rename") this.renameCollection(collectionId);
                else if (action === "delete") this.deleteCollection(collectionId);
            };
        });
    }

    getCanvasContainerPoint(clientX, clientY) {
        const rect = this.canvasContainer.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    }

    previewSelection(itemIds) {
        const resolvedIds = Array.from(new Set((itemIds || []).filter(Boolean)));
        const previousIds = new Set(this.selectionPreviewIds || []);
        this.selectionPreviewIds = resolvedIds;
        const selectedSet = new Set(resolvedIds);
        if (previousIds.size === selectedSet.size && resolvedIds.every((itemId) => previousIds.has(itemId))) {
            return;
        }
        previousIds.forEach((itemId) => {
            if (selectedSet.has(itemId)) return;
            this.itemElements.get(itemId)?.classList.remove("selected");
        });
        selectedSet.forEach((itemId) => {
            if (previousIds.has(itemId)) return;
            this.itemElements.get(itemId)?.classList.add("selected");
        });
    }

    clearSelectionPreview() {
        this.selectionPreviewIds = null;
    }

    showSelectionMarquee(pixelRect) {
        if (!this.selectionMarquee || !pixelRect) return;
        this.selectionMarquee.style.display = "block";
        this.selectionMarquee.style.left = `${pixelRect.x}px`;
        this.selectionMarquee.style.top = `${pixelRect.y}px`;
        this.selectionMarquee.style.width = `${pixelRect.w}px`;
        this.selectionMarquee.style.height = `${pixelRect.h}px`;
    }

    hideSelectionMarquee() {
        if (!this.selectionMarquee) return;
        this.selectionMarquee.style.display = "none";
    }

    selectStoryboardItems(itemIds) {
        const validIds = filterStoryboardSelectionIds(itemIds, this.boardData.items);
        this.boardData.selection = validIds;
        this.clearSelectionPreview();
        this.renderBoard();
    }

    selectAllItems() {
        const allIds = this.getVisibleBoardItems().map((item) => item.id).filter(Boolean);
        this.selectStoryboardItems(allIds);
        this.saveBoard();
    }

    duplicateSelectedItems() {
        const sourceItems = this.getSelectedItems();
        if (!sourceItems.length) return;
        if (sourceItems.some((item) => this.isItemLocked(item))) {
            alert("Unlock the selected items before duplicating them.");
            return;
        }

        const duplicatedItems = cloneStoryboardItemsForPaste(sourceItems, {
            generateId: () => this.generateUUID(),
            offsetX: 28,
            offsetY: 28,
        });
        const duplicatedIds = duplicatedItems.map((item) => item.id).filter(Boolean);
        this.boardData.items.push(...duplicatedItems);
        this.boardData.selection = duplicatedIds;
        this.renderBoard();
        this.saveBoard();
    }

    async captureReferenceBasket(itemId) {
        const basket = this.boardData.items.find((item) => item.id === itemId);
        if (!basket || basket.type !== "reference_basket") return;
        basket.linked_ids = this.boardData.selection.filter((id) => id && id !== itemId);
        const element = this.itemElements.get(itemId);
        if (element) this.updateItemContent(element, basket, false);
        await this.saveBoard();
    }

    getContrastColor(hexcolor) {
        if (!hexcolor) return "#333";
        // If hexcolor is something like "#ffeb3b"
        const r = parseInt(hexcolor.slice(1, 3), 16);
        const g = parseInt(hexcolor.slice(3, 5), 16);
        const b = parseInt(hexcolor.slice(5, 7), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? "#000" : "#fff";
    }

    generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    removeSelectedItems() {
        const selectedItems = this.getSelectedItems();
        if (!selectedItems.length) return;
        if (selectedItems.some((item) => this.isItemLocked(item))) {
            alert("Unlock the selected items before deleting them.");
            return;
        }

        const selectedSet = new Set(selectedItems.map((item) => item.id));
        this.boardData.items = this.boardData.items.filter((item) => !selectedSet.has(item.id));
        this.boardData.selection = [];
        this.ensureBoardCollections();
        this.renderBoard();
        this.saveBoard();
    }

    getResolvedTheme() {
        if (this.themeMode === "dark" || this.themeMode === "light") return this.themeMode;
        return this.systemThemeQuery?.matches ? "dark" : "light";
    }

    normalizeThemeMode(mode) {
        const valid = new Set(["system", "light", "dark"]);
        return valid.has(mode) ? mode : "system";
    }

    getThemeToolbarState() {
        const iconKey = this.themeMode === "light"
            ? "themeLight"
            : this.themeMode === "dark"
                ? "themeDark"
                : "themeSystem";
        const label = this.themeMode.charAt(0).toUpperCase() + this.themeMode.slice(1);
        return {
            iconMarkup: TOOLBAR_ICONS[iconKey],
            label,
            title: `Theme: ${label}`,
        };
    }

    applyThemeMode() {
        if (!this.window) return;
        const resolved = this.getResolvedTheme();
        this.window.dataset.theme = resolved;
        this.window.dataset.themeMode = this.themeMode;
        if (this.themeToggleButton) {
            const themeState = this.getThemeToolbarState();
            this.themeToggleButton.title = themeState.title;
            this.themeToggleButton.setAttribute("aria-label", themeState.title);
            if (this.themeToggleGlyph) this.themeToggleGlyph.innerHTML = themeState.iconMarkup;
            if (this.themeToggleLabel) this.themeToggleLabel.textContent = themeState.label;
        }
    }

    cycleThemeMode() {
        const order = ["system", "light", "dark"];
        const idx = order.indexOf(this.themeMode);
        this.themeMode = order[(idx + 1) % order.length];
        localStorage.setItem("storyboard.themeMode", this.themeMode);
        this.applyThemeMode();
    }

    getDefaultFontOptions() {
        return [
            { label: "System Sans", value: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" },
            { label: "System Serif", value: "ui-serif, Georgia, Cambria, Times New Roman, serif" },
            { label: "Monospace", value: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
            { label: "Arial", value: "Arial, Helvetica, sans-serif" },
            { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
            { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
            { label: "Trebuchet MS", value: "'Trebuchet MS', Helvetica, sans-serif" },
            { label: "Georgia", value: "Georgia, serif" },
            { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
            { label: "Courier New", value: "'Courier New', Courier, monospace" }
        ];
    }

    async refreshFontOptions() {
        const defaults = this.getDefaultFontOptions();
        const dedupe = new Map(defaults.map((f) => [f.value, f]));
        try {
            if (window.queryLocalFonts) {
                const localFonts = await window.queryLocalFonts();
                localFonts
                    .map(f => (f.family || "").trim())
                    .filter(Boolean)
                    .sort((a, b) => a.localeCompare(b))
                    .forEach((family) => {
                        if (!dedupe.has(family)) dedupe.set(family, { label: family, value: family });
                    });
            } else {
                const candidates = [
                    "Inter", "Roboto", "Open Sans", "Noto Sans", "Noto Serif", "Source Sans Pro", "Source Serif Pro",
                    "Lato", "Poppins", "Montserrat", "Ubuntu", "PT Sans", "PT Serif", "Merriweather", "Fira Sans",
                    "Fira Mono", "JetBrains Mono", "SF Pro Text", "SF Pro Display", "Avenir", "Avenir Next",
                    "Helvetica Neue", "Lucida Grande", "Segoe UI", "Calibri", "Cambria", "Candara", "Corbel",
                    "Consolas", "Constantia", "Franklin Gothic Medium", "Gill Sans", "Optima", "Palatino",
                    "Book Antiqua", "Baskerville", "Didot", "American Typewriter", "Copperplate", "Comic Sans MS",
                    "Impact", "Arial Black", "MS Gothic", "Yu Gothic", "Meiryo", "Hiragino Sans", "Hiragino Mincho ProN",
                    "PingFang SC", "PingFang TC", "SimHei", "SimSun", "Microsoft YaHei", "Microsoft JhengHei",
                    "Nanum Gothic", "Nanum Myeongjo", "Pretendard", "Apple SD Gothic Neo", "Liberation Sans",
                    "Liberation Serif", "Liberation Mono", "DejaVu Sans", "DejaVu Serif", "DejaVu Sans Mono",
                    "Noto Color Emoji", "Segoe UI Emoji"
                ];
                const detected = this.detectInstalledFonts(candidates);
                detected.forEach((family) => {
                    if (!dedupe.has(family)) dedupe.set(family, { label: family, value: family });
                });
            }
        } catch (err) {
            console.warn("Font detection fallback in use:", err);
        }
        this.fontOptions = Array.from(dedupe.values());
        if (this.overlay?.style?.display === "flex") {
            this.renderInspector();
        }
    }

    detectInstalledFonts(candidates) {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) return [];
        const testText = "mmmmmmmmmmlliWWW@@@";
        const testSize = "72px";
        const fallbacks = ["monospace", "sans-serif", "serif"];
        const fallbackWidths = {};
        fallbacks.forEach((fallback) => {
            context.font = `${testSize} ${fallback}`;
            fallbackWidths[fallback] = context.measureText(testText).width;
        });
        const detected = [];
        for (const family of candidates) {
            let isAvailable = false;
            for (const fallback of fallbacks) {
                context.font = `${testSize} '${family}', ${fallback}`;
                const width = context.measureText(testText).width;
                if (Math.abs(width - fallbackWidths[fallback]) > 0.1) {
                    isAvailable = true;
                    break;
                }
            }
            if (isAvailable) detected.push(family);
        }
        return detected;
    }

    hexToRgb(color) {
        if (!color || typeof color !== "string") return null;
        const value = color.trim();
        if (!value.startsWith("#")) return null;
        const hex = value.length === 4
            ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
            : value;
        if (hex.length !== 7) return null;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
        return { r, g, b };
    }

    colorWithAlpha(color, alpha, fallback) {
        const rgb = this.hexToRgb(color);
        if (!rgb) return fallback;
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }

    getMinimapItemColors(item) {
        if (item.type === "frame") {
            const base = item.color || "#8b8f97";
            return {
                fill: this.colorWithAlpha(base, 0.35, "rgba(164, 164, 164, 0.35)"),
                border: this.colorWithAlpha(base, 0.95, "rgba(225, 225, 225, 0.95)")
            };
        }
        if (item.type === "note") {
            const base = item.color || "#ffeb3b";
            return {
                fill: this.colorWithAlpha(base, 0.5, "rgba(255, 235, 59, 0.5)"),
                border: this.colorWithAlpha(base, 0.95, "rgba(255, 241, 118, 0.95)")
            };
        }
        if (item.type === "image") {
            const base = (item.image_palette && item.image_palette[0]) || "#90caf9";
            return {
                fill: this.colorWithAlpha(base, 0.4, "rgba(33, 150, 243, 0.4)"),
                border: this.colorWithAlpha(base, 0.95, "rgba(144, 202, 249, 0.95)")
            };
        }
        if (item.type === "video") {
            return { fill: "rgba(147, 51, 234, 0.35)", border: "rgba(216, 180, 254, 0.9)" };
        }
        if (item.type === "slot") {
            return { fill: "rgba(156, 163, 175, 0.25)", border: "rgba(229, 231, 235, 0.9)" };
        }
        return { fill: "rgba(255, 255, 255, 0.2)", border: "rgba(255, 255, 255, 0.75)" };
    }

    getWorldBounds(padding = 80) {
        const viewportWorld = {
            x: -this.offset.x / this.scale,
            y: -this.offset.y / this.scale,
            w: this.canvasContainer.clientWidth / this.scale,
            h: this.canvasContainer.clientHeight / this.scale
        };
        let minX = viewportWorld.x;
        let minY = viewportWorld.y;
        let maxX = viewportWorld.x + viewportWorld.w;
        let maxY = viewportWorld.y + viewportWorld.h;
        const baseBounds = !this.isInteracting ? this.worldBoundsBaseCache : null;
        if (baseBounds) {
            minX = Math.min(minX, baseBounds.minX);
            minY = Math.min(minY, baseBounds.minY);
            maxX = Math.max(maxX, baseBounds.maxX);
            maxY = Math.max(maxY, baseBounds.maxY);
        } else {
            for (const item of this.getVisibleBoardItems()) {
                minX = Math.min(minX, item.x);
                minY = Math.min(minY, item.y);
                maxX = Math.max(maxX, item.x + item.w);
                maxY = Math.max(maxY, item.y + item.h);
            }
        }
        return {
            viewportWorld,
            minX: minX - padding,
            minY: minY - padding,
            maxX: maxX + padding,
            maxY: maxY + padding
        };
    }

    getViewportWorldRect() {
        if (!this.canvasContainer) return null;
        return getStoryboardViewportWorldRect({
            offset: this.offset,
            scale: this.scale,
            width: this.canvasContainer.clientWidth,
            height: this.canvasContainer.clientHeight,
        });
    }

    shouldActivateMediaForItem(item, element = null, viewportRect = null) {
        const resolvedViewportRect = viewportRect || this.getViewportWorldRect();
        return shouldActivateStoryboardMedia(item, resolvedViewportRect, {
            scale: this.scale,
            marginPx: this.isInteracting ? 1320 : undefined,
            minMarginWorld: this.isInteracting ? 360 : undefined,
            forceActiveIds: this.boardData?.selection || [],
            forceActivate: Boolean(element?.classList?.contains("cropping")),
            currentActive: element?.dataset?.mediaActive !== "false",
            retainMarginMultiplier: this.isInteracting ? 1.8 : undefined,
        });
    }

    deferMediaDeactivation(delayMs = 220) {
        this.mediaDeactivationHoldUntil = Date.now() + delayMs;
        if (this.mediaDeactivationTimer) {
            window.clearTimeout(this.mediaDeactivationTimer);
        }
        this.mediaDeactivationTimer = window.setTimeout(() => {
            this.mediaDeactivationTimer = null;
            this.scheduleVisibleMediaActivation();
        }, delayMs + 16);
    }

    setMediaDormantState(wrapper, item, dormant) {
        if (!wrapper) return;
        let placeholder = wrapper.querySelector(".storyboard-media-dormant");
        if (!placeholder && dormant) {
            placeholder = document.createElement("div");
            placeholder.className = "storyboard-media-dormant";
            wrapper.appendChild(placeholder);
        }
        if (!placeholder) return;
        wrapper.classList.toggle("is-dormant", dormant);
        placeholder.dataset.mediaType = item?.type || "media";
        placeholder.innerHTML = dormant
            ? `<span>${item?.type === "video" ? "Video" : "Image"} loads nearby</span>`
            : "";
        placeholder.style.display = dormant ? "flex" : "none";
        if (dormant) {
            wrapper.classList.remove("is-loading");
        }
    }

    setMediaLoadingState(el, wrapper, loading) {
        if (el) el.classList.toggle("is-media-loading", loading);
        if (wrapper) wrapper.classList.toggle("is-loading", loading);
    }

    setMediaWarmDormantState(el, wrapper, warm) {
        if (el) el.classList.toggle("is-media-warm-dormant", warm);
        if (wrapper) wrapper.classList.toggle("is-warm-dormant", warm);
    }

    cancelPendingMediaUnload(itemId) {
        const timer = this.mediaUnloadTimers.get(itemId);
        if (timer) {
            window.clearTimeout(timer);
            this.mediaUnloadTimers.delete(itemId);
        }
    }

    scheduleMediaUnload(el, item, delayMs = 4200) {
        if (!el || !item?.id) return;
        this.cancelPendingMediaUnload(item.id);
        const timer = window.setTimeout(() => {
            this.mediaUnloadTimers.delete(item.id);
            if (!el.isConnected || el.dataset.mediaActive === "true") return;

            if (item.type === "image") {
                const wrapper = el.querySelector(".image-wrapper");
                const img = el.querySelector(".image-wrapper img");
                if (img) {
                    img.removeAttribute("src");
                    img.removeAttribute("data-src");
                    img.removeAttribute("data-storyboard-desired-src");
                    img.style.display = "none";
                }
                this.setMediaWarmDormantState(el, wrapper, false);
                this.setMediaDormantState(wrapper, item, true);
            } else if (item.type === "video") {
                const wrapper = el.querySelector(".video-wrapper");
                const video = el.querySelector(".video-wrapper video");
                if (video) {
                    video.pause();
                    video.removeAttribute("src");
                    video.removeAttribute("data-src");
                    video.removeAttribute("data-storyboard-desired-src");
                    video.style.display = "none";
                    video.load();
                }
                this.setMediaWarmDormantState(el, wrapper, false);
                this.setMediaDormantState(wrapper, item, true);
            }
        }, delayMs);
        this.mediaUnloadTimers.set(item.id, timer);
    }

    rememberPrewarmedMediaSrc(src) {
        if (!src) return;
        if (this.mediaPrewarmedSrcs.has(src)) {
            this.mediaPrewarmedSrcs.delete(src);
        }
        this.mediaPrewarmedSrcs.add(src);
        while (this.mediaPrewarmedSrcs.size > 256) {
            const oldest = this.mediaPrewarmedSrcs.values().next().value;
            if (!oldest) break;
            this.mediaPrewarmedSrcs.delete(oldest);
        }
    }

    processMediaPrewarmQueue() {
        while (this.mediaPrewarmsInFlight.size < this.maxConcurrentMediaPrewarms && this.mediaPrewarmQueue.length > 0) {
            const next = this.mediaPrewarmQueue.shift();
            if (!next) break;
            const { itemId, src } = next;
            if (!this.itemLookup.has(itemId) || !src || this.mediaPrewarmedSrcs.has(src)) continue;

            this.mediaPrewarmsInFlight.add(src);
            const probe = new Image();
            probe.decoding = "async";
            const finish = () => {
                this.mediaPrewarmsInFlight.delete(src);
                this.rememberPrewarmedMediaSrc(src);
                this.processMediaPrewarmQueue();
            };
            probe.onload = finish;
            probe.onerror = finish;
            probe.src = src;
        }
    }

    scheduleNearbyMediaPrewarm(viewportRect) {
        if (!viewportRect || !Array.isArray(this.boardData?.items)) return;
        const prewarmRect = getStoryboardMediaActivationRect(viewportRect, {
            scale: this.scale,
            marginPx: this.isInteracting ? 2800 : STORYBOARD_MEDIA_PREWARM_MARGIN_PX,
            minMarginWorld: this.isInteracting ? 620 : 520,
        });

        const queuedSrcs = new Set(this.mediaPrewarmQueue.map((entry) => entry.src));
        const activeSrcs = new Set(
            Array.from(this.itemElements.values())
                .filter((element) => element?.dataset?.mediaActive === "true")
                .map((element) => element.querySelector(".image-wrapper img")?.getAttribute("data-src"))
                .filter(Boolean),
        );

        const candidates = this.getVisibleBoardItems()
            .filter((item) => item?.type === "image" && item.image_ref)
            .filter((item) => itemIntersectsWorldRect(item, prewarmRect))
            .map((item) => ({
                item,
                src: `/mkr/storyboard/asset/${this.boardId}/${item.image_ref}`,
            }))
            .filter(({ item, src }) => !activeSrcs.has(src) && !queuedSrcs.has(src) && !this.mediaPrewarmsInFlight.has(src) && !this.mediaPrewarmedSrcs.has(src))
            .sort((left, right) => getStoryboardMediaViewportDistance(left.item, viewportRect) - getStoryboardMediaViewportDistance(right.item, viewportRect))
            .slice(0, 12);

        candidates.forEach(({ item, src }) => {
            this.mediaPrewarmQueue.push({ itemId: item.id, src });
        });

        this.processMediaPrewarmQueue();
    }

    finishQueuedMediaLoad(itemId, element = null, wrapper = null) {
        requestAnimationFrame(() => {
            if (itemId) this.mediaLoadsInFlight.delete(itemId);
            if (element && wrapper && element.dataset.mediaActive === "true") {
                this.setMediaLoadingState(element, wrapper, false);
            }
            this.processMediaLoadQueue();
        });
    }

    bindMediaLoadLifecycle(el, wrapper, mediaEl, kind = "image") {
        if (!mediaEl || mediaEl.dataset.storyboardLifecycleBound === kind) return;
        const finish = () => this.finishQueuedMediaLoad(el?._itemId, el, wrapper);
        if (kind === "image") {
            mediaEl.addEventListener("load", finish);
        } else {
            mediaEl.addEventListener("loadeddata", finish);
        }
        mediaEl.addEventListener("error", finish);
        mediaEl.dataset.storyboardLifecycleBound = kind;
    }

    enqueueMediaLoad({ item, el, wrapper, mediaEl, src, kind }) {
        if (!item?.id || !el || !wrapper || !mediaEl || !src) return;
        const itemId = item.id;
        this.mediaLoadQueue = this.mediaLoadQueue.filter((entry) => entry.itemId !== itemId);
        this.setMediaLoadingState(el, wrapper, true);

        if (this.mediaLoadsInFlight.has(itemId)) {
            mediaEl.dataset.storyboardDesiredSrc = src;
            return;
        }

        this.mediaLoadQueue.push({ itemId, el, wrapper, mediaEl, src, kind });
        this.processMediaLoadQueue();
    }

    processMediaLoadQueue() {
        while (this.mediaLoadsInFlight.size < this.maxConcurrentMediaLoads && this.mediaLoadQueue.length > 0) {
            const next = this.mediaLoadQueue.shift();
            if (!next) break;
            const { itemId, el, wrapper, mediaEl, src, kind } = next;
            if (!this.itemLookup.has(itemId) || !el?.isConnected || el.dataset.mediaActive !== "true") {
                this.setMediaLoadingState(el, wrapper, false);
                continue;
            }

            this.mediaLoadsInFlight.add(itemId);
            this.cancelPendingMediaUnload(itemId);
            mediaEl.dataset.storyboardDesiredSrc = src;
            if (kind === "video") {
                mediaEl.src = src;
                mediaEl.setAttribute("data-src", src);
                mediaEl.pause();
                if (mediaEl.readyState >= 2) {
                    this.finishQueuedMediaLoad(itemId, el, wrapper);
                }
            } else {
                mediaEl.src = src;
                mediaEl.setAttribute("data-src", src);
                if (mediaEl.complete && mediaEl.naturalWidth > 0) {
                    this.finishQueuedMediaLoad(itemId, el, wrapper);
                }
            }
        }
    }

    releaseDormantMedia(el, item) {
        if (!el || !item) return;
        this.mediaLoadQueue = this.mediaLoadQueue.filter((entry) => entry.itemId !== item.id);
        this.mediaLoadsInFlight.delete(item.id);
        if (item.type === "image") {
            const img = el.querySelector(".image-wrapper img");
            const wrapper = el.querySelector(".image-wrapper");
            const canStayWarm = Boolean(img?.getAttribute("data-src"));
            if (img) {
                img.style.display = "block";
            }
            this.setMediaLoadingState(el, wrapper, false);
            this.setMediaWarmDormantState(el, wrapper, canStayWarm);
            if (canStayWarm) {
                this.setMediaDormantState(wrapper, item, false);
                this.scheduleMediaUnload(el, item);
            } else {
                if (img) img.style.display = "none";
                this.setMediaDormantState(wrapper, item, true);
            }
        } else if (item.type === "video") {
            const video = el.querySelector(".video-wrapper video");
            const wrapper = el.querySelector(".video-wrapper");
            const canStayWarm = Boolean(video?.getAttribute("data-src"));
            if (video) {
                video.pause();
                video.style.display = "block";
            }
            this.setMediaLoadingState(el, wrapper, false);
            this.setMediaWarmDormantState(el, wrapper, canStayWarm);
            if (canStayWarm) {
                this.setMediaDormantState(wrapper, item, false);
                this.scheduleMediaUnload(el, item);
            } else {
                if (video) video.style.display = "none";
                this.setMediaDormantState(wrapper, item, true);
            }
        }
        this.processMediaLoadQueue();
    }

    updateVisibleMediaActivation() {
        this.mediaActivationFrame = null;
        const viewportRect = this.getViewportWorldRect();
        if (!viewportRect) return;
        const holdDeactivations = this.isInteracting || Date.now() < this.mediaDeactivationHoldUntil;
        const pendingActivations = [];
        this.itemElements.forEach((element, itemId) => {
            const item = this.getItemById(itemId);
            if (!item || (item.type !== "image" && item.type !== "video")) return;
            const shouldBeActive = this.shouldActivateMediaForItem(item, element, viewportRect);
            const currentlyActive = element.dataset.mediaActive !== "false";
            if (!shouldBeActive && currentlyActive) {
                if (!holdDeactivations) {
                    this.updateItemContent(element, item, false, { mediaActivationRect: viewportRect });
                }
            } else if (shouldBeActive && !currentlyActive) {
                pendingActivations.push({ item, element });
            }
        });

        pendingActivations
            .sort((left, right) => (
                getStoryboardMediaViewportDistance(left.item, viewportRect)
                - getStoryboardMediaViewportDistance(right.item, viewportRect)
            ))
            .slice(0, STORYBOARD_MEDIA_ACTIVATION_BATCH_SIZE)
            .forEach(({ item, element }) => {
                this.updateItemContent(element, item, false, { mediaActivationRect: viewportRect });
            });

        if (pendingActivations.length > STORYBOARD_MEDIA_ACTIVATION_BATCH_SIZE) {
            this.scheduleVisibleMediaActivation();
        }
        this.scheduleNearbyMediaPrewarm(viewportRect);
        if (holdDeactivations) {
            this.deferMediaDeactivation();
        }
    }

    scheduleVisibleMediaActivation() {
        if (this.mediaActivationFrame !== null) return;
        this.mediaActivationFrame = requestAnimationFrame(() => {
            this.updateVisibleMediaActivation();
        });
    }

    scheduleMinimapUpdate() {
        if (this.minimapFrame !== null) return;
        this.minimapFrame = requestAnimationFrame(() => {
            this.minimapFrame = null;
            this.updateMinimap();
        });
    }

    centerOnWorldPoint(worldX, worldY) {
        this.offset.x = this.canvasContainer.clientWidth * 0.5 - worldX * this.scale;
        this.offset.y = this.canvasContainer.clientHeight * 0.5 - worldY * this.scale;
        this.updateTransform();
    }

    zoomAtPoint(multiplier, pointX, pointY) {
        const oldScale = this.scale;
        const minScale = 0.15;
        const maxScale = 5;
        const nextScale = Math.max(minScale, Math.min(maxScale, this.scale * multiplier));
        if (Math.abs(nextScale - oldScale) < 1e-6) return;
        this.scale = nextScale;
        this.offset.x = pointX - (pointX - this.offset.x) * (this.scale / oldScale);
        this.offset.y = pointY - (pointY - this.offset.y) * (this.scale / oldScale);
        this.updateTransform();
    }

    zoomAtCenter(multiplier) {
        const cx = this.canvasContainer.clientWidth * 0.5;
        const cy = this.canvasContainer.clientHeight * 0.5;
        this.zoomAtPoint(multiplier, cx, cy);
    }

    fitViewToContent() {
        if (!this.canvasContainer) return;
        const { minX, minY, maxX, maxY } = this.getWorldBounds(80);
        const worldW = Math.max(1, maxX - minX);
        const worldH = Math.max(1, maxY - minY);
        const scaleX = this.canvasContainer.clientWidth / worldW;
        const scaleY = this.canvasContainer.clientHeight / worldH;
        this.scale = Math.max(0.15, Math.min(5, Math.min(scaleX, scaleY)));
        this.centerOnWorldPoint(minX + worldW * 0.5, minY + worldH * 0.5);
        this.scheduleViewportSave();
    }

    centerOnContent() {
        if (!this.canvasContainer) return;
        const { minX, minY, maxX, maxY } = this.getWorldBounds(0);
        this.centerOnWorldPoint(minX + (maxX - minX) * 0.5, minY + (maxY - minY) * 0.5);
        this.scheduleViewportSave();
    }

    updateMinimapControls() {
        const label = document.getElementById("storyboard-minimap-zoom-label");
        if (label) {
            const nextValue = `${Math.round(this.scale * 100)}%`;
            if (label.textContent !== nextValue) label.textContent = nextValue;
        }
    }

    updateItemLayoutStyles(el, item, index) {
        const rotation = this.getItemRotation(item);
        const nextState = {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
            rotation,
            zIndex: item.type === "frame" ? 100 + index : 1000 + index,
        };
        const previous = el._layoutState || {};

        if (previous.x !== nextState.x) el.style.left = `${nextState.x}px`;
        if (previous.y !== nextState.y) el.style.top = `${nextState.y}px`;
        if (previous.w !== nextState.w) el.style.width = `${nextState.w}px`;
        if (previous.h !== nextState.h) el.style.height = `${nextState.h}px`;
        if (previous.rotation !== nextState.rotation) {
            el.style.transformOrigin = "center center";
            el.style.transform = nextState.rotation ? `rotate(${nextState.rotation}deg)` : "";
        }
        if (previous.zIndex !== nextState.zIndex) {
            el.style.zIndex = String(nextState.zIndex);
        }

        el._layoutState = nextState;
    }

    renderBoard() {
        this.ensureBoardSettings();
        this.normalizeBoardItemStates({ mirrorLegacyPinned: true });
        const visibleItems = this.getVisibleBoardItems();
        if (visibleItems.length > 0) {
            let minX = Number.POSITIVE_INFINITY;
            let minY = Number.POSITIVE_INFINITY;
            let maxX = Number.NEGATIVE_INFINITY;
            let maxY = Number.NEGATIVE_INFINITY;
            visibleItems.forEach((item) => {
                minX = Math.min(minX, item.x);
                minY = Math.min(minY, item.y);
                maxX = Math.max(maxX, item.x + item.w);
                maxY = Math.max(maxY, item.y + item.h);
            });
            this.worldBoundsBaseCache = { minX, minY, maxX, maxY };
        } else {
            this.worldBoundsBaseCache = null;
        }
        const mediaActivationRect = this.getViewportWorldRect();
        const selectedIds = new Set(this.boardData.selection);
        // Track which items are current to remove old ones later
        const currentItemIds = new Set(visibleItems.map(i => i.id));
        
        // Remove DOM elements for items that no longer exist
        for (const [id, el] of this.itemElements.entries()) {
            if (!currentItemIds.has(id)) {
                el.remove();
                this.itemElements.delete(id);
            }
        }

        visibleItems.forEach((item, index) => {
            let el = this.itemElements.get(item.id);
            let isNew = false;

            if (el && el.dataset.interactionVersion !== STORYBOARD_ITEM_INTERACTION_VERSION) {
                el.remove();
                this.itemElements.delete(item.id);
                el = null;
            }
            
            if (!el) {
                el = document.createElement("div");
                el._itemId = item.id;
                el.className = "storyboard-item";
                el.dataset.interactionVersion = STORYBOARD_ITEM_INTERACTION_VERSION;
                this.itemElements.set(item.id, el);
                this.canvas.appendChild(el);
                isNew = true;
                
                // Add interaction handlers once
                this.addItemInteractions(el, item);
            }

            // Update state
            el.classList.toggle("selected", selectedIds.has(item.id));
            el.classList.toggle("is-locked", this.isItemLocked(item));
            this.updateItemLayoutStyles(el, item, index);
            
            // Update item-type specific content
            this.updateItemContent(el, item, isNew, { mediaActivationRect });
        });

        const settings = this.getBoardSettings();
        if (settings.show_inspector && this.inspectorOpen) {
            this.renderInspector();
        }
        this.scheduleMinimapUpdate();
        this.updateGridOverlay();
        this.updateChromeVisibility();
        this.updateHiddenItemsButton();
    }

    updateMinimap() {
        if (!this.canvasContainer || !this.minimapItems || !this.minimapViewport) return;
        if (!this.getBoardSettings().show_minimap) return;

        const minimapRect = this.minimap.getBoundingClientRect();
        const minimapWidth = Math.max(1, minimapRect.width);
        const minimapHeight = Math.max(1, minimapRect.height);
        const { viewportWorld, minX, minY, maxX, maxY } = this.getWorldBounds(80);

        const worldW = Math.max(1, maxX - minX);
        const worldH = Math.max(1, maxY - minY);
        const mapScale = Math.min(minimapWidth / worldW, minimapHeight / worldH);

        const drawW = worldW * mapScale;
        const drawH = worldH * mapScale;
        const offsetX = (minimapWidth - drawW) / 2;
        const offsetY = (minimapHeight - drawH) / 2;

        this.minimapView = { minX, minY, mapScale, offsetX, offsetY };

        const visibleItems = this.getVisibleBoardItems();
        const currentIds = new Set(visibleItems.map((item) => item.id));
        for (const [id, rect] of this.minimapItemElements.entries()) {
            if (!currentIds.has(id)) {
                rect.remove();
                this.minimapItemElements.delete(id);
            }
        }

        const fragment = document.createDocumentFragment();
        for (const item of visibleItems) {
            let rect = this.minimapItemElements.get(item.id);
            if (!rect) {
                rect = document.createElement("div");
                rect.className = "storyboard-minimap-item";
                this.minimapItemElements.set(item.id, rect);
            }
            const colors = this.getMinimapItemColors(item);
            const nextState = {
                fill: colors.fill,
                border: colors.border,
                left: `${offsetX + (item.x - minX) * mapScale}px`,
                top: `${offsetY + (item.y - minY) * mapScale}px`,
                width: `${Math.max(2, item.w * mapScale)}px`,
                height: `${Math.max(2, item.h * mapScale)}px`,
            };
            const previous = rect._minimapState || {};
            if (previous.fill !== nextState.fill) rect.style.backgroundColor = nextState.fill;
            if (previous.border !== nextState.border) rect.style.borderColor = nextState.border;
            if (previous.left !== nextState.left) rect.style.left = nextState.left;
            if (previous.top !== nextState.top) rect.style.top = nextState.top;
            if (previous.width !== nextState.width) rect.style.width = nextState.width;
            if (previous.height !== nextState.height) rect.style.height = nextState.height;
            rect._minimapState = nextState;
            fragment.appendChild(rect);
        }
        this.minimapItems.replaceChildren(fragment);

        this.minimapViewport.style.left = `${offsetX + (viewportWorld.x - minX) * mapScale}px`;
        this.minimapViewport.style.top = `${offsetY + (viewportWorld.y - minY) * mapScale}px`;
        this.minimapViewport.style.width = `${Math.max(8, viewportWorld.w * mapScale)}px`;
        this.minimapViewport.style.height = `${Math.max(8, viewportWorld.h * mapScale)}px`;
    }

    jumpToMinimap(clientX, clientY) {
        if (!this.minimapView) return;
        const rect = this.minimap.getBoundingClientRect();
        const localX = Math.max(0, Math.min(rect.width, clientX - rect.left));
        const localY = Math.max(0, Math.min(rect.height, clientY - rect.top));
        if (!this.minimapView.mapScale) return;

        const worldX = this.minimapView.minX + (localX - this.minimapView.offsetX) / this.minimapView.mapScale;
        const worldY = this.minimapView.minY + (localY - this.minimapView.offsetY) / this.minimapView.mapScale;
        this.centerOnWorldPoint(worldX, worldY);
    }

    addItemInteractions(el, initialItem) {
        const itemId = initialItem.id;
        let lastPointerDownStamp = -1;
        const isInteractiveTarget = (target) => {
            if (!(target instanceof Element)) return false;
            return Boolean(target.closest([
                "input",
                "textarea",
                "select",
                "button",
                "[contenteditable='true']",
                ".palette-color",
                ".storyboard-resize-handle",
                ".storyboard-crop-glyph",
                ".slot-add-glyph",
                "video",
                "audio",
            ].join(", ")));
        };
        
        // Crop glyph
        if (initialItem.type === "image") {
            const cropGlyph = document.createElement("div");
            cropGlyph.className = "storyboard-crop-glyph";
            // Monochrome SVG crop icon
            cropGlyph.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
                    <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
                </svg>
            `;
            cropGlyph.title = "Edit Crop";
            cropGlyph.onclick = (e) => {
                e.stopPropagation();
                const item = this.getItemById(itemId);
                if (!item) return;
                if (this.isItemLocked(item)) return;
                
                const wasCropping = el.classList.contains("cropping");
                el.classList.toggle("cropping");
                cropGlyph.classList.toggle("active");
                
                if (!wasCropping) {
                    // Entering cropping mode
                    this.isInteracting = true;
                    
                    // Calculate virtual full bounds of image in canvas space
                    const crop = item.crop || { x: 0, y: 0, w: 1, h: 1 };
                    const fullW = item.w / crop.w;
                    const fullH = item.h / crop.h;
                    const fullX = item.x - (crop.x * fullW);
                    const fullY = item.y - (crop.y * fullH);
                    
                    el._fullBounds = { x: fullX, y: fullY, w: fullW, h: fullH };
                    
                    this.renderCropUI(el, item);
                } else {
                    // Exiting cropping mode
                    this.isInteracting = false;
                    // Remove the crop overlay
                    const overlay = el.querySelector(".storyboard-crop-overlay");
                    if (overlay) overlay.remove();
                    
                    this.saveBoard();
                    this.renderBoard();
                }
            };
            el.appendChild(cropGlyph);
        }

        // Resize handle
        const resizeHandle = document.createElement("div");
        resizeHandle.className = "storyboard-resize-handle";
        resizeHandle.onmousedown = (e) => {
            const item = this.getItemById(itemId);
            if (!item) return;
            if (this.isItemLocked(item)) return;
            
            e.stopPropagation();
            e.preventDefault();
            this.isInteracting = true;
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = item.w;
            const startH = item.h;

            const onMouseMove = (moveEvent) => {
                const dw = (moveEvent.clientX - startX) / this.scale;
                const dh = (moveEvent.clientY - startY) / this.scale;
                const settings = this.getBoardSettings();
                
                // Force uniform scaling for images and slots
                if (item.type === "image" || item.type === "video" || item.type === "slot" || moveEvent.shiftKey) {
                    const ratio = startW / startH;
                    if (Math.abs(dw) > Math.abs(dh)) {
                        let nextW = Math.max(50, startW + dw);
                        if (settings.snap) nextW = Math.max(50, snapValueToGrid(nextW, settings));
                        item.w = nextW;
                        item.h = item.w / ratio;
                    } else {
                        let nextH = Math.max(50, startH + dh);
                        if (settings.snap) nextH = Math.max(50, snapValueToGrid(nextH, settings));
                        item.h = nextH;
                        item.w = item.h * ratio;
                    }
                } else {
                    const snapped = settings.snap
                        ? snapSizeToGrid({ w: Math.max(50, startW + dw), h: Math.max(50, startH + dh) }, settings)
                        : { w: Math.max(50, startW + dw), h: Math.max(50, startH + dh) };
                    item.w = snapped.w;
                    item.h = snapped.h;
                }
                
                el.style.width = `${item.w}px`;
                el.style.height = `${item.h}px`;
                
                // If it's a note, we might want to update font size live
                if (item.type === "note") {
                    this.updateItemContent(el, item, false);
                }
            };

            const onMouseUp = () => {
                this.isInteracting = false;
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
                
                if (this.needsReload) {
                    this.loadBoard();
                } else {
                    this.saveBoard();
                    this.renderBoard();
                    
                    // Force update palettes after drag/resize finishes
                    this.boardData.items.forEach(it => {
                        if (it.type === "frame") {
                            const el = this.itemElements.get(it.id);
                            if (el) this.updateFramePalette(el, it);
                        }
                    });
                }
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        };
        el.appendChild(resizeHandle);
        
        const handleItemPress = (e) => {
            if (isInteractiveTarget(e.target)) return;
            if (e.type === "mousedown" && lastPointerDownStamp >= 0 && Math.abs(e.timeStamp - lastPointerDownStamp) < 8) {
                return;
            }
            if (e.type === "pointerdown") {
                lastPointerDownStamp = e.timeStamp;
            }
            this.beginItemDrag(itemId, e);
        };
        el.addEventListener("pointerdown", handleItemPress, true);
        el.addEventListener("mousedown", handleItemPress, true);
    }

    beginItemDrag(itemId, e) {
        const item = this.getItemById(itemId);
        if (!item) return;
        if (e.button !== 0) return;
        if (this.isItemHidden(item)) return;

        e.stopPropagation();
        e.preventDefault();

        const selectionHadItem = this.boardData.selection.includes(itemId);
        const selectionCount = this.boardData.selection.length;
        let selectionChanged = false;

        if (e.shiftKey) {
            if (this.boardData.selection.includes(itemId)) {
                this.boardData.selection = this.boardData.selection.filter(id => id !== itemId);
            } else {
                this.boardData.selection.push(itemId);
            }
            selectionChanged = true;
        } else if (!selectionHadItem || selectionCount <= 1) {
            const nextSelection = [itemId];
            selectionChanged = this.boardData.selection.length !== 1 || this.boardData.selection[0] !== itemId;
            this.boardData.selection = nextSelection;
        } else {
            // Keep the full multi-selection when dragging an already-selected item.
            this.boardData.selection = [...this.boardData.selection];
        }
        if (selectionChanged) {
            this.renderBoard();
        }

        if (this.isItemLocked(item)) {
            this.saveBoard();
            return;
        }

        this.isInteracting = true;
        const startX = e.clientX;
        const startY = e.clientY;
        const usePointerEvents = typeof e.pointerId === "number";
        const pointerId = usePointerEvents ? e.pointerId : null;
        const eventTarget = e.currentTarget instanceof Element ? e.currentTarget : (e.target instanceof Element ? e.target : null);
        if (usePointerEvents && eventTarget?.setPointerCapture) {
            try {
                eventTarget.setPointerCapture(pointerId);
            } catch (_) {
                // Ignore pointer capture failures and continue with window listeners.
            }
        }

        const itemsToMoveIds = new Set(this.boardData.selection);
        this.boardData.selection.forEach(id => {
            const it = this.boardData.items.find(i => i.id === id);
            if (it && it.type === "frame") {
                this.boardData.items.forEach(other => {
                    if (other.id !== it.id &&
                        other.x >= it.x && other.y >= it.y &&
                        (other.x + other.w) <= (it.x + it.w) &&
                        (other.y + other.h) <= (it.y + it.h)) {
                        itemsToMoveIds.add(other.id);
                    }
                });
            }
        });

        const selectedElements = Array.from(itemsToMoveIds).map(id => {
            const it = this.getItemById(id);
            const domEl = this.itemElements.get(id);
            return { item: it, domEl, startX: it.x, startY: it.y };
        }).filter(entry => entry.domEl && entry.item && this.isItemEditable(entry.item));
        const anchorEntry = selectedElements.find(entry => entry.item.id === itemId) || selectedElements[0];
        if (!anchorEntry) {
            this.isInteracting = false;
            this.saveBoard();
            return;
        }
        let dragFinished = false;

        const onMouseMove = (moveEvent) => {
            let dx = (moveEvent.clientX - startX) / this.scale;
            let dy = (moveEvent.clientY - startY) / this.scale;
            const settings = this.getBoardSettings();
            if (settings.snap && anchorEntry) {
                const snapped = snapPointToGrid({
                    x: anchorEntry.startX + dx,
                    y: anchorEntry.startY + dy,
                }, settings);
                dx = snapped.x - anchorEntry.startX;
                dy = snapped.y - anchorEntry.startY;
            }

            selectedElements.forEach(entry => {
                entry.item.x = entry.startX + dx;
                entry.item.y = entry.startY + dy;
                entry.domEl.style.left = `${entry.item.x}px`;
                entry.domEl.style.top = `${entry.item.y}px`;
            });
        };

        const onMouseUp = () => {
            if (dragFinished) return;
            dragFinished = true;
            this.isInteracting = false;
            window.removeEventListener("pointermove", onMouseMove);
            window.removeEventListener("pointerup", onMouseUp);
            window.removeEventListener("pointercancel", onMouseUp);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            if (usePointerEvents && eventTarget?.releasePointerCapture) {
                try {
                    eventTarget.releasePointerCapture(pointerId);
                } catch (_) {
                    // Pointer might already be released.
                }
            }

            if (this.needsReload) {
                this.loadBoard();
            } else {
                this.saveBoard();
                this.renderBoard();

                this.boardData.items.forEach(it => {
                    if (it.type === "frame") {
                        const frameEl = this.itemElements.get(it.id);
                        if (frameEl) this.updateFramePalette(frameEl, it);
                    }
                });
            }
        };

        window.addEventListener("pointermove", onMouseMove);
        window.addEventListener("pointerup", onMouseUp);
        window.addEventListener("pointercancel", onMouseUp);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }

    noteContentOverflows(content) {
        if (!content) return false;
        return content.scrollHeight > content.clientHeight + 1 || content.scrollWidth > content.clientWidth + 1;
    }

    fitNoteTextToBounds(content, item, meta) {
        if (!content || !item) return;

        const style = item.note_style || {};
        const hasMeta = Boolean(meta && meta.style.display !== "none" && meta.childElementCount);
        const metaHeight = hasMeta ? meta.offsetHeight : 0;
        const topPadding = hasMeta ? Math.max(18, metaHeight + 14) : 14;
        const bottomPadding = 10;
        const horizontalPadding = 10;
        const text = String(item.content || "");
        const textLength = Math.max(1, text.trim().length || 1);
        const usableWidth = Math.max(40, item.w - horizontalPadding * 2);
        const usableHeight = Math.max(40, item.h - topPadding - bottomPadding);
        const maxFontSize = Math.max(12, Math.min(style.font_size || 72, item.h * 0.5, 72));
        const minFontSize = 11;

        content.style.padding = `${topPadding}px ${horizontalPadding}px ${bottomPadding}px`;

        let fontSize = style.font_size || (Math.sqrt((usableWidth * usableHeight) / textLength) * 0.82);
        fontSize = Math.max(minFontSize, Math.min(fontSize, maxFontSize));
        content.style.fontSize = `${fontSize}px`;

        let guard = 0;
        while (fontSize > minFontSize && this.noteContentOverflows(content) && guard < 64) {
            fontSize -= 1;
            content.style.fontSize = `${fontSize}px`;
            guard += 1;
        }

        if (!style.font_size) {
            while (fontSize < maxFontSize && guard < 96) {
                const nextFontSize = fontSize + 1;
                content.style.fontSize = `${nextFontSize}px`;
                if (this.noteContentOverflows(content)) {
                    content.style.fontSize = `${fontSize}px`;
                    break;
                }
                fontSize = nextFontSize;
                guard += 1;
            }
        }
    }

    renderCropUI(el, item) {
        let overlay = el.querySelector(".storyboard-crop-overlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.className = "storyboard-crop-overlay";
            overlay.innerHTML = `
                <div class="storyboard-crop-context"></div>
                <div class="storyboard-crop-handle crop-handle-top"></div>
                <div class="storyboard-crop-handle crop-handle-bottom"></div>
                <div class="storyboard-crop-handle crop-handle-left"></div>
                <div class="storyboard-crop-handle crop-handle-right"></div>
            `;
            el.appendChild(overlay);
        }

        const context = overlay.querySelector(".storyboard-crop-context");
        const full = el._fullBounds;
        
        // Show full image dimmed in background
        const src = `/mkr/storyboard/asset/${this.boardId}/${item.image_ref}`;
        context.innerHTML = `<img src="${src}" style="position: absolute; pointer-events: none; opacity: 0.3; filter: grayscale(1);">`;
        const contextImg = context.querySelector("img");

        const updateCrop = () => {
            // Update item crop data based on current slot relative to full bounds
            item.crop = {
                x: (item.x - full.x) / full.w,
                y: (item.y - full.y) / full.h,
                w: item.w / full.w,
                h: item.h / full.h
            };

            // Keep crop within 0-1 bounds
            item.crop.x = Math.max(0, Math.min(1, item.crop.x));
            item.crop.y = Math.max(0, Math.min(1, item.crop.y));
            item.crop.w = Math.max(0.01, Math.min(1 - item.crop.x, item.crop.w));
            item.crop.h = Math.max(0.01, Math.min(1 - item.crop.y, item.crop.h));

            // Sync item element position/size
            el.style.left = `${item.x}px`;
            el.style.top = `${item.y}px`;
            el.style.width = `${item.w}px`;
            el.style.height = `${item.h}px`;

            // Sync context image to stay pinned in world space
            const scaleX = full.w / item.w;
            const scaleY = full.h / item.h;
            contextImg.style.width = `${scaleX * 100}%`;
            contextImg.style.height = `${scaleY * 100}%`;
            contextImg.style.left = `${-(item.x - full.x) * (100 / item.w)}%`;
            contextImg.style.top = `${-(item.y - full.y) * (100 / item.h)}%`;

            // Update the actual image inside the slot
            this.updateItemContent(el, item, false);
        };

        overlay.querySelectorAll(".storyboard-crop-handle").forEach(handle => {
            handle.onmousedown = (e) => {
                e.stopPropagation();
                const startX = e.clientX;
                const startY = e.clientY;
                const initialX = item.x;
                const initialY = item.y;
                const initialW = item.w;
                const initialH = item.h;
                
                const isWest = handle.classList.contains("crop-handle-left");
                const isEast = handle.classList.contains("crop-handle-right");
                const isNorth = handle.classList.contains("crop-handle-top");
                const isSouth = handle.classList.contains("crop-handle-bottom");

                const onMouseMove = (moveEvent) => {
                    const dx = (moveEvent.clientX - startX) / this.scale;
                    const dy = (moveEvent.clientY - startY) / this.scale;

                    if (isWest) {
                        const right = initialX + initialW;
                        item.x = Math.max(full.x, Math.min(right - 10, initialX + dx));
                        item.w = right - item.x;
                    } else if (isEast) {
                        item.w = Math.max(10, Math.min(full.x + full.w - initialX, initialW + dx));
                    }

                    if (isNorth) {
                        const bottom = initialY + initialH;
                        item.y = Math.max(full.y, Math.min(bottom - 10, initialY + dy));
                        item.h = bottom - item.y;
                    } else if (isSouth) {
                        item.h = Math.max(10, Math.min(full.y + full.h - initialY, initialH + dy));
                    }
                    updateCrop();
                };

                const onMouseUp = () => {
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("mouseup", onMouseUp);
                };

                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
            };
        });

        updateCrop();
    }

    handleCopy() {
        if (this.boardData.selection.length > 0) {
            const selectedItems = this.getSelectedItems();
            if (selectedItems.some((item) => this.isItemLocked(item))) {
                alert("Unlock the selected items before copying them.");
                return;
            }
            this.internalClipboard = cloneStoryboardItemsForPaste(selectedItems, {
                generateId: (item) => item.id,
                offsetX: 0,
                offsetY: 0,
            });
        }
    }

    handlePaste() {
        if (this.internalClipboard.length > 0) {
            const duplicatedItems = cloneStoryboardItemsForPaste(this.internalClipboard, {
                generateId: () => this.generateUUID(),
                offsetX: 20,
                offsetY: 20,
            });
            this.boardData.items.push(...duplicatedItems);
            this.boardData.selection = duplicatedItems.map((item) => item.id).filter(Boolean);
            this.renderBoard();
            this.saveBoard();
        }
    }

    async handlePasteImage(file) {
        const formData = new FormData();
        formData.append("image", file);
        
        try {
            const response = await fetch(`/mkr/storyboard/${this.boardId}/upload`, {
                method: "POST",
                body: formData
            });
            const result = await response.json();
            const { filename, width, height } = result;
            
            if (filename) {
                // Find a good place to paste (e.g. center of viewport)
                const viewport = this.canvasContainer.getBoundingClientRect();
                const centerX = (viewport.width / 2 - this.offset.x) / this.scale;
                const centerY = (viewport.height / 2 - this.offset.y) / this.scale;
                
                const newItem = createImageItem({
                    x: centerX,
                    y: centerY,
                    imageRef: filename,
                    label: "Pasted Image",
                    imageWidth: width,
                    imageHeight: height,
                    generateId: () => this.generateUUID()
                });
                newItem.x -= newItem.w / 2;
                newItem.y -= newItem.h / 2;
                this.boardData.items.push(newItem);
                this.boardData.selection = [newItem.id];
                this.renderBoard();
                this.saveBoard();
                
                // Trigger palette update if pasted into a frame
                this.boardData.items.forEach(it => {
                    if (it.type === "frame") {
                        const el = this.itemElements.get(it.id);
                        if (el) this.updateFramePalette(el, it);
                    }
                });
            }
        } catch (err) {
            console.error("Failed to upload pasted image:", err);
        }
    }

    updateItemContent(el, item, isNew, options = {}) {
        const extensionDefinition = this.extensionRegistry.get(item.type);
        if ((item.type === "mood_tag" || item.type === "scene_divider") && !this.isItemLocked(item)) {
            item.pinned = false;
        }
        el.classList.remove(
            "image-item",
            "video-item",
            "slot-item",
            "palette-widget-item",
            "note-item",
            "frame-item",
            ...this.extensionRegistry.getCanvasClasses(),
        );
        delete el.dataset.mediaPresentation;
        delete el.dataset.framePresentation;
        if (item.type !== "slot") {
            el.querySelector(".slot-add-glyph")?.remove();
            el.querySelector(".slot-label")?.remove();
            el.querySelector(".slot-hint")?.remove();
            el.removeAttribute("title");
        }
        // Reference Pill
        let pill = el.querySelector(".storyboard-ref-pill");
        if (item.ref_id) {
            if (!pill) {
                pill = document.createElement("div");
                pill.className = "storyboard-ref-pill";
                el.appendChild(pill);
            }
            pill.innerText = `REF ${item.ref_id}`;
        } else if (pill) {
            pill.remove();
        }

        let lockGlyph = el.querySelector(".storyboard-lock-glyph");
        if (this.isItemLocked(item)) {
            if (!lockGlyph) {
                lockGlyph = document.createElement("div");
                lockGlyph.className = "storyboard-lock-glyph";
                lockGlyph.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                        <path d="M8 11V8.5a4 4 0 1 1 8 0V11"></path>
                        <rect x="6" y="11" width="12" height="9" rx="2"></rect>
                    </svg>
                `;
                lockGlyph.title = "Locked";
                el.appendChild(lockGlyph);
            }
        } else if (lockGlyph) {
            lockGlyph.remove();
        }

        if (item.type === "image") {
            el.classList.add("image-item");
            const mediaPresentation = this.getMediaPresentation(item);
            const mediaActive = this.shouldActivateMediaForItem(item, el, options.mediaActivationRect || null);
            el.dataset.mediaPresentation = mediaPresentation;
            el.dataset.mediaActive = mediaActive ? "true" : "false";
            el.classList.toggle("is-media-dormant", !mediaActive);
            let wrapper = el.querySelector(".image-wrapper");
            if (!wrapper) {
                wrapper = document.createElement("div");
                wrapper.className = "image-wrapper";
                el.appendChild(wrapper);
            }
            
            let img = wrapper.querySelector("img");
            if (!img) {
                img = document.createElement("img");
                img.draggable = false;
                img.decoding = "async";
                img.loading = "eager";
                img.fetchPriority = "high";
                wrapper.appendChild(img);
            }
            this.bindMediaLoadLifecycle(el, wrapper, img, "image");
            const src = `/mkr/storyboard/asset/${this.boardId}/${item.image_ref}`;
            if (!mediaActive) {
                this.releaseDormantMedia(el, item);
            } else {
                this.cancelPendingMediaUnload(item.id);
                this.setMediaDormantState(wrapper, item, false);
                img.style.display = "block";
                if (img.getAttribute("data-src") !== src) {
                    this.enqueueMediaLoad({ item, el, wrapper, mediaEl: img, src, kind: "image" });
                } else if (img.complete && img.naturalWidth > 0) {
                    this.setMediaLoadingState(el, wrapper, false);
                }
            }
            const cropGlyph = el.querySelector(".storyboard-crop-glyph");
            if (cropGlyph) cropGlyph.style.display = this.isItemLocked(item) ? "none" : "";

            // Apply crop to display
            if (mediaActive && item.crop) {
                const { x, y, w, h } = item.crop;
                
                // We use percentage-based scaling to show the cropped area.
                // scaleX = 1/w, scaleY = 1/h.
                // To keep it centered and non-stretched, we use object-fit: cover on the image.
                const scaleX = 1 / Math.max(0.01, w);
                const scaleY = 1 / Math.max(0.01, h);
                
                img.style.width = `${scaleX * 100}%`;
                img.style.height = `${scaleY * 100}%`;
                img.style.left = `${-x * scaleX * 100}%`;
                img.style.top = `${-y * scaleY * 100}%`;
                img.style.objectFit = "cover"; 
            } else if (mediaActive) {
                img.style.width = "100%";
                img.style.height = "100%";
                img.style.left = "0";
                img.style.top = "0";
                img.style.objectFit = "cover";
            }

            this.renderMediaMeta(el, item, "image-meta", mediaPresentation);
            if (mediaActive) {
                this.updateImagePalette(el, item);
            } else {
                const mediaMeta = el.querySelector(".image-meta");
                if (mediaMeta) mediaMeta.style.display = "none";
                const paletteBar = el.querySelector(".image-palette-bar");
                if (paletteBar) paletteBar.style.display = "none";
            }
        } else if (item.type === "video") {
            el.classList.add("video-item");
            const mediaPresentation = this.getMediaPresentation(item);
            const mediaActive = this.shouldActivateMediaForItem(item, el, options.mediaActivationRect || null);
            el.dataset.mediaPresentation = mediaPresentation;
            el.dataset.mediaActive = mediaActive ? "true" : "false";
            el.classList.toggle("is-media-dormant", !mediaActive);
            let wrapper = el.querySelector(".video-wrapper");
            if (!wrapper) {
                wrapper = document.createElement("div");
                wrapper.className = "video-wrapper";
                el.appendChild(wrapper);
            }

            let video = wrapper.querySelector("video");
            if (!video) {
                video = document.createElement("video");
                video.controls = true;
                video.autoplay = false;
                video.preload = "metadata";
                video.muted = true;
                video.loop = true;
                video.playsInline = true;
                video.draggable = false;
                wrapper.appendChild(video);
            }
            this.bindMediaLoadLifecycle(el, wrapper, video, "video");
            const src = `/mkr/storyboard/asset/${this.boardId}/${item.video_ref}`;
            if (!mediaActive) {
                this.releaseDormantMedia(el, item);
            } else {
                this.cancelPendingMediaUnload(item.id);
                this.setMediaDormantState(wrapper, item, false);
                video.style.display = "block";
                if (video.getAttribute("data-src") !== src) {
                    this.enqueueMediaLoad({ item, el, wrapper, mediaEl: video, src, kind: "video" });
                } else if (video.readyState >= 2) {
                    this.setMediaLoadingState(el, wrapper, false);
                }
            }

            this.renderMediaMeta(el, item, "video-meta", mediaPresentation);
            if (!mediaActive) {
                const mediaMeta = el.querySelector(".video-meta");
                if (mediaMeta) mediaMeta.style.display = "none";
            }
            
        } else if (item.type === "slot") {
            el.classList.add("slot-item");
            let addGlyph = el.querySelector(".slot-add-glyph");
            if (!addGlyph) {
                addGlyph = document.createElement("button");
                addGlyph.type = "button";
                addGlyph.className = "slot-add-glyph";
                addGlyph.textContent = "+";
                el.appendChild(addGlyph);
            }
            let label = el.querySelector(".slot-label");
            if (!label) {
                label = document.createElement("div");
                label.className = "slot-label";
                el.appendChild(label);
            }
            let hint = el.querySelector(".slot-hint");
            if (!hint) {
                hint = document.createElement("div");
                hint.className = "slot-hint";
                el.appendChild(hint);
            }
            hint.innerText = "Click to add media";
            const visibleLabel = item.label && !["New Slot", "Empty Slot"].includes(item.label) ? item.label : "";
            label.innerText = visibleLabel;
            label.style.display = visibleLabel ? "block" : "none";
            el.title = "Empty slot";
            addGlyph.disabled = this.isItemLocked(item);
            addGlyph.title = this.isItemLocked(item)
                ? "Unlock this slot before importing media"
                : "Click to import image or video";
            addGlyph.setAttribute("aria-label", `Add media to ${item.label || "empty slot"}`);
            addGlyph.onmousedown = (e) => e.stopPropagation();
            addGlyph.onclick = (e) => {
                e.stopPropagation();
                if (this.isItemLocked(item)) return;
                this.promptImportForSlot(item.id);
            };
            
        } else if (item.type === "palette") {
            el.classList.add("palette-widget-item");
            let container = el.querySelector(".palette-widget");
            if (!container) {
                container = document.createElement("div");
                container.className = "palette-widget";
                el.appendChild(container);
            }
            let linkBadge = el.querySelector(".palette-link-badge");
            if (item.palette_source_id) {
                if (!linkBadge) {
                    linkBadge = document.createElement("div");
                    linkBadge.className = "palette-link-badge";
                    el.appendChild(linkBadge);
                }
                linkBadge.innerText = "🔗";
                linkBadge.title = `Linked to ${item.palette_source_id}`;
            } else if (linkBadge) {
                linkBadge.remove();
            }
            const sourceItem = this.boardData.items.find(i => i.id === item.palette_source_id);
            const palettePosition = sourceItem?.palette_position || "left";
            container.classList.toggle("left-position", palettePosition === "left");
            container.classList.toggle("bottom-position", palettePosition !== "left");
            const colors = item.palette_data || [];

            if (sourceItem) {
                if (palettePosition === "left") {
                    item.w = 170;
                    item.h = Math.max(170, colors.length * 66);
                } else {
                    item.w = Math.max(170, colors.length * 66);
                    item.h = 170;
                }
                const position = this.getPaletteWidgetPosition(sourceItem, item.w, item.h);
                item.x = position.x;
                item.y = position.y;
                el.style.left = `${item.x}px`;
                el.style.top = `${item.y}px`;
                el.style.width = `${item.w}px`;
                el.style.height = `${item.h}px`;
            }

            this.renderPaletteWidgetColors(container, colors);
            
        } else if (item.type === "note") {
            el.classList.add("note-item");
            const bgColor = item.color || "#ffeb3b";
            el.style.backgroundColor = bgColor;
            el.style.color = this.getContrastColor(bgColor);

            const meta = this.renderNoteMeta(el, item);
            
            let content = el.querySelector(".note-content");
            if (!content) {
                content = document.createElement("div");
                content.className = "note-content";
                el.appendChild(content);
            }
            content.contentEditable = !this.isItemLocked(item);
            content.spellcheck = false;
            if (content.innerText !== (item.content || "")) {
                content.innerText = item.content || "";
            }
            content.onmousedown = (e) => e.stopPropagation();
            content.oninput = () => {
                item.content = content.innerText;
                this.fitNoteTextToBounds(content, item, meta);
            };
            content.onpaste = (e) => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData("text/plain");
                document.execCommand("insertText", false, text);
                requestAnimationFrame(() => this.fitNoteTextToBounds(content, item, meta));
            };
            content.onblur = () => {
                item.content = content.innerText;
                this.saveBoard();
            };
            
            const style = item.note_style || {};
            content.style.fontFamily = style.font_family || "'Roboto', sans-serif";
            content.style.fontWeight = style.font_weight || "700";
            content.style.textAlign = style.text_align || "center";
            this.fitNoteTextToBounds(content, item, meta);
            
        } else if (item.type === "frame") {
            el.classList.add("frame-item");
            const framePresentation = this.getFramePresentation(item);
            el.dataset.framePresentation = framePresentation;
            const frameColor = item.color || DEFAULT_FRAME_COLOR;
            el.style.borderColor = frameColor;
            let header = el.querySelector(".frame-header");
            if (!header) {
                header = document.createElement("div");
                header.className = "frame-header";
                header.innerHTML = `
                    <div class="frame-header-row">
                        <div class="frame-scene-badge"></div>
                        <div class="frame-label"></div>
                    </div>
                    <div class="frame-subtitle"></div>
                `;
                el.appendChild(header);
            }
            const sceneBadge = header.querySelector(".frame-scene-badge");
            const label = header.querySelector(".frame-label");
            const subtitle = header.querySelector(".frame-subtitle");
            const sceneCode = (item.scene_code || "").trim();
            const titleText = (item.label || "").trim();
            const subtitleText = (item.scene_subtitle || "").trim();

            sceneBadge.innerText = sceneCode;
            sceneBadge.style.display = sceneCode ? "inline-flex" : "none";
            sceneBadge.style.backgroundColor = frameColor;
            sceneBadge.style.color = this.getContrastColor(frameColor);

            label.innerText = titleText || "Frame";
            label.style.backgroundColor = frameColor;
            label.style.color = this.getContrastColor(frameColor);
            label.style.display = titleText || sceneCode ? "inline-flex" : "none";

            subtitle.innerText = subtitleText;
            subtitle.style.display = subtitleText ? "block" : "none";
            header.style.display = (sceneCode || titleText || subtitleText) ? "flex" : "none";

            // Update palette bar
            this.updateFramePalette(el, item);
        } else if (typeof extensionDefinition?.updateItemContent === "function") {
            extensionDefinition.updateItemContent({ workspace: this, element: el, item, isNew });
        } else {
            el.classList.add("slot-item");
            let label = el.querySelector(".slot-label");
            if (!label) {
                label = document.createElement("div");
                label.className = "slot-label";
                el.appendChild(label);
            }
            let hint = el.querySelector(".slot-hint");
            if (!hint) {
                hint = document.createElement("div");
                hint.className = "slot-hint";
                el.appendChild(hint);
            }
            label.innerText = extensionDefinition?.title || item.type || "Custom Item";
            label.style.display = "block";
            hint.innerText = "Custom storyboard extension";
        }
    }

    async updateFramePalette(el, item) {
        let paletteBar = el.querySelector(".frame-palette-bar");
        if (!paletteBar) {
            paletteBar = document.createElement("div");
            paletteBar.className = "frame-palette-bar";
            el.appendChild(paletteBar);
        }

        if (item.palette_hidden) {
            paletteBar.style.display = "none";
            return;
        }

        const framePalettePosition = item.palette_position || "bottom";
        if (framePalettePosition === "left") {
            paletteBar.dataset.position = "left";
            paletteBar.style.left = "-14px";
            paletteBar.style.bottom = "50%";
            paletteBar.style.transform = "translate(-100%, 50%)";
            paletteBar.style.flexDirection = "column";
        } else {
            paletteBar.dataset.position = "bottom";
            paletteBar.style.left = "50%";
            paletteBar.style.bottom = "-170px";
            paletteBar.style.transform = "translateX(-50%)";
            paletteBar.style.flexDirection = "row";
        }

        // Use a small timeout to ensure boardData is updated if this was called from a move
        const imagesInFrame = this.boardData.items
            .filter(it => it.type === "image" && it.image_ref &&
                (it.x + it.w / 2) >= item.x && (it.y + it.h / 2) >= item.y &&
                (it.x + it.w / 2) <= (item.x + item.w) &&
                (it.y + it.h / 2) <= (item.y + item.h));
        
        const containedImageIds = imagesInFrame
            .map(it => `${it.id}_${it.image_ref}_${JSON.stringify(it.crop || {})}`)
            .sort()
            .join(",");

        const paletteCount = item.palette_colors || 8;
        const cacheKey = `${item.id}_${paletteCount}_${containedImageIds}`;
        const cached = this.paletteCache.get(item.id);

        if (cached && cached.key === cacheKey) {
            this.renderPaletteColors(paletteBar, cached.colors);
            paletteBar.style.display = "flex";
            return;
        }

        if (this.paletteLoading.has(item.id)) return;

        if (imagesInFrame.length === 0) {
            paletteBar.style.display = "none";
            this.paletteCache.delete(item.id);
            return;
        }

        paletteBar.style.display = "flex";
        this.paletteLoading.add(item.id);
        try {
            const response = await fetch(`/mkr/storyboard/${this.boardId}/palette/${item.id}?num_colors=${paletteCount}`);
            const { colors } = await response.json();
            if (colors && colors.length > 0) {
                this.paletteCache.set(item.id, { key: cacheKey, colors });
                this.renderPaletteColors(paletteBar, colors);
            } else {
                paletteBar.style.display = "none";
            }
        } catch (err) {
            console.error("Failed to fetch palette:", err);
            paletteBar.style.display = "none";
        } finally {
            this.paletteLoading.delete(item.id);
        }
    }

    updateImagePalette(el, item) {
        let paletteBar = el.querySelector(".image-palette-bar");
        if (!paletteBar) {
            paletteBar = document.createElement("div");
            paletteBar.className = "image-palette-bar";
            el.appendChild(paletteBar);
        }

        const colors = item.image_palette || [];
        if (!item.image_palette_visible || !colors.length) {
            paletteBar.style.display = "none";
            return;
        }

        const palettePosition = item.palette_position || "left";
        if (paletteBar.dataset.position !== palettePosition) {
            if (palettePosition === "left") {
                paletteBar.dataset.position = "left";
                paletteBar.style.left = "-14px";
                paletteBar.style.bottom = "50%";
                paletteBar.style.transform = "translate(-100%, 50%)";
                paletteBar.style.flexDirection = "column";
            } else {
                paletteBar.dataset.position = "bottom";
                paletteBar.style.left = "50%";
                paletteBar.style.bottom = "-170px";
                paletteBar.style.transform = "translateX(-50%)";
                paletteBar.style.flexDirection = "row";
            }
        }

        paletteBar.style.display = "flex";
        this.renderPaletteColors(paletteBar, colors);
    }

    async loadImagePalette(item) {
        const paletteCount = item.palette_colors || 8;
        const response = await fetch(`/mkr/storyboard/${this.boardId}/palette/image/${item.id}?num_colors=${paletteCount}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        if (!result.colors || !result.colors.length) return false;
        item.image_palette = result.colors;
        item.image_palette_count = paletteCount;
        return true;
    }

    async copyToClipboard(text) {
        console.log("Copying to clipboard:", text);
        return copyTextToClipboard(text);
    }

    renderPaletteColors(bar, colors) {
        const signature = JSON.stringify(colors || []);
        if (bar.dataset.paletteSignature === signature) return;
        bar.dataset.paletteSignature = signature;
        bar.replaceChildren();
        const fragment = document.createDocumentFragment();
        colors.forEach(c => {
            const dot = document.createElement("div");
            dot.className = "palette-color";
            dot.style.backgroundColor = c;
            dot.style.color = this.getContrastColor(c);
            
            const span = document.createElement("span");
            span.innerText = c.toUpperCase();
            dot.appendChild(span);

            // Prevent frame/item drag handlers from stealing this interaction.
            dot.onmousedown = (e) => {
                e.stopPropagation();
            };
            dot.onpointerdown = (e) => {
                e.stopPropagation();
            };
            
            dot.title = `Click to copy: ${c}`;
            dot.onclick = async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const text = c.toUpperCase();
                
                console.log("Color clicked:", text);
                
                const success = await this.copyToClipboard(text);

                if (success) {
                    console.log("Copy success!");
                    this.showCopyFeedback(dot);
                } else {
                    console.warn(`Copy failed for ${text}`);
                }
            };
            fragment.appendChild(dot);
        });
        bar.appendChild(fragment);
    }

    renderNoteMeta(el, item) {
        let meta = el.querySelector(".note-meta");
        if (!meta) {
            meta = document.createElement("div");
            meta.className = "note-meta";
            el.appendChild(meta);
        }

        const label = item.label || "";
        const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
        const signature = JSON.stringify({ label, tags });
        if (meta.dataset.renderSignature === signature) {
            meta.style.display = (label || tags.length) ? "flex" : "none";
            return meta;
        }

        meta.dataset.renderSignature = signature;
        meta.replaceChildren();
        const fragment = document.createDocumentFragment();

        if (label) {
            const labelChip = document.createElement("div");
            labelChip.className = "note-chip note-chip-label";
            labelChip.innerText = label;
            fragment.appendChild(labelChip);
        }

        tags.forEach(tag => {
            const tagChip = document.createElement("div");
            tagChip.className = "note-chip note-chip-tag";
            tagChip.innerText = `#${tag}`;
            fragment.appendChild(tagChip);
        });

        meta.appendChild(fragment);
        meta.style.display = meta.children.length > 0 ? "flex" : "none";
        return meta;
    }

    renderPaletteWidgetColors(container, colors) {
        const signature = JSON.stringify(colors || []);
        if (container.dataset.paletteSignature === signature) return;
        container.dataset.paletteSignature = signature;
        container.replaceChildren();
        const fragment = document.createDocumentFragment();

        colors.forEach(hex => {
            const pill = document.createElement("div");
            pill.className = "palette-color";
            pill.style.backgroundColor = hex;
            pill.style.color = this.getContrastColor(hex);
            pill.innerText = hex.toUpperCase();
            pill.title = `Click to copy: ${hex}`;
            pill.onmousedown = (e) => e.stopPropagation();
            pill.onclick = async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const success = await this.copyToClipboard(hex.toUpperCase());
                if (success) this.showCopyFeedback(pill);
            };
            fragment.appendChild(pill);
        });

        container.appendChild(fragment);
    }

    showCopyFeedback(el) {
        const originalTransform = el.style.transform;
        el.style.transform = "scale(1.2)";
        setTimeout(() => el.style.transform = originalTransform, 200);
    }

    getPaletteWidgetPosition(sourceItem, paletteWidth, paletteHeight) {
        const position = sourceItem.palette_position || "left";
        if (position === "bottom") {
            return {
                x: sourceItem.x + (sourceItem.w - paletteWidth) / 2,
                y: sourceItem.y + sourceItem.h + 20
            };
        }
        return {
            x: sourceItem.x - paletteWidth - 20,
            y: sourceItem.y + (sourceItem.h - paletteHeight) / 2
        };
    }

    isMoodboardContentItem(item) {
        return isStoryboardContentItem(item);
    }

    isTiltableItem(item) {
        return isStoryboardTiltableItem(item);
    }

    normalizeRotation(value) {
        return normalizeStoryboardRotation(value);
    }

    getItemRotation(item) {
        return getStoryboardItemRotation(item);
    }

    setItemRotation(item, value) {
        return setStoryboardItemRotation(item, value);
    }

    straightenItems(items) {
        (items || []).forEach(item => this.setItemRotation(item, 0));
    }

    getMediaPresentation(item) {
        return getStoryboardMediaPresentation(item);
    }

    setMediaPresentation(item, value) {
        return setStoryboardMediaPresentation(item, value);
    }

    applyMediaPresentation(items, value) {
        (items || []).forEach(item => {
            if (isMediaPresentationItem(item)) this.setMediaPresentation(item, value);
        });
    }

    getFramePresentation(item) {
        return getStoryboardFramePresentation(item);
    }

    setFramePresentation(item, value) {
        return setStoryboardFramePresentation(item, value);
    }

    applyFramePresentation(items, value) {
        (items || []).forEach(item => {
            if (isFramePresentationItem(item)) this.setFramePresentation(item, value);
        });
    }

    getNextFrameSceneCode() {
        const numericCodes = this.boardData.items
            .filter(item => item?.type === "frame")
            .map(item => parseInt(String(item.scene_code || "").trim(), 10))
            .filter(code => Number.isFinite(code));
        const nextCode = numericCodes.length ? Math.max(...numericCodes) + 1 : 1;
        return formatStoryboardSceneCode(nextCode);
    }

    renumberFrames(items, startAt = 1) {
        const frames = (items || []).filter(item => item?.type === "frame");
        const orderedFrames = sortItemsByStoryboardOrder(frames);
        orderedFrames.forEach((frame, index) => {
            frame.scene_code = formatStoryboardSceneCode(startAt + index);
        });
        return orderedFrames.length;
    }

    getItemsBounds(items) {
        return getStoryboardItemsBounds(items);
    }

    getItemsInFrame(frame) {
        if (!frame || frame.type !== "frame") return [];
        return this.getVisibleBoardItems().filter(item => {
            if (!this.isMoodboardContentItem(item)) return false;
            const centerX = item.x + (item.w / 2);
            const centerY = item.y + (item.h / 2);
            return (
                centerX >= frame.x &&
                centerY >= frame.y &&
                centerX <= (frame.x + frame.w) &&
                centerY <= (frame.y + frame.h)
            );
        });
    }

    arrangeItemsAsMoodboard(items, options = {}) {
        return arrangeMoodboardLayout(items, options);
    }

    arrangeItemsAsStoryStrip(items, options = {}) {
        return arrangeStoryStripLayout(items, options);
    }

    arrangeItemsAsStack(items, options = {}) {
        return arrangeStackLayout(items, options);
    }

    createFrameFromItems(items, label = "Moodboard Frame") {
        const contentItems = (items || []).filter(item => this.isMoodboardContentItem(item));
        if (!contentItems.length) return null;

        const bounds = this.getItemsBounds(contentItems);
        if (!bounds) return null;

        const frame = {
            id: this.generateUUID(),
            type: "frame",
            x: Math.round(bounds.x - 40),
            y: Math.round(bounds.y - 40),
            w: Math.round(bounds.w + 80),
            h: Math.round(bounds.h + 80),
            label,
            color: DEFAULT_FRAME_COLOR,
            frame_presentation: "board",
            scene_code: this.getNextFrameSceneCode(),
        };

        this.boardData.items.push(frame);
        this.boardData.selection = [frame.id];
        return frame;
    }

    restackItems(items, comparator = null) {
        const targetItems = (items || []).filter(Boolean);
        if (!targetItems.length) return;

        const targetIds = new Set(targetItems.map(item => item.id));
        const orderedItems = [...targetItems];
        if (typeof comparator === "function") orderedItems.sort(comparator);

        this.boardData.items = [
            ...this.boardData.items.filter(item => !targetIds.has(item.id)),
            ...orderedItems,
        ];
    }

    renderMediaMeta(el, item, metaClassName, presentation) {
        let meta = el.querySelector(`.${metaClassName}`);
        if (!meta) {
            meta = document.createElement("div");
            meta.className = metaClassName;
            el.appendChild(meta);
        }

        const label = (item.label || "").trim();
        const tags = (item.tags || []).filter(Boolean);
        const showTags = presentation !== "polaroid";
        const captionText = getMediaCaptionText(item, presentation);
        const signature = JSON.stringify({
            presentation,
            label,
            tags,
            showTags,
            captionText,
        });

        if (meta.dataset.renderSignature === signature) {
            return meta;
        }

        meta.dataset.presentation = presentation;
        meta.dataset.renderSignature = signature;
        meta.replaceChildren();
        const fragment = document.createDocumentFragment();

        if (captionText) {
            const labelChip = document.createElement("div");
            labelChip.className = "image-chip image-chip-label";
            labelChip.innerText = captionText;
            fragment.appendChild(labelChip);
        }

        if (showTags) {
            tags.forEach(tag => {
                const tagChip = document.createElement("div");
                tagChip.className = "image-chip image-chip-tag";
                tagChip.innerText = `#${tag}`;
                fragment.appendChild(tagChip);
            });
        } else if (!label && tags.length > 1) {
            const extraTagText = document.createElement("div");
            extraTagText.className = "image-chip image-chip-tag";
            extraTagText.innerText = `+${tags.length - 1} tags`;
            fragment.appendChild(extraTagText);
        }

        meta.appendChild(fragment);
        meta.style.display = meta.children.length > 0 ? "flex" : "none";
        return meta;
    }

    autoArrangeFrame(frame) {
        if (!frame || frame.type !== "frame") return;
        if (this.isItemLocked(frame)) return;

        const margin = 24;
        const gap = 20;
        const visibleFrameItems = this.getItemsInFrame(frame);
        if (visibleFrameItems.some((item) => this.isItemLocked(item))) return;
        const itemsInFrame = visibleFrameItems.slice().sort((a, b) => {
            if (Math.abs(a.y - b.y) > 10) return a.y - b.y;
            return a.x - b.x;
        });

        if (!itemsInFrame.length) return;

        const count = itemsInFrame.length;
        const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
        const rows = Math.ceil(count / cols);
        const colWidths = Array(cols).fill(0);
        const rowHeights = Array(rows).fill(0);

        itemsInFrame.forEach((it, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            colWidths[col] = Math.max(colWidths[col], it.w);
            rowHeights[row] = Math.max(rowHeights[row], it.h);
        });

        const xOffsets = [];
        const yOffsets = [];
        let cursorX = frame.x + margin;
        for (let c = 0; c < cols; c++) {
            xOffsets.push(cursorX);
            cursorX += colWidths[c] + gap;
        }
        let cursorY = frame.y + margin;
        for (let r = 0; r < rows; r++) {
            yOffsets.push(cursorY);
            cursorY += rowHeights[r] + gap;
        }

        itemsInFrame.forEach((it, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            it.x = xOffsets[col] + (colWidths[col] - it.w) / 2;
            it.y = yOffsets[row] + (rowHeights[row] - it.h) / 2;
        });

        const contentW = colWidths.reduce((sum, w) => sum + w, 0) + ((cols - 1) * gap);
        const contentH = rowHeights.reduce((sum, h) => sum + h, 0) + ((rows - 1) * gap);
        frame.w = (margin * 2) + contentW;
        frame.h = (margin * 2) + contentH;
    }

    buildInspectorRenderSignature() {
        const selectionIds = this.boardData?.selection || [];
        if (!selectionIds.length) {
            return JSON.stringify({
                mode: "empty",
                hidden: this.getHiddenBoardItems().length,
                locked: this.getLockedBoardItems().length,
                groups: this.boardData?.groups?.length || 0,
            });
        }

        const selectedItems = selectionIds
            .map((itemId) => this.getItemById(itemId))
            .filter(Boolean)
            .map((item) => ({
                id: item.id,
                type: item.type,
                hidden: Boolean(item.hidden),
                locked: Boolean(item.locked),
                label: item.label || "",
                ref_id: item.ref_id || 0,
                color: item.color || "",
                presentation: item.media_presentation || item.frame_presentation || "",
                tags: Array.isArray(item.tags) ? item.tags.join("|") : "",
                scene_code: item.scene_code || "",
                scene_subtitle: item.scene_subtitle || "",
            }));

        return JSON.stringify({
            mode: selectionIds.length === 1 ? "single" : "multi",
            selection: selectedItems,
            groups: this.boardData?.groups?.length || 0,
            hidden: this.getHiddenBoardItems().length,
            locked: this.getLockedBoardItems().length,
        });
    }

    renderInspector() {
        const content = document.getElementById("inspector-content");
        const signature = this.buildInspectorRenderSignature();
        if (signature === this.inspectorRenderSignature) return;
        this.inspectorRenderSignature = signature;
        if (this.boardData.selection.length === 0) {
            const hiddenCount = this.getHiddenBoardItems().length;
            const lockedCount = this.getLockedBoardItems().length;
            content.innerHTML = `
                <div class="inspector-summary">No active selection</div>
                <div class="storyboard-collection-empty">
                    ${hiddenCount} hidden · ${lockedCount} locked
                    ${hiddenCount > 0 ? `<br><button id="action-reveal-hidden-inline" type="button">Reveal Hidden Items</button>` : ""}
                </div>
                ${this.renderCollectionsSection({
                    title: "Board Collections",
                    emptyMessage: "Select items, then save them as a collection so you can reselect and focus that cluster later.",
                })}
            `;
            const revealInlineButton = document.getElementById("action-reveal-hidden-inline");
            if (revealInlineButton) {
                revealInlineButton.onclick = () => {
                    void this.revealAllHiddenItems();
                };
            }
            this.bindCollectionInspectorActions();
            return;
        }

        if (this.boardData.selection.length > 1) {
            content.innerHTML = `
                <div class="inspector-summary">${this.boardData.selection.length} items selected</div>
                <div class="inspector-actions">
                    <button id="action-scatter-moodboard">Scatter as Moodboard</button>
                    <button id="action-story-strip">Arrange as Story Strip</button>
                    <button id="action-stack-selection">Stack as Pile</button>
                    <button id="action-renumber-frames">Renumber Frames</button>
                    <button id="action-straighten-selection">Straighten Selection</button>
                    <button id="action-frame-selection">Frame Selection</button>
                    <button id="action-focus-selection">Focus Selection</button>
                    <button id="action-align-left">Align Left</button>
                    <button id="action-align-right">Align Right</button>
                    <button id="action-align-top">Align Top</button>
                    <button id="action-align-bottom">Align Bottom</button>
                    <button id="action-distribute-h">Distribute H</button>
                    <button id="action-distribute-v">Distribute V</button>
                    <button id="action-hide-selected">Hide Selection</button>
                    <button id="action-lock-selected">Lock Selected</button>
                    <button id="action-unlock-selected">Unlock Selected</button>
                    <button id="action-duplicate-selected">Duplicate Selected</button>
                    <button id="action-delete-selected" class="danger">Delete Selected</button>
                </div>
                ${this.renderCollectionsSection({
                    allowCreateFromSelection: true,
                    title: "Saved Collections",
                    emptyMessage: "Save this selection as a collection to reuse it later.",
                })}
            `;

            const selectedItems = this.getSelectedItems();
            const editableSelectedItems = selectedItems.filter((item) => this.isItemEditable(item));
            const hasLockedSelection = selectedItems.some((item) => this.isItemLocked(item));
            const moodboardItems = editableSelectedItems.filter((item) => this.isMoodboardContentItem(item));
            const selectedFrames = editableSelectedItems.filter((item) => item.type === "frame");

            const scatterButton = document.getElementById("action-scatter-moodboard");
            if (scatterButton) {
                const canScatter = moodboardItems.length > 1;
                scatterButton.disabled = !canScatter;
                scatterButton.title = canScatter
                    ? "Create a looser moodboard composition from the unlocked items in this selection"
                    : "Need at least two unlocked non-frame items";
                scatterButton.onclick = () => {
                    if (!canScatter) return;
                    this.arrangeItemsAsMoodboard(moodboardItems);
                    this.renderBoard();
                    this.saveBoard();
                };
            }

            const storyStripButton = document.getElementById("action-story-strip");
            if (storyStripButton) {
                const canStoryStrip = moodboardItems.length > 1;
                storyStripButton.disabled = !canStoryStrip;
                storyStripButton.title = canStoryStrip
                    ? "Arrange the unlocked items in this selection into a clean storyboard strip"
                    : "Need at least two unlocked non-frame items";
                storyStripButton.onclick = () => {
                    if (!canStoryStrip) return;
                    this.arrangeItemsAsStoryStrip(moodboardItems);
                    this.renderBoard();
                    this.saveBoard();
                };
            }

            const stackSelectionButton = document.getElementById("action-stack-selection");
            if (stackSelectionButton) {
                const canStackSelection = moodboardItems.length > 1;
                stackSelectionButton.disabled = !canStackSelection;
                stackSelectionButton.title = canStackSelection
                    ? "Build an overlapping moodboard pile from the unlocked items in this selection"
                    : "Need at least two unlocked non-frame items";
                stackSelectionButton.onclick = () => {
                    if (!canStackSelection) return;
                    this.arrangeItemsAsStack(moodboardItems);
                    this.restackItems(moodboardItems, (a, b) => (b.w * b.h) - (a.w * a.h));
                    this.renderBoard();
                    this.saveBoard();
                };
            }

            const straightenSelectionButton = document.getElementById("action-straighten-selection");
            if (straightenSelectionButton) {
                const tiltableItems = moodboardItems.filter(item => this.isTiltableItem(item));
                const canStraighten = tiltableItems.some(item => this.getItemRotation(item) !== 0);
                straightenSelectionButton.disabled = !canStraighten;
                straightenSelectionButton.title = canStraighten
                    ? "Reset tilt on the unlocked items in this selection"
                    : "No unlocked selected items are tilted";
                straightenSelectionButton.onclick = () => {
                    if (!canStraighten) return;
                    this.straightenItems(tiltableItems);
                    this.renderBoard();
                    this.saveBoard();
                };
            }

            const renumberFramesButton = document.getElementById("action-renumber-frames");
            if (renumberFramesButton) {
                const canRenumberFrames = selectedFrames.length > 0;
                renumberFramesButton.disabled = !canRenumberFrames;
                renumberFramesButton.title = canRenumberFrames
                    ? "Assign scene numbers to the unlocked selected frames in reading order"
                    : "Select at least one unlocked frame";
                renumberFramesButton.onclick = () => {
                    if (!canRenumberFrames) return;
                    this.renumberFrames(selectedFrames);
                    this.renderBoard();
                    this.saveBoard();
                };
            }

            const frameSelectionButton = document.getElementById("action-frame-selection");
            if (frameSelectionButton) {
                const canFrameSelection = selectedItems.filter(item => this.isMoodboardContentItem(item)).length > 0;
                frameSelectionButton.disabled = !canFrameSelection;
                frameSelectionButton.title = canFrameSelection
                    ? "Create a frame around the visible moodboard items in this selection"
                    : "Select at least one non-frame item";
                frameSelectionButton.onclick = () => {
                    if (!canFrameSelection) return;
                    const frame = this.createFrameFromItems(selectedItems);
                    this.renderBoard();
                    this.saveBoard();
                    const frameEl = frame ? this.itemElements.get(frame.id) : null;
                    if (frameEl) this.updateFramePalette(frameEl, frame);
                };
            }

            const focusSelectionButton = document.getElementById("action-focus-selection");
            if (focusSelectionButton) {
                focusSelectionButton.disabled = selectedItems.length === 0;
                focusSelectionButton.title = selectedItems.length ? "Center and zoom the view to the current selection" : "Select at least one item";
                focusSelectionButton.onclick = () => {
                    if (!selectedItems.length) return;
                    this.focusViewOnItems(selectedItems);
                };
            }

            document.getElementById("action-align-left").onclick = () => {
                if (!editableSelectedItems.length) return;
                const minX = Math.min(...editableSelectedItems.map((item) => item.x));
                editableSelectedItems.forEach((item) => {
                    item.x = minX;
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-align-right").onclick = () => {
                if (!editableSelectedItems.length) return;
                const maxX = Math.max(...editableSelectedItems.map((item) => item.x + item.w));
                editableSelectedItems.forEach((item) => {
                    item.x = maxX - item.w;
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-align-top").onclick = () => {
                if (!editableSelectedItems.length) return;
                const minY = Math.min(...editableSelectedItems.map((item) => item.y));
                editableSelectedItems.forEach((item) => {
                    item.y = minY;
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-align-bottom").onclick = () => {
                if (!editableSelectedItems.length) return;
                const maxY = Math.max(...editableSelectedItems.map((item) => item.y + item.h));
                editableSelectedItems.forEach((item) => {
                    item.y = maxY - item.h;
                });
                this.renderBoard();
                this.saveBoard();
            };
            ["action-align-left", "action-align-right", "action-align-top", "action-align-bottom"].forEach((buttonId) => {
                const button = document.getElementById(buttonId);
                if (!button) return;
                button.disabled = editableSelectedItems.length === 0;
                button.title = editableSelectedItems.length
                    ? "Align the unlocked items in this selection"
                    : "No unlocked items available to align";
            });

            document.getElementById("action-distribute-h").onclick = () => {
                const orderedItems = [...editableSelectedItems].sort((a, b) => a.x - b.x);
                if (orderedItems.length < 3) return;
                const minX = orderedItems[0].x;
                const maxX = orderedItems[orderedItems.length - 1].x;
                const gap = (maxX - minX) / (orderedItems.length - 1);
                orderedItems.forEach((it, i) => {
                    it.x = minX + (i * gap);
                });
                this.renderBoard();
                this.saveBoard();
            };
            ["action-distribute-h", "action-distribute-v"].forEach((buttonId) => {
                const button = document.getElementById(buttonId);
                if (!button) return;
                button.disabled = editableSelectedItems.length < 3;
                button.title = editableSelectedItems.length >= 3
                    ? "Distribute the unlocked items in this selection evenly"
                    : "Need at least three unlocked items to distribute";
            });

            document.getElementById("action-distribute-v").onclick = () => {
                const orderedItems = [...editableSelectedItems].sort((a, b) => a.y - b.y);
                if (orderedItems.length < 3) return;
                const minY = orderedItems[0].y;
                const maxY = orderedItems[orderedItems.length - 1].y;
                const gap = (maxY - minY) / (orderedItems.length - 1);
                orderedItems.forEach((it, i) => {
                    it.y = minY + (i * gap);
                });
                this.renderBoard();
                this.saveBoard();
            };

            const hideSelectedButton = document.getElementById("action-hide-selected");
            if (hideSelectedButton) {
                const hideableItems = selectedItems.filter((item) => !this.isItemLocked(item));
                hideSelectedButton.disabled = hideableItems.length === 0;
                hideSelectedButton.title = hideableItems.length
                    ? "Hide the unlocked items in the current selection from the canvas and minimap"
                    : "Unlock an item before hiding it";
                hideSelectedButton.onclick = () => {
                    if (!hideableItems.length) return;
                    void this.setItemsHidden(hideableItems, true);
                };
            }

            const lockSelectedButton = document.getElementById("action-lock-selected");
            if (lockSelectedButton) {
                const lockableItems = selectedItems.filter((item) => !this.isItemLocked(item));
                lockSelectedButton.disabled = lockableItems.length === 0;
                lockSelectedButton.title = lockableItems.length
                    ? "Lock the current selection so it cannot be moved or edited"
                    : "All selected items are already locked";
                lockSelectedButton.onclick = () => {
                    if (!lockableItems.length) return;
                    void this.setItemsLocked(lockableItems, true);
                };
            }

            const unlockSelectedButton = document.getElementById("action-unlock-selected");
            if (unlockSelectedButton) {
                const unlockableItems = selectedItems.filter((item) => this.isItemLocked(item));
                unlockSelectedButton.disabled = unlockableItems.length === 0;
                unlockSelectedButton.title = unlockableItems.length
                    ? "Unlock the selected items so they can be moved and edited again"
                    : "No selected items are locked";
                unlockSelectedButton.onclick = () => {
                    if (!unlockableItems.length) return;
                    void this.setItemsLocked(unlockableItems, false);
                };
            }

            document.getElementById("action-delete-selected").onclick = () => {
                this.removeSelectedItems();
            };
            document.getElementById("action-duplicate-selected").onclick = () => {
                this.duplicateSelectedItems();
            };
            document.getElementById("action-duplicate-selected").disabled = hasLockedSelection;
            document.getElementById("action-duplicate-selected").title = hasLockedSelection
                ? "Unlock the selected items before duplicating them"
                : "Duplicate the current selection";
            document.getElementById("action-delete-selected").disabled = hasLockedSelection;
            document.getElementById("action-delete-selected").title = hasLockedSelection
                ? "Unlock the selected items before deleting them"
                : "Delete the current selection";
            this.bindCollectionInspectorActions();
            return;
        }

        const item = this.boardData.items.find(i => i.id === this.boardData.selection[0]);
        if (!item) return;

        let fields = `
            <div class="inspector-field">
                <label>ID</label>
                <input type="text" value="${item.id}" readonly style="opacity: 0.5">
            </div>
        `;

        const presets = [
            DEFAULT_FRAME_COLOR, "#2196F3", "#f44336", "#ffeb3b",
            "#9c27b0", "#ff9800", "#795548", "#607d8b"
        ];
        const fontOptions = this.fontOptions || this.getDefaultFontOptions();

        const createFontSelect = (currentValue) => {
            const normalizedCurrent = (currentValue || "").trim();
            let optionsHtml = "";
            let found = false;
            fontOptions.forEach(opt => {
                const selected = opt.value === normalizedCurrent;
                if (selected) found = true;
                optionsHtml += `<option value="${opt.value}" ${selected ? "selected" : ""}>${opt.label}</option>`;
            });
            if (normalizedCurrent && !found) {
                optionsHtml += `<option value="${normalizedCurrent}" selected>Custom (${normalizedCurrent})</option>`;
            }
            return `<select id="inspector-note-font-family">${optionsHtml}</select>`;
        };

        const createColorPicker = (currentColor) => {
            let html = `
                <div class="inspector-field">
                    <label>Color</label>
                    <input type="color" id="inspector-color" value="${currentColor}">
                    <div class="color-presets">
            `;
            presets.forEach(p => {
                const isActive = p.toLowerCase() === currentColor.toLowerCase();
                html += `<div class="color-dot ${isActive ? 'active' : ''}" style="background-color: ${p}" data-color="${p}"></div>`;
            });
            html += `
                    </div>
                </div>
            `;
            return html;
        };

        const createRotationField = (currentRotation) => {
            const rotation = this.normalizeRotation(currentRotation || 0);
            return `
                <div class="inspector-field">
                    <label>Tilt</label>
                    <input type="range" id="inspector-rotation" min="-25" max="25" step="1" value="${rotation}">
                    <div class="inspector-range-row">
                        <span id="inspector-rotation-value">${rotation}°</span>
                        <button id="action-straighten-item" type="button">Straighten</button>
                    </div>
                </div>
            `;
        };

        const createMediaPresentationField = (currentPresentation) => {
            const presentation = MEDIA_PRESENTATION_OPTIONS.some(option => option.value === currentPresentation)
                ? currentPresentation
                : "clean";
            const optionsHtml = MEDIA_PRESENTATION_OPTIONS.map(option => (
                `<option value="${option.value}" ${option.value === presentation ? "selected" : ""}>${option.label}</option>`
            )).join("");
            return `
                <div class="inspector-field">
                    <label>Presentation</label>
                    <select id="inspector-media-presentation">${optionsHtml}</select>
                </div>
            `;
        };

        const createFramePresentationField = (currentPresentation) => {
            const presentation = FRAME_PRESENTATION_OPTIONS.some(option => option.value === currentPresentation)
                ? currentPresentation
                : "outline";
            const optionsHtml = FRAME_PRESENTATION_OPTIONS.map(option => (
                `<option value="${option.value}" ${option.value === presentation ? "selected" : ""}>${option.label}</option>`
            )).join("");
            return `
                <div class="inspector-field">
                    <label>Frame Style</label>
                    <select id="inspector-frame-presentation">${optionsHtml}</select>
                </div>
            `;
        };

        const extensionDefinition = this.extensionRegistry.get(item.type);
        const itemLocked = this.isItemLocked(item);
        const frameItems = item.type === "frame" ? this.getItemsInFrame(item) : [];
        const hasLockedFrameItems = frameItems.some((frameItem) => this.isItemLocked(frameItem));
        const editableFrameItems = frameItems.filter((frameItem) => this.isItemEditable(frameItem));

        if (item.type === "image" || item.type === "video" || item.type === "slot" || item.type === "palette") {
            fields += `
                <div class="inspector-field">
                    <label>Label</label>
                    <input type="text" id="inspector-label" value="${item.label || ""}">
                </div>
                <div class="inspector-field">
                    <label>Tags (comma separated)</label>
                    <input type="text" id="inspector-tags" value="${(item.tags || []).join(", ")}">
                </div>
                ${item.type !== "palette" ? createRotationField(item.rotation || 0) : ""}
                ${(item.type === "image" || item.type === "video") ? createMediaPresentationField(item.media_presentation) : ""}
            `;
            if (item.type === "image") {
                const imagePaletteColors = item.palette_colors || 8;
                const imagePalettePosition = item.palette_position || "left";
                fields += `
                    <div class="inspector-field">
                        <label>Image Palette Colors</label>
                        <select id="inspector-image-palette-colors">
                            <option value="4" ${imagePaletteColors === 4 ? "selected" : ""}>4</option>
                            <option value="8" ${imagePaletteColors === 8 ? "selected" : ""}>8</option>
                            <option value="12" ${imagePaletteColors === 12 ? "selected" : ""}>12</option>
                            <option value="16" ${imagePaletteColors === 16 ? "selected" : ""}>16</option>
                        </select>
                    </div>
                    <div class="inspector-field">
                        <label>Image Palette Position</label>
                        <select id="inspector-image-palette-position">
                            <option value="left" ${imagePalettePosition === "left" ? "selected" : ""}>Left Center</option>
                            <option value="bottom" ${imagePalettePosition === "bottom" ? "selected" : ""}>Bottom Center</option>
                        </select>
                    </div>
                `;
            }
        } else if (item.type === "frame") {
            const framePaletteColors = item.palette_colors || 8;
            const framePalettePosition = item.palette_position || "bottom";
            fields += `
                <div class="inspector-field">
                    <label>Label</label>
                    <input type="text" id="inspector-label" value="${item.label || ""}">
                </div>
                <div class="inspector-field">
                    <label>Scene Code</label>
                    <input type="text" id="inspector-frame-scene-code" value="${item.scene_code || ""}" placeholder="01">
                </div>
                <div class="inspector-field">
                    <label>Subtitle</label>
                    <input type="text" id="inspector-frame-subtitle" value="${item.scene_subtitle || ""}" placeholder="Wide establishing shot">
                </div>
                ${createFramePresentationField(item.frame_presentation)}
                <div class="inspector-field">
                    <label>Frame Palette Colors</label>
                    <select id="inspector-frame-palette-colors">
                        <option value="4" ${framePaletteColors === 4 ? "selected" : ""}>4</option>
                        <option value="8" ${framePaletteColors === 8 ? "selected" : ""}>8</option>
                        <option value="12" ${framePaletteColors === 12 ? "selected" : ""}>12</option>
                        <option value="16" ${framePaletteColors === 16 ? "selected" : ""}>16</option>
                    </select>
                </div>
                <div class="inspector-field">
                    <label>Frame Palette Position</label>
                    <select id="inspector-frame-palette-position">
                        <option value="bottom" ${framePalettePosition === "bottom" ? "selected" : ""}>Bottom Center</option>
                        <option value="left" ${framePalettePosition === "left" ? "selected" : ""}>Left Center</option>
                    </select>
                </div>
                ${createColorPicker(item.color || DEFAULT_FRAME_COLOR)}
            `;
        } else if (item.type === "note") {
            const noteStyle = item.note_style || {};
            fields += `
                <div class="inspector-field">
                    <label>Label</label>
                    <input type="text" id="inspector-label" value="${item.label || ""}">
                </div>
                <div class="inspector-field">
                    <label>Tags (comma separated)</label>
                    <input type="text" id="inspector-tags" value="${(item.tags || []).join(", ")}">
                </div>
                <div class="inspector-field">
                    <label>Content</label>
                    <textarea id="inspector-content-text" rows="5">${item.content || ""}</textarea>
                </div>
                <div class="inspector-field">
                    <label>Font Family</label>
                    ${createFontSelect(noteStyle.font_family || "'Roboto', sans-serif")}
                </div>
                <div class="inspector-field">
                    <label>Font Size</label>
                    <input type="number" id="inspector-note-font-size" min="12" max="300" value="${noteStyle.font_size || ""}" placeholder="Auto">
                </div>
                <div class="inspector-field">
                    <label>Font Weight</label>
                    <select id="inspector-note-font-weight">
                        <option value="400" ${(noteStyle.font_weight || "700") === "400" ? "selected" : ""}>400</option>
                        <option value="500" ${(noteStyle.font_weight || "700") === "500" ? "selected" : ""}>500</option>
                        <option value="700" ${(noteStyle.font_weight || "700") === "700" ? "selected" : ""}>700</option>
                        <option value="900" ${(noteStyle.font_weight || "700") === "900" ? "selected" : ""}>900</option>
                    </select>
                </div>
                <div class="inspector-field">
                    <label>Text Align</label>
                    <select id="inspector-note-text-align">
                        <option value="left" ${(noteStyle.text_align || "center") === "left" ? "selected" : ""}>Left</option>
                        <option value="center" ${(noteStyle.text_align || "center") === "center" ? "selected" : ""}>Center</option>
                        <option value="right" ${(noteStyle.text_align || "center") === "right" ? "selected" : ""}>Right</option>
                    </select>
                </div>
                ${createRotationField(item.rotation || 0)}
                ${createColorPicker(item.color || "#ffeb3b")}
            `;
        } else if (typeof extensionDefinition?.renderInspectorFields === "function") {
            fields += extensionDefinition.renderInspectorFields({ workspace: this, item }) || "";
        } else {
            fields += `
                <div class="inspector-summary">Custom extension item</div>
                <div class="inspector-field">
                    <label>Type</label>
                    <input type="text" value="${item.type || ""}" readonly>
                </div>
            `;
        }

        content.innerHTML = fields + `
            <div class="inspector-actions">
                <button id="action-copy">Copy to Clipboard</button>
                <button id="action-front">Bring to Front</button>
                <button id="action-back">Send to Back</button>
                <button id="action-hide-item">Hide Item</button>
                <button id="action-lock-toggle">${itemLocked ? "Unlock Item" : "Lock Item"}</button>
                ${item.type === "frame" ? `<button id="action-toggle-palette">${item.palette_hidden ? "Show Palette" : "Hide Palette"}</button>` : ""}
                ${item.type === "image" ? `<button id="action-toggle-image-palette">${item.image_palette_visible ? "Hide Palette" : "Show Palette"}</button>` : ""}
                ${item.type === "frame" ? '<button id="action-auto-layout">Auto Arrange In Frame</button>' : ""}
                ${item.type === "frame" ? '<button id="action-moodboard-layout">Moodboard Layout In Frame</button>' : ""}
                ${item.type === "frame" ? '<button id="action-story-strip-layout">Story Strip In Frame</button>' : ""}
                ${item.type === "frame" ? '<button id="action-stack-layout">Stack Layout In Frame</button>' : ""}
                <button id="action-duplicate-item">Duplicate Item</button>
                <button id="action-delete" class="danger">Delete Item</button>
            </div>
            ${this.renderCollectionsSection({
                allowCreateFromSelection: true,
                title: "Saved Collections",
                emptyMessage: "Save this item as a collection when you want to recall it as part of a larger board structure.",
            })}
        `;

        if (itemLocked) {
            content.querySelectorAll(".inspector-field input:not([readonly]), .inspector-field textarea, .inspector-field select").forEach((field) => {
                field.disabled = true;
            });
            content.querySelectorAll(".color-dot").forEach((dot) => {
                dot.classList.add("is-disabled");
            });
        }

        document.getElementById("action-copy").onclick = async () => {
            if (item.type === "image") {
                const imgUrl = `/mkr/storyboard/asset/${this.boardId}/${item.image_ref}`;
                try {
                    const response = await fetch(imgUrl);
                    const blob = await response.blob();
                    const data = [new ClipboardItem({ [blob.type]: blob })];
                    await navigator.clipboard.write(data);
                    alert("Image copied to clipboard!");
                } catch (err) {
                    console.error("Failed to copy image: ", err);
                }
            } else if (item.type === "video") {
                try {
                    const videoUrl = `${window.location.origin}/mkr/storyboard/asset/${this.boardId}/${item.video_ref}`;
                    await navigator.clipboard.writeText(videoUrl);
                    alert("Video URL copied to clipboard!");
                } catch (err) {
                    console.error("Failed to copy video URL: ", err);
                }
            } else if (item.type === "note") {
                try {
                    await navigator.clipboard.writeText(item.content || "");
                    alert("Note content copied to clipboard!");
                } catch (err) {
                    console.error("Failed to copy text: ", err);
                }
            }
        };

        document.getElementById("action-front").onclick = () => {
            if (itemLocked) return;
            const index = this.boardData.items.indexOf(item);
            this.boardData.items.splice(index, 1);
            this.boardData.items.push(item);
            this.renderBoard();
            this.saveBoard();
        };

        document.getElementById("action-back").onclick = () => {
            if (itemLocked) return;
            const index = this.boardData.items.indexOf(item);
            this.boardData.items.splice(index, 1);
            this.boardData.items.unshift(item);
            this.renderBoard();
            this.saveBoard();
        };

        document.getElementById("action-delete").onclick = () => {
            if (itemLocked) return;
            this.boardData.items = this.boardData.items.filter(i => i.id !== item.id);
            this.boardData.selection = [];
            this.renderBoard();
            this.saveBoard();
        };

        document.getElementById("action-duplicate-item").onclick = () => {
            this.boardData.selection = [item.id];
            this.duplicateSelectedItems();
        };
        document.getElementById("action-front").disabled = itemLocked;
        document.getElementById("action-front").title = itemLocked ? "Unlock this item before reordering it" : "Bring this item to the front";
        document.getElementById("action-back").disabled = itemLocked;
        document.getElementById("action-back").title = itemLocked ? "Unlock this item before reordering it" : "Send this item behind the others";
        document.getElementById("action-duplicate-item").disabled = itemLocked;
        document.getElementById("action-duplicate-item").title = itemLocked ? "Unlock this item before duplicating it" : "Duplicate this item";
        document.getElementById("action-delete").disabled = itemLocked;
        document.getElementById("action-delete").title = itemLocked ? "Unlock this item before deleting it" : "Delete this item";

        const hideItemButton = document.getElementById("action-hide-item");
        if (hideItemButton) {
            hideItemButton.disabled = itemLocked;
            hideItemButton.title = itemLocked ? "Unlock this item before hiding it" : "Hide this item from the canvas and minimap";
            hideItemButton.onclick = () => {
                if (itemLocked) return;
                void this.setItemsHidden([item], true);
            };
        }

        const lockToggleButton = document.getElementById("action-lock-toggle");
        if (lockToggleButton) {
            lockToggleButton.onclick = () => {
                void this.setItemsLocked([item], !itemLocked);
            };
        }

        const togglePaletteButton = document.getElementById("action-toggle-palette");
        if (togglePaletteButton) {
            togglePaletteButton.disabled = itemLocked;
            togglePaletteButton.onclick = () => {
                if (itemLocked) return;
                item.palette_hidden = !item.palette_hidden;
                this.renderBoard();
                this.saveBoard();
            };
        }

        const toggleImagePaletteButton = document.getElementById("action-toggle-image-palette");
        if (toggleImagePaletteButton) {
            toggleImagePaletteButton.disabled = itemLocked;
            toggleImagePaletteButton.onclick = async () => {
                if (itemLocked) return;
                if (item.image_palette_visible) {
                    item.image_palette_visible = false;
                    this.renderBoard();
                    this.saveBoard();
                    return;
                }

                const paletteCount = item.palette_colors || 8;
                if (item.image_palette && item.image_palette.length && item.image_palette_count === paletteCount) {
                    item.image_palette_visible = true;
                    this.renderBoard();
                    this.saveBoard();
                    return;
                }

                try {
                    const ok = await this.loadImagePalette(item);
                    if (ok) {
                        item.image_palette_visible = true;
                        this.renderBoard();
                        this.saveBoard();
                    } else {
                        alert("No palette colors found for this image.");
                    }
                } catch (err) {
                    console.error("Show Palette failed:", err);
                    alert("Show Palette failed. Check server logs and retry.");
                }
            };
        }

        const autoLayoutButton = document.getElementById("action-auto-layout");
        if (autoLayoutButton) {
            autoLayoutButton.disabled = itemLocked || hasLockedFrameItems || editableFrameItems.length === 0;
            autoLayoutButton.title = itemLocked
                ? "Unlock this frame before auto-arranging it"
                : hasLockedFrameItems
                    ? "Unlock the visible locked items in this frame before auto-arranging"
                    : editableFrameItems.length
                        ? "Automatically arrange the visible unlocked items inside this frame"
                        : "No editable items inside this frame";
            autoLayoutButton.onclick = () => {
                if (autoLayoutButton.disabled) return;
                this.autoArrangeFrame(item);
                this.straightenItems(this.getItemsInFrame(item));
                this.renderBoard();
                this.saveBoard();
                const frameEl = this.itemElements.get(item.id);
                if (frameEl) this.updateFramePalette(frameEl, item);
            };
        }

        const moodboardLayoutButton = document.getElementById("action-moodboard-layout");
        if (moodboardLayoutButton) {
            const canScatterInFrame = !itemLocked && !hasLockedFrameItems && editableFrameItems.length > 1;
            moodboardLayoutButton.disabled = !canScatterInFrame;
            moodboardLayoutButton.title = canScatterInFrame
                ? "Arrange the unlocked items in this frame into a looser moodboard composition"
                : itemLocked
                    ? "Unlock this frame before rearranging it"
                    : hasLockedFrameItems
                        ? "Unlock the visible locked items in this frame before rearranging"
                        : "Need at least two unlocked items inside the frame";
            moodboardLayoutButton.onclick = () => {
                if (!canScatterInFrame) return;
                this.arrangeItemsAsMoodboard(editableFrameItems, {
                    bounds: { x: item.x, y: item.y, w: item.w, h: item.h },
                    padding: 28,
                    allowResize: true,
                });
                this.renderBoard();
                this.saveBoard();
                const frameEl = this.itemElements.get(item.id);
                if (frameEl) this.updateFramePalette(frameEl, item);
            };
        }

        const storyStripLayoutButton = document.getElementById("action-story-strip-layout");
        if (storyStripLayoutButton) {
            const canStripInFrame = !itemLocked && !hasLockedFrameItems && editableFrameItems.length > 1;
            storyStripLayoutButton.disabled = !canStripInFrame;
            storyStripLayoutButton.title = canStripInFrame
                ? "Arrange the unlocked items in this frame into a storyboard strip"
                : itemLocked
                    ? "Unlock this frame before rearranging it"
                    : hasLockedFrameItems
                        ? "Unlock the visible locked items in this frame before rearranging"
                        : "Need at least two unlocked items inside the frame";
            storyStripLayoutButton.onclick = () => {
                if (!canStripInFrame) return;
                this.arrangeItemsAsStoryStrip(editableFrameItems, {
                    bounds: { x: item.x, y: item.y, w: item.w, h: item.h },
                    padding: 28,
                    allowResize: true,
                });
                this.renderBoard();
                this.saveBoard();
                const frameEl = this.itemElements.get(item.id);
                if (frameEl) this.updateFramePalette(frameEl, item);
            };
        }

        const stackLayoutButton = document.getElementById("action-stack-layout");
        if (stackLayoutButton) {
            const canStackInFrame = !itemLocked && !hasLockedFrameItems && editableFrameItems.length > 1;
            stackLayoutButton.disabled = !canStackInFrame;
            stackLayoutButton.title = canStackInFrame
                ? "Build an overlapping moodboard pile from the unlocked items inside this frame"
                : itemLocked
                    ? "Unlock this frame before rearranging it"
                    : hasLockedFrameItems
                        ? "Unlock the visible locked items in this frame before rearranging"
                        : "Need at least two unlocked items inside the frame";
            stackLayoutButton.onclick = () => {
                if (!canStackInFrame) return;
                this.arrangeItemsAsStack(editableFrameItems, {
                    bounds: { x: item.x, y: item.y, w: item.w, h: item.h },
                    padding: 30,
                    allowResize: true,
                });
                this.restackItems(editableFrameItems, (a, b) => (b.w * b.h) - (a.w * a.h));
                this.renderBoard();
                this.saveBoard();
                const frameEl = this.itemElements.get(item.id);
                if (frameEl) this.updateFramePalette(frameEl, item);
            };
        }

        const rotationInput = document.getElementById("inspector-rotation");
        const rotationValue = document.getElementById("inspector-rotation-value");
        const straightenItemButton = document.getElementById("action-straighten-item");
        if (rotationInput && this.isTiltableItem(item)) {
            const updateRotationPreview = (value) => {
                this.setItemRotation(item, value);
                if (rotationValue) rotationValue.innerText = `${this.getItemRotation(item)}°`;
                const itemEl = this.itemElements.get(item.id);
                if (itemEl) {
                    const rotation = this.getItemRotation(item);
                    itemEl.style.transform = rotation ? `rotate(${rotation}deg)` : "";
                }
            };
            const applyRotation = (value) => {
                updateRotationPreview(value);
                this.saveBoard();
            };
            rotationInput.oninput = () => {
                updateRotationPreview(rotationInput.value);
            };
            rotationInput.onchange = () => applyRotation(rotationInput.value);
            if (straightenItemButton) {
                straightenItemButton.onclick = () => {
                    rotationInput.value = "0";
                    applyRotation(0);
                };
            }
        }

        if (item.type === "image" || item.type === "video" || item.type === "slot" || item.type === "palette") {
            document.getElementById("inspector-label").onchange = (e) => {
                item.label = e.target.value;
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("inspector-tags").onchange = (e) => {
                item.tags = e.target.value.split(",").map(s => s.trim()).filter(s => s);
                this.renderBoard();
                this.saveBoard();
            };

            const mediaPresentationSelect = document.getElementById("inspector-media-presentation");
            if (mediaPresentationSelect && isMediaPresentationItem(item)) {
                mediaPresentationSelect.onchange = () => {
                    this.setMediaPresentation(item, mediaPresentationSelect.value);
                    this.renderBoard();
                    this.saveBoard();
                };
            }

            if (item.type === "image") {
                const imagePaletteSelect = document.getElementById("inspector-image-palette-colors");
                if (imagePaletteSelect) {
                    imagePaletteSelect.onchange = async (e) => {
                        item.palette_colors = parseInt(e.target.value, 10) || 8;
                        if (item.image_palette_visible) {
                            try {
                                const ok = await this.loadImagePalette(item);
                                if (!ok) alert("No palette colors found for this image.");
                            } catch (err) {
                                console.error("Palette refresh failed:", err);
                                alert("Palette refresh failed. Check server logs and retry.");
                            }
                            this.renderBoard();
                        } else {
                            item.image_palette = null;
                            item.image_palette_count = null;
                        }
                        this.saveBoard();
                    };
                }
                const imagePalettePositionSelect = document.getElementById("inspector-image-palette-position");
                if (imagePalettePositionSelect) {
                    imagePalettePositionSelect.onchange = (e) => {
                        item.palette_position = e.target.value;
                        this.renderBoard();
                        this.saveBoard();
                    };
                }

            }
        } else if (item.type === "frame") {
            document.getElementById("inspector-label").onchange = (e) => {
                item.label = e.target.value;
                this.renderBoard();
                this.saveBoard();
            };
            const frameSceneCodeInput = document.getElementById("inspector-frame-scene-code");
            if (frameSceneCodeInput) {
                frameSceneCodeInput.onchange = () => {
                    const value = frameSceneCodeInput.value.trim();
                    if (value) item.scene_code = value;
                    else delete item.scene_code;
                    this.renderBoard();
                    this.saveBoard();
                };
            }
            const frameSubtitleInput = document.getElementById("inspector-frame-subtitle");
            if (frameSubtitleInput) {
                frameSubtitleInput.onchange = () => {
                    const value = frameSubtitleInput.value.trim();
                    if (value) item.scene_subtitle = value;
                    else delete item.scene_subtitle;
                    this.renderBoard();
                    this.saveBoard();
                };
            }
            const framePresentationSelect = document.getElementById("inspector-frame-presentation");
            if (framePresentationSelect) {
                framePresentationSelect.onchange = () => {
                    this.setFramePresentation(item, framePresentationSelect.value);
                    this.renderBoard();
                    this.saveBoard();
                };
            }
            const framePaletteSelect = document.getElementById("inspector-frame-palette-colors");
            if (framePaletteSelect) {
                framePaletteSelect.onchange = () => {
                    item.palette_colors = parseInt(framePaletteSelect.value, 10) || 8;
                    this.paletteCache.delete(item.id);
                    this.renderBoard();
                    this.saveBoard();
                };
            }
            const framePalettePositionSelect = document.getElementById("inspector-frame-palette-position");
            if (framePalettePositionSelect) {
                framePalettePositionSelect.onchange = () => {
                    item.palette_position = framePalettePositionSelect.value;
                    this.renderBoard();
                    this.saveBoard();
                };
            }
        } else if (item.type === "note") {
            document.getElementById("inspector-label").onchange = (e) => {
                item.label = e.target.value;
                this.saveBoard();
            };
            document.getElementById("inspector-tags").onchange = (e) => {
                item.tags = e.target.value.split(",").map(s => s.trim()).filter(s => s);
                this.saveBoard();
            };
            document.getElementById("inspector-content-text").onchange = (e) => {
                item.content = e.target.value;
                this.renderBoard();
                this.saveBoard();
            };
            item.note_style = item.note_style || {};
            const bindTypography = (id, key, castFn = (v) => v) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.onchange = () => {
                    const value = castFn(el.value);
                    if (value === "" || value === null || Number.isNaN(value)) {
                        delete item.note_style[key];
                    } else {
                        item.note_style[key] = value;
                    }
                    this.renderBoard();
                    this.saveBoard();
                };
            };
            bindTypography("inspector-note-font-family", "font_family");
            bindTypography("inspector-note-font-size", "font_size", (v) => v ? parseInt(v, 10) : "");
            bindTypography("inspector-note-font-weight", "font_weight");
            bindTypography("inspector-note-text-align", "text_align");
        } else if (typeof extensionDefinition?.bindInspector === "function" && !itemLocked) {
            extensionDefinition.bindInspector({ workspace: this, item });
        }

        // Color handling for both frame and note
        if ((item.type === "frame" || item.type === "note") && !itemLocked) {
            const colorInput = document.getElementById("inspector-color");
            const updateColor = (newColor) => {
                item.color = newColor;
                this.renderBoard();
                this.saveBoard();
                // Update dots active state
                document.querySelectorAll(".color-dot").forEach(dot => {
                    dot.classList.toggle("active", dot.dataset.color.toLowerCase() === newColor.toLowerCase());
                });
            };

            if (colorInput) {
                colorInput.onchange = (e) => updateColor(e.target.value);
            }

            document.querySelectorAll(".color-dot").forEach(dot => {
                dot.onclick = () => {
                    const newColor = dot.dataset.color;
                    if (colorInput) colorInput.value = newColor;
                    updateColor(newColor);
                };
            });
        }

        this.bindCollectionInspectorActions();
    }

    setupInteractions() {
        // Simple pan and zoom logic
        let isPanning = false;
        let isMinimapDragging = false;
        let selectionDragState = null;
        let startPos = { x: 0, y: 0 };
        const selectionListsEqual = (left, right) => (
            left.length === right.length &&
            left.every((itemId, index) => itemId === right[index])
        );

        // Global click listener to close context menu
        window.addEventListener("click", (e) => {
            if (this.contextMenu && !this.contextMenu.contains(e.target)) {
                this.contextMenu.style.display = "none";
            }
        });

        // Exit inline note editing when user clicks outside note text.
        window.addEventListener("mousedown", (e) => {
            const activeEl = document.activeElement;
            if (activeEl?.classList?.contains("note-content") && !activeEl.contains(e.target)) {
                activeEl.blur();
            }
        });

        this.canvasContainer.onmousedown = (e) => {
            const isBackground = this.isCanvasBackgroundTarget(e.target);

            if (isBackground && (e.button === 1 || (e.button === 0 && e.altKey))) {
                isPanning = true;
                this.isInteracting = true;
                startPos = { x: e.clientX - this.offset.x, y: e.clientY - this.offset.y };
                return;
            }

            if (!isBackground || e.button !== 0) {
                return;
            }

            selectionDragState = {
                startClientX: e.clientX,
                startClientY: e.clientY,
                startSelection: [...this.boardData.selection],
                lastSelection: [...this.boardData.selection],
                additive: Boolean(e.shiftKey || e.ctrlKey || e.metaKey),
                marqueeActive: false,
            };
        };

        this.canvasContainer.ondblclick = (e) => {
            if (e.button !== 0) return;
            if (!this.isCanvasBackgroundTarget(e.target)) return;
            e.preventDefault();
            this.openExtensionPicker({ clientX: e.clientX, clientY: e.clientY });
        };

        this.minimap.onmousedown = (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            isMinimapDragging = true;
            this.jumpToMinimap(e.clientX, e.clientY);
        };

        window.onmousemove = (e) => {
            if (isPanning) {
                this.offset.x = e.clientX - startPos.x;
                this.offset.y = e.clientY - startPos.y;
                this.updateTransform();
            } else if (isMinimapDragging) {
                this.jumpToMinimap(e.clientX, e.clientY);
            } else if (selectionDragState) {
                const pixelRect = normalizePixelRect(
                    selectionDragState.startClientX,
                    selectionDragState.startClientY,
                    e.clientX,
                    e.clientY,
                );
                if (!selectionDragState.marqueeActive && !pixelRectExceedsThreshold(pixelRect, 6)) {
                    return;
                }

                selectionDragState.marqueeActive = true;
                this.isInteracting = true;

                const startPoint = this.getCanvasContainerPoint(pixelRect.x, pixelRect.y);
                const endPoint = this.getCanvasContainerPoint(pixelRect.x + pixelRect.w, pixelRect.y + pixelRect.h);
                const localRect = normalizePixelRect(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
                this.showSelectionMarquee(localRect);

                const worldRect = pixelRectToWorldRect(localRect, this.offset, this.scale);
                const intersectingIds = getItemIdsIntersectingWorldRect(this.boardData.items, worldRect);
                const nextSelection = selectionDragState.additive
                    ? Array.from(new Set([...selectionDragState.startSelection, ...intersectingIds]))
                    : intersectingIds;
                selectionDragState.lastSelection = nextSelection;
                this.previewSelection(nextSelection);
            }
        };

        window.onmouseup = () => {
            if (selectionDragState) {
                const { additive, marqueeActive, startSelection, lastSelection } = selectionDragState;
                const nextSelection = marqueeActive ? lastSelection : (additive ? startSelection : []);
                const changed = !selectionListsEqual(this.boardData.selection, nextSelection);

                selectionDragState = null;
                this.isInteracting = false;
                this.hideSelectionMarquee();
                this.clearSelectionPreview();

                if (marqueeActive || changed) {
                    this.boardData.selection = nextSelection;
                    this.renderBoard();
                    if (changed) this.saveBoard();
                }
                return;
            }

            if (isPanning || isMinimapDragging) {
                this.scheduleViewportSave();
                this.deferMediaDeactivation();
            }
            isPanning = false;
            isMinimapDragging = false;
            this.isInteracting = false;
        };

        this.canvasContainer.onwheel = (e) => {
            e.preventDefault();
            const zoomSpeed = 0.001;
            const delta = -e.deltaY;
            const zoom = Math.exp(delta * zoomSpeed);
            
            // Zoom at cursor position
            const rect = this.canvasContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            this.zoomAtPoint(zoom, mouseX, mouseY);
            this.scheduleViewportSave();
            this.deferMediaDeactivation();
        };

        // Drag and drop support
        this.canvasContainer.ondragover = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        };
        
        window.onpaste = async (e) => {
            const items = e.clipboardData.items;
            const createdItems = [];
            for (const item of items) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    const nextItem = await this.createStoryboardItemFromDroppedFile(
                        file,
                        (-this.offset.x / this.scale) + 100 + (createdItems.length * 18),
                        (-this.offset.y / this.scale) + 100 + (createdItems.length * 18),
                        { label: "Pasted Image" },
                    );
                    if (nextItem) createdItems.push(nextItem);
                }
            }
            if (createdItems.length > 0) {
                this.boardData.items.push(...createdItems);
                this.renderBoard();
                await this.saveBoard();
            }
        };

        this.canvasContainer.ondrop = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = e.dataTransfer.files;
            const createdItems = [];
            
            // Calculate position in canvas space
            const rect = this.canvasContainer.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - this.offset.x) / this.scale;
            const mouseY = (e.clientY - rect.top - this.offset.y) / this.scale;

            for (const file of files) {
                const nextItem = await this.createStoryboardItemFromDroppedFile(
                    file,
                    mouseX + (createdItems.length * 24),
                    mouseY + (createdItems.length * 24),
                );
                if (nextItem) createdItems.push(nextItem);
            }

            if (createdItems.length > 0) {
                this.boardData.items.push(...createdItems);
                this.renderBoard();
                await this.saveBoard();
            }
        };

        this.canvasContainer.oncontextmenu = (e) => {
            e.preventDefault();
            this.closeExtensionPicker();
            this.showContextMenu(e.clientX, e.clientY);
        };

        window.addEventListener("mousedown", (e) => {
            if (this.extensionPickerOpen &&
                !this.extensionPicker?.contains(e.target) &&
                !this.openPickerButton?.contains(e.target)) {
                this.closeExtensionPicker();
            }
            if (!this.contextMenu.contains(e.target)) {
                this.contextMenu.style.display = "none";
            }
        });
    }

    showContextMenu(x, y) {
        this.contextMenu.style.display = "block";
        this.contextMenu.innerHTML = "";

        const createButton = (label, action, className = "") => {
            const btn = document.createElement("button");
            btn.innerText = label;
            if (className) btn.className = className;
            btn.onclick = () => {
                action();
                this.contextMenu.style.display = "none";
            };
            return btn;
        };

        const createSeparator = () => {
            const sep = document.createElement("div");
            sep.className = "menu-separator";
            return sep;
        };

        const createHeader = (text) => {
            const head = document.createElement("div");
            head.className = "menu-header";
            head.innerText = text;
            return head;
        };

        const appendBoardActions = () => {
            this.contextMenu.appendChild(createSeparator());
            this.contextMenu.appendChild(createHeader("Actions"));
            this.contextMenu.appendChild(createButton("Import Board Package", () => {
                this.openBoardImportPicker();
            }));
            this.contextMenu.appendChild(createButton("Export Board Package", () => {
                void this.exportCurrentBoardPackage();
            }));
            if (this.getHiddenBoardItems().length > 0) {
                this.contextMenu.appendChild(createButton("Reveal Hidden Items", () => {
                    void this.revealAllHiddenItems();
                }));
            }
        };

        if (this.boardData.selection.length > 0) {
            const selectedItems = this.getSelectedItems();
            const editableSelectedItems = selectedItems.filter((item) => this.isItemEditable(item));
            const moodboardItems = editableSelectedItems.filter(item => this.isMoodboardContentItem(item));
            this.contextMenu.appendChild(createButton("Bring to Front", () => document.getElementById("action-front")?.click()));
            this.contextMenu.appendChild(createButton("Send to Back", () => document.getElementById("action-back")?.click()));
            const anyLocked = selectedItems.some((item) => this.isItemLocked(item));
            this.contextMenu.appendChild(createButton(anyLocked ? "Unlock Selected" : "Lock Selected", () => {
                void this.setItemsLocked(selectedItems, !anyLocked);
            }));
            this.contextMenu.appendChild(createButton("Hide Selected", () => {
                void this.setItemsHidden(selectedItems, true);
            }));

            if (moodboardItems.length > 1) {
                this.contextMenu.appendChild(createButton("Scatter as Moodboard", () => {
                    this.arrangeItemsAsMoodboard(moodboardItems);
                    this.renderBoard();
                    this.saveBoard();
                }));

                this.contextMenu.appendChild(createButton("Arrange as Story Strip", () => {
                    this.arrangeItemsAsStoryStrip(moodboardItems);
                    this.renderBoard();
                    this.saveBoard();
                }));

                this.contextMenu.appendChild(createButton("Stack as Pile", () => {
                    this.arrangeItemsAsStack(moodboardItems);
                    this.restackItems(moodboardItems, (a, b) => (b.w * b.h) - (a.w * a.h));
                    this.renderBoard();
                    this.saveBoard();
                }));
            }

            const tiltedSelection = moodboardItems.filter(item => this.isTiltableItem(item) && this.getItemRotation(item) !== 0);
            if (tiltedSelection.length > 0) {
                this.contextMenu.appendChild(createButton("Straighten Selection", () => {
                    this.straightenItems(tiltedSelection);
                    this.renderBoard();
                    this.saveBoard();
                }));
            }

            if (moodboardItems.length > 0) {
                this.contextMenu.appendChild(createButton("Frame Selection", () => {
                    const frame = this.createFrameFromItems(moodboardItems);
                    this.renderBoard();
                    this.saveBoard();
                    const frameEl = frame ? this.itemElements.get(frame.id) : null;
                    if (frameEl) this.updateFramePalette(frameEl, frame);
                }));
            }

            this.contextMenu.appendChild(createButton("Save as Collection", () => {
                this.createCollectionFromSelection();
            }));

            this.contextMenu.appendChild(createButton("Focus Selection", () => {
                this.focusViewOnItems(selectedItems);
            }));

            this.contextMenu.appendChild(createButton("Duplicate Selection", () => {
                this.duplicateSelectedItems();
            }));

            const presentableItems = editableSelectedItems.filter(item => isMediaPresentationItem(item));
            if (presentableItems.length > 0) {
                this.contextMenu.appendChild(createSeparator());
                this.contextMenu.appendChild(createHeader("Presentation"));
                this.contextMenu.appendChild(createButton("Make Clean", () => {
                    this.applyMediaPresentation(presentableItems, "clean");
                    this.renderBoard();
                    this.saveBoard();
                }));
                this.contextMenu.appendChild(createButton("Make Story Panels", () => {
                    this.applyMediaPresentation(presentableItems, "panel");
                    this.renderBoard();
                    this.saveBoard();
                }));
                this.contextMenu.appendChild(createButton("Make Polaroids", () => {
                    this.applyMediaPresentation(presentableItems, "polaroid");
                    this.renderBoard();
                    this.saveBoard();
                }));
            }

            const presentableFrames = editableSelectedItems.filter(item => isFramePresentationItem(item));
            if (presentableFrames.length > 0) {
                this.contextMenu.appendChild(createSeparator());
                this.contextMenu.appendChild(createHeader("Frame Sequence"));
                this.contextMenu.appendChild(createButton("Renumber Frames", () => {
                    this.renumberFrames(presentableFrames);
                    this.renderBoard();
                    this.saveBoard();
                }));
                this.contextMenu.appendChild(createSeparator());
                this.contextMenu.appendChild(createHeader("Frame Style"));
                this.contextMenu.appendChild(createButton("Make Outline Frames", () => {
                    this.applyFramePresentation(presentableFrames, "outline");
                    this.renderBoard();
                    this.saveBoard();
                }));
                this.contextMenu.appendChild(createButton("Make Board Frames", () => {
                    this.applyFramePresentation(presentableFrames, "board");
                    this.renderBoard();
                    this.saveBoard();
                }));
                this.contextMenu.appendChild(createButton("Make Spotlight Frames", () => {
                    this.applyFramePresentation(presentableFrames, "spotlight");
                    this.renderBoard();
                    this.saveBoard();
                }));
            }
            
            if (this.boardData.selection.length === 1) {
                const item = this.boardData.items.find(i => i.id === this.boardData.selection[0]);
                if (item.type === "frame") {
                    const frameItems = this.getItemsInFrame(item);
                    if (frameItems.length > 1) {
                        this.contextMenu.appendChild(createSeparator());
                        this.contextMenu.appendChild(createHeader("Frame Layout"));
                        this.contextMenu.appendChild(createButton("Auto Arrange In Frame", () => document.getElementById("action-auto-layout")?.click()));
                        this.contextMenu.appendChild(createButton("Moodboard Layout In Frame", () => document.getElementById("action-moodboard-layout")?.click()));
                        this.contextMenu.appendChild(createButton("Story Strip In Frame", () => document.getElementById("action-story-strip-layout")?.click()));
                        this.contextMenu.appendChild(createButton("Stack Layout In Frame", () => document.getElementById("action-stack-layout")?.click()));
                    }
                }

                if ((item.type === "image" || item.type === "video" || item.type === "frame") && !this.isItemLocked(item)) {
                    this.contextMenu.appendChild(createSeparator());
                    this.contextMenu.appendChild(createHeader("Set as Reference"));
                    
                    const grid = document.createElement("div");
                    grid.className = "ref-grid";
                    for (let i = 1; i <= 8; i++) {
                        const dot = document.createElement("div");
                        dot.className = `ref-dot ${item.ref_id === i ? 'active' : ''}`;
                        dot.innerText = i;
                        dot.onclick = (e) => {
                            e.stopPropagation();
                            // Clear this ref from any other item first
                            this.boardData.items.forEach(it => {
                                if (it.ref_id === i) delete it.ref_id;
                            });
                            item.ref_id = i;
                            this.renderBoard();
                            this.saveBoard();
                            this.contextMenu.style.display = "none";
                        };
                        grid.appendChild(dot);
                    }
                    this.contextMenu.appendChild(grid);

                    if (item.ref_id) {
                        this.contextMenu.appendChild(createButton("Clear Reference", () => {
                            delete item.ref_id;
                            this.renderBoard();
                            this.saveBoard();
                        }));
                    }
                }
            }

            this.contextMenu.appendChild(createSeparator());
            this.contextMenu.appendChild(createButton("Delete", () => {
                if (this.boardData.selection.length === 1) document.getElementById("action-delete")?.click();
                else document.getElementById("action-delete-selected")?.click();
            }, "danger"));
            appendBoardActions();
        } else {
            this.contextMenu.appendChild(createButton("Open Node/Widget Picker", () => {
                this.openExtensionPicker({ clientX: x, clientY: y });
            }));
            appendBoardActions();
            const actionExtensions = this.extensionRegistry
                .listToolbarExtensions()
                .filter((extension) => typeof extension.onTrigger === "function");

            if (actionExtensions.length > 0) {
                this.contextMenu.appendChild(createSeparator());
                this.contextMenu.appendChild(createHeader("Board Tools"));
                actionExtensions.forEach((extension) => {
                    this.contextMenu.appendChild(createButton(extension.toolbar.label, () => {
                        void this.runToolbarExtension(extension.type);
                    }));
                });
            }
        }

        // Viewport constraint
        const rect = this.contextMenu.getBoundingClientRect();
        const margin = 12;
        let left = x;
        let top = y;

        if (left + rect.width > window.innerWidth - margin) {
            left = x - rect.width;
        }
        if (top + rect.height > window.innerHeight - margin) {
            top = y - rect.height;
        }

        left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));
        top = Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin));

        this.contextMenu.style.left = `${left}px`;
        this.contextMenu.style.top = `${top}px`;
    }

    updateTransform() {
        this.storeViewportState();
        this.canvas.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
        this.scheduleVisibleMediaActivation();
        this.updateGridOverlay();
        this.scheduleMinimapUpdate();
        this.updateMinimapControls();
    }
}

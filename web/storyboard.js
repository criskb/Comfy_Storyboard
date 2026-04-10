import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { createImageItem, createVideoItem } from "./storyboard_item_utils.js";
import { copyTextToClipboard } from "./storyboard_clipboard.js";
import { DEFAULT_FRAME_COLOR } from "./storyboard/design_system.js";
import {
    getGridOverlayStyles,
    snapPointToGrid,
    snapSizeToGrid,
} from "./storyboard/grid.js";
import { normalizeStoryboardSettings, snapValueToGrid } from "./storyboard/settings.js";
import {
    isStoryboardCoreExtension,
    loadStoryboardExtensionFavorites,
    matchesStoryboardExtensionQuery,
    saveStoryboardExtensionFavorites,
    STORYBOARD_MAX_PINNED_EXTENSIONS,
} from "./storyboard/extension_picker.js";
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
        this.isInteracting = false;
        this.paletteCache = new Map(); // frameId -> colors[]
        this.paletteLoading = new Set(); // frameIds currently fetching
        this.internalClipboard = [];
        this.needsReload = false;
        this.inspectorOpen = false;
        this.settingsOpen = false;
        this.extensionPickerOpen = false;
        this.extensionPickerStatus = "";
        this.createWindow();
        this.refreshFontOptions();

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
                } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
                    this.handleCopy();
                } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
                    this.handlePaste();
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
                <button id="storyboard-refresh-board" class="board-action-btn" title="Refresh Board">⟳ Refresh</button>
                <button id="storyboard-new-board" class="board-action-btn" title="New Board">＋ New</button>
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

        document.getElementById("storyboard-close").onclick = () => this.hide();
        this.coreToolbarRail = document.getElementById("storyboard-core-tools");
        this.favoriteToolbarRail = document.getElementById("storyboard-favorite-tools");
        this.openPickerButton = document.getElementById("storyboard-open-picker");
        this.themeToggleButton = document.getElementById("storyboard-theme-toggle");
        this.themeToggleGlyph = document.getElementById("storyboard-theme-toggle-glyph");
        this.themeToggleLabel = document.getElementById("storyboard-theme-toggle-label");
        this.extensionPickerSearchInput = document.getElementById("storyboard-picker-search");
        this.extensionPickerList = document.getElementById("storyboard-picker-list");
        this.extensionPickerMeta = document.getElementById("storyboard-picker-meta");
        this.extensionPickerStatusEl = document.getElementById("storyboard-picker-status");
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

        document.getElementById("storyboard-new-board").onclick = async () => {
            const name = prompt("Enter new storyboard name:");
            if (name) {
                this.show(name, this.node);
            }
        };

        document.getElementById("storyboard-rename-board").onclick = async () => {
            const newName = prompt("Enter new name for this storyboard:", this.boardId);
            if (newName && newName !== this.boardId) {
                const response = await fetch(`/mkr/storyboard/${this.boardId}/rename/${newName}`, { method: "POST" });
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
            const item = this.boardData.items.find(i => i.id === itemId);
            if (!item || item.type !== "slot" || item.pinned) return;
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

    ensureBoardSettings() {
        if (!this.boardData) {
            this.boardData = {
                board_id: this.boardId,
                items: [],
                selection: [],
                settings: normalizeStoryboardSettings(),
            };
        }
        this.boardData.settings = normalizeStoryboardSettings(this.boardData.settings);
        return this.boardData.settings;
    }

    getBoardSettings() {
        return this.ensureBoardSettings();
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
        if (this.minimap) this.minimap.style.display = settings.show_minimap ? "block" : "none";
        if (this.minimapControls) this.minimapControls.style.display = settings.show_minimap ? "grid" : "none";
        const prompt = this.canvasContainer.querySelector(".storyboard-floating-prompt");
        if (prompt) prompt.style.display = settings.show_prompt ? "flex" : "none";
        const canShowInspector = Boolean(settings.show_inspector);
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

    hide() {
        this.overlay.style.display = "none";
        this.closeExtensionPicker();
        if (this.contextMenu) this.contextMenu.style.display = "none";
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
        console.log("Storyboard loaded:", this.boardData);
        if (!this.boardData.selection) this.boardData.selection = [];
        this.renderBoard();
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
        const selectedSet = new Set(this.boardData.selection);
        const remaining = this.boardData.items.filter(i => !selectedSet.has(i.id) || i.pinned);
        this.boardData.items = remaining;
        this.boardData.selection = this.boardData.selection.filter(id => {
            const item = this.boardData.items.find(i => i.id === id);
            return !!item && item.pinned;
        });
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
        for (const item of this.boardData.items) {
            minX = Math.min(minX, item.x);
            minY = Math.min(minY, item.y);
            maxX = Math.max(maxX, item.x + item.w);
            maxY = Math.max(maxY, item.y + item.h);
        }
        return {
            viewportWorld,
            minX: minX - padding,
            minY: minY - padding,
            maxX: maxX + padding,
            maxY: maxY + padding
        };
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
    }

    centerOnContent() {
        if (!this.canvasContainer) return;
        const { minX, minY, maxX, maxY } = this.getWorldBounds(0);
        this.centerOnWorldPoint(minX + (maxX - minX) * 0.5, minY + (maxY - minY) * 0.5);
    }

    updateMinimapControls() {
        const label = document.getElementById("storyboard-minimap-zoom-label");
        if (label) label.textContent = `${Math.round(this.scale * 100)}%`;
    }

    renderBoard() {
        this.ensureBoardSettings();
        // Track which items are current to remove old ones later
        const currentItemIds = new Set(this.boardData.items.map(i => i.id));
        
        // Remove DOM elements for items that no longer exist
        for (const [id, el] of this.itemElements.entries()) {
            if (!currentItemIds.has(id)) {
                el.remove();
                this.itemElements.delete(id);
            }
        }

        this.boardData.items.forEach((item, index) => {
            let el = this.itemElements.get(item.id);
            let isNew = false;
            
            if (!el) {
                el = document.createElement("div");
                el._itemId = item.id;
                el.className = "storyboard-item";
                this.itemElements.set(item.id, el);
                this.canvas.appendChild(el);
                isNew = true;
                
                // Add interaction handlers once
                this.addItemInteractions(el, item);
            }

            // Update state
            el.classList.toggle("selected", this.boardData.selection.includes(item.id));
            
            // Set styles
            el.style.left = `${item.x}px`;
            el.style.top = `${item.y}px`;
            el.style.width = `${item.w}px`;
            el.style.height = `${item.h}px`;
            el.style.transformOrigin = "center center";
            const rotation = this.getItemRotation(item);
            el.style.transform = rotation ? `rotate(${rotation}deg)` : "";
            
            // Ensure frames are behind other items, but keep order within groups
            const baseZ = item.type === "frame" ? 100 : 1000;
            el.style.zIndex = (baseZ + index).toString();
            
            // Update item-type specific content
            this.updateItemContent(el, item, isNew);
        });

        this.renderInspector();
        this.updateMinimap();
        this.updateGridOverlay();
        this.updateChromeVisibility();
    }

    updateMinimap() {
        if (!this.canvasContainer || !this.minimapItems || !this.minimapViewport) return;

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

        this.minimapItems.innerHTML = "";
        for (const item of this.boardData.items) {
            const rect = document.createElement("div");
            rect.className = "storyboard-minimap-item";
            const colors = this.getMinimapItemColors(item);
            rect.style.backgroundColor = colors.fill;
            rect.style.borderColor = colors.border;
            rect.style.left = `${offsetX + (item.x - minX) * mapScale}px`;
            rect.style.top = `${offsetY + (item.y - minY) * mapScale}px`;
            rect.style.width = `${Math.max(2, item.w * mapScale)}px`;
            rect.style.height = `${Math.max(2, item.h * mapScale)}px`;
            this.minimapItems.appendChild(rect);
        }

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
                const item = this.boardData.items.find(i => i.id === itemId);
                if (!item) return;
                
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
            const item = this.boardData.items.find(i => i.id === itemId);
            if (!item) return;
            if (item.pinned) return;
            
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
        
        el.onmousedown = (e) => {
            const item = this.boardData.items.find(i => i.id === itemId);
            if (!item) return;

            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            
            // Selection logic
            if (e.shiftKey) {
                if (this.boardData.selection.includes(itemId)) {
                    this.boardData.selection = this.boardData.selection.filter(id => id !== itemId);
                } else {
                    this.boardData.selection.push(itemId);
                }
            } else {
                // Single select
                this.boardData.selection = [itemId];
            }
            this.renderBoard();

            if (item.pinned) {
                this.saveBoard();
                return;
            }

            this.isInteracting = true;

            const startX = e.clientX;
            const startY = e.clientY;
            
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
                const it = this.boardData.items.find(i => i.id === id);
                const domEl = this.itemElements.get(id);
                return { item: it, domEl, startX: it.x, startY: it.y };
            }).filter(entry => entry.domEl && entry.item);
            const anchorEntry = selectedElements.find(entry => entry.item.id === itemId) || selectedElements[0];

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
            this.internalClipboard = this.boardData.selection.map(id => {
                const item = this.boardData.items.find(i => i.id === id);
                return { ...item };
            }).filter(Boolean);
        }
    }

    handlePaste() {
        if (this.internalClipboard.length > 0) {
            const newSelection = [];
            this.internalClipboard.forEach(item => {
                const newItem = {
                    ...item,
                    id: this.generateUUID(),
                    x: item.x + 20,
                    y: item.y + 20
                };
                this.boardData.items.push(newItem);
                newSelection.push(newItem.id);
            });
            this.boardData.selection = newSelection;
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

    updateItemContent(el, item, isNew) {
        const extensionDefinition = this.extensionRegistry.get(item.type);
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

        let pinGlyph = el.querySelector(".storyboard-pin-glyph");
        if (item.pinned) {
            if (!pinGlyph) {
                pinGlyph = document.createElement("div");
                pinGlyph.className = "storyboard-pin-glyph";
                pinGlyph.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                        <path d="M15 3l6 6-2 2-2-2-3 3v4l-2 2v3h-2v-3l-2-2v-4L5 9 3 11 1 9l6-6 8 0z"></path>
                    </svg>
                `;
                pinGlyph.title = "Pinned";
                el.appendChild(pinGlyph);
            }
        } else if (pinGlyph) {
            pinGlyph.remove();
        }

        if (item.type === "image") {
            el.classList.add("image-item");
            const mediaPresentation = this.getMediaPresentation(item);
            el.dataset.mediaPresentation = mediaPresentation;
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
                wrapper.appendChild(img);
            }
            // Use item.image_ref directly as cache key, don't force-reload with timestamp every render
            const src = `/mkr/storyboard/asset/${this.boardId}/${item.image_ref}`;
            if (img.getAttribute("data-src") !== src) {
                img.src = src + `?t=${Date.now()}`;
                img.setAttribute("data-src", src);
            }

            // Apply crop to display
            if (item.crop) {
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
            } else {
                img.style.width = "100%";
                img.style.height = "100%";
                img.style.left = "0";
                img.style.top = "0";
                img.style.objectFit = "cover";
            }

            this.renderMediaMeta(el, item, "image-meta", mediaPresentation);
            this.updateImagePalette(el, item);
        } else if (item.type === "video") {
            el.classList.add("video-item");
            const mediaPresentation = this.getMediaPresentation(item);
            el.dataset.mediaPresentation = mediaPresentation;
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
            const src = `/mkr/storyboard/asset/${this.boardId}/${item.video_ref}`;
            if (video.getAttribute("data-src") !== src) {
                video.src = src + `?t=${Date.now()}`;
                video.setAttribute("data-src", src);
                video.pause();
            }

            this.renderMediaMeta(el, item, "video-meta", mediaPresentation);
            
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
            addGlyph.title = "Click to import image or video";
            addGlyph.setAttribute("aria-label", `Add media to ${item.label || "empty slot"}`);
            addGlyph.onmousedown = (e) => e.stopPropagation();
            addGlyph.onclick = (e) => {
                e.stopPropagation();
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

            container.innerHTML = "";
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
                container.appendChild(pill);
            });
            
        } else if (item.type === "note") {
            el.classList.add("note-item");
            const bgColor = item.color || "#ffeb3b";
            el.style.backgroundColor = bgColor;
            el.style.color = this.getContrastColor(bgColor);

            let meta = el.querySelector(".note-meta");
            if (!meta) {
                meta = document.createElement("div");
                meta.className = "note-meta";
                el.appendChild(meta);
            }
            meta.innerHTML = "";
            if (item.label) {
                const labelChip = document.createElement("div");
                labelChip.className = "note-chip note-chip-label";
                labelChip.innerText = item.label;
                meta.appendChild(labelChip);
            }
            (item.tags || []).forEach(tag => {
                const tagChip = document.createElement("div");
                tagChip.className = "note-chip note-chip-tag";
                tagChip.innerText = `#${tag}`;
                meta.appendChild(tagChip);
            });
            meta.style.display = meta.children.length > 0 ? "flex" : "none";
            
            let content = el.querySelector(".note-content");
            if (!content) {
                content = document.createElement("div");
                content.className = "note-content";
                el.appendChild(content);
            }
            content.contentEditable = !item.pinned;
            content.spellcheck = false;
            if (content.innerText !== (item.content || "")) {
                content.innerText = item.content || "";
            }
            content.onmousedown = (e) => e.stopPropagation();
            content.oninput = () => {
                item.content = content.innerText;
            };
            content.onpaste = (e) => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData("text/plain");
                document.execCommand("insertText", false, text);
            };
            content.onblur = () => {
                item.content = content.innerText;
                this.saveBoard();
            };
            
            const style = item.note_style || {};
            const textLength = (item.content || "").length;
            const area = item.w * item.h;
            let fontSize = style.font_size || (Math.sqrt(area / (textLength || 1)) * 0.8);
            fontSize = Math.max(12, Math.min(fontSize, item.h * 0.5));
            content.style.fontSize = `${fontSize}px`;
            content.style.fontFamily = style.font_family || "'Roboto', sans-serif";
            content.style.fontWeight = style.font_weight || "700";
            content.style.textAlign = style.text_align || "center";
            
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
        bar.innerHTML = "";
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
            bar.appendChild(dot);
        });
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
        return this.boardData.items.filter(item => {
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

        meta.dataset.presentation = presentation;
        meta.innerHTML = "";

        const label = (item.label || "").trim();
        const tags = (item.tags || []).filter(Boolean);
        const showTags = presentation !== "polaroid";
        const captionText = getMediaCaptionText(item, presentation);

        if (captionText) {
            const labelChip = document.createElement("div");
            labelChip.className = "image-chip image-chip-label";
            labelChip.innerText = captionText;
            meta.appendChild(labelChip);
        }

        if (showTags) {
            tags.forEach(tag => {
                const tagChip = document.createElement("div");
                tagChip.className = "image-chip image-chip-tag";
                tagChip.innerText = `#${tag}`;
                meta.appendChild(tagChip);
            });
        } else if (!label && tags.length > 1) {
            const extraTagText = document.createElement("div");
            extraTagText.className = "image-chip image-chip-tag";
            extraTagText.innerText = `+${tags.length - 1} tags`;
            meta.appendChild(extraTagText);
        }

        meta.style.display = meta.children.length > 0 ? "flex" : "none";
        return meta;
    }

    autoArrangeFrame(frame) {
        if (!frame || frame.type !== "frame") return;

        const margin = 24;
        const gap = 20;
        const itemsInFrame = this.boardData.items.filter(it => {
            if (it.id === frame.id || it.type === "frame") return false;
            const cx = it.x + it.w / 2;
            const cy = it.y + it.h / 2;
            return (
                cx >= frame.x &&
                cy >= frame.y &&
                cx <= (frame.x + frame.w) &&
                cy <= (frame.y + frame.h)
            );
        }).sort((a, b) => {
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

    renderInspector() {
        const content = document.getElementById("inspector-content");
        if (this.boardData.selection.length === 0) {
            content.innerHTML = "Select an item to see details";
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
                    <button id="action-align-left">Align Left</button>
                    <button id="action-align-right">Align Right</button>
                    <button id="action-align-top">Align Top</button>
                    <button id="action-align-bottom">Align Bottom</button>
                    <button id="action-distribute-h">Distribute H</button>
                    <button id="action-distribute-v">Distribute V</button>
                    <button id="action-delete-selected" class="danger">Delete Selected</button>
                </div>
            `;

            const selectedItems = this.boardData.selection
                .map(id => this.boardData.items.find(i => i.id === id))
                .filter(Boolean);
            const moodboardItems = selectedItems.filter(item => this.isMoodboardContentItem(item));
            const selectedFrames = selectedItems.filter(item => item.type === "frame");

            const scatterButton = document.getElementById("action-scatter-moodboard");
            if (scatterButton) {
                const canScatter = moodboardItems.length > 1;
                scatterButton.disabled = !canScatter;
                scatterButton.title = canScatter ? "Create a looser moodboard composition from the selected items" : "Select at least two non-frame items";
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
                storyStripButton.title = canStoryStrip ? "Arrange the selected items into a clean storyboard strip" : "Select at least two non-frame items";
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
                stackSelectionButton.title = canStackSelection ? "Build an overlapping moodboard pile from the selected items" : "Select at least two non-frame items";
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
                straightenSelectionButton.title = canStraighten ? "Reset tilt on the selected items" : "No selected items are tilted";
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
                renumberFramesButton.title = canRenumberFrames ? "Assign scene numbers to selected frames in reading order" : "Select at least one frame";
                renumberFramesButton.onclick = () => {
                    if (!canRenumberFrames) return;
                    this.renumberFrames(selectedFrames);
                    this.renderBoard();
                    this.saveBoard();
                };
            }

            const frameSelectionButton = document.getElementById("action-frame-selection");
            if (frameSelectionButton) {
                const canFrameSelection = moodboardItems.length > 0;
                frameSelectionButton.disabled = !canFrameSelection;
                frameSelectionButton.title = canFrameSelection ? "Create a frame around the selected moodboard items" : "Select at least one non-frame item";
                frameSelectionButton.onclick = () => {
                    if (!canFrameSelection) return;
                    const frame = this.createFrameFromItems(moodboardItems);
                    this.renderBoard();
                    this.saveBoard();
                    const frameEl = frame ? this.itemElements.get(frame.id) : null;
                    if (frameEl) this.updateFramePalette(frameEl, frame);
                };
            }

            document.getElementById("action-align-left").onclick = () => {
                const minX = Math.min(...this.boardData.selection.map(id => this.boardData.items.find(i => i.id === id).x));
                this.boardData.selection.forEach(id => {
                    this.boardData.items.find(i => i.id === id).x = minX;
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-align-right").onclick = () => {
                const maxX = Math.max(...this.boardData.selection.map(id => {
                    const i = this.boardData.items.find(it => it.id === id);
                    return i.x + i.w;
                }));
                this.boardData.selection.forEach(id => {
                    const it = this.boardData.items.find(i => i.id === id);
                    it.x = maxX - it.w;
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-align-top").onclick = () => {
                const minY = Math.min(...this.boardData.selection.map(id => this.boardData.items.find(i => i.id === id).y));
                this.boardData.selection.forEach(id => {
                    this.boardData.items.find(i => i.id === id).y = minY;
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-align-bottom").onclick = () => {
                const maxY = Math.max(...this.boardData.selection.map(id => {
                    const i = this.boardData.items.find(it => it.id === id);
                    return i.y + i.h;
                }));
                this.boardData.selection.forEach(id => {
                    const it = this.boardData.items.find(i => i.id === id);
                    it.y = maxY - it.h;
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-distribute-h").onclick = () => {
                const selectedItems = this.boardData.selection.map(id => this.boardData.items.find(i => i.id === id)).sort((a, b) => a.x - b.x);
                if (selectedItems.length < 3) return;
                const minX = selectedItems[0].x;
                const maxX = selectedItems[selectedItems.length - 1].x;
                const gap = (maxX - minX) / (selectedItems.length - 1);
                selectedItems.forEach((it, i) => {
                    it.x = minX + (i * gap);
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-distribute-v").onclick = () => {
                const selectedItems = this.boardData.selection.map(id => this.boardData.items.find(i => i.id === id)).sort((a, b) => a.y - b.y);
                if (selectedItems.length < 3) return;
                const minY = selectedItems[0].y;
                const maxY = selectedItems[selectedItems.length - 1].y;
                const gap = (maxY - minY) / (selectedItems.length - 1);
                selectedItems.forEach((it, i) => {
                    it.y = minY + (i * gap);
                });
                this.renderBoard();
                this.saveBoard();
            };

            document.getElementById("action-delete-selected").onclick = () => {
                this.removeSelectedItems();
            };
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
                <button id="action-pin-toggle">${item.pinned ? "Unpin Item" : "Pin Item"}</button>
                ${item.type === "frame" ? `<button id="action-toggle-palette">${item.palette_hidden ? "Show Palette" : "Hide Palette"}</button>` : ""}
                ${item.type === "image" ? `<button id="action-toggle-image-palette">${item.image_palette_visible ? "Hide Palette" : "Show Palette"}</button>` : ""}
                ${item.type === "frame" ? '<button id="action-auto-layout">Auto Arrange In Frame</button>' : ""}
                ${item.type === "frame" ? '<button id="action-moodboard-layout">Moodboard Layout In Frame</button>' : ""}
                ${item.type === "frame" ? '<button id="action-story-strip-layout">Story Strip In Frame</button>' : ""}
                ${item.type === "frame" ? '<button id="action-stack-layout">Stack Layout In Frame</button>' : ""}
                <button id="action-delete" class="danger">Delete Item</button>
            </div>
        `;

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
            const index = this.boardData.items.indexOf(item);
            this.boardData.items.splice(index, 1);
            this.boardData.items.push(item);
            this.renderBoard();
            this.saveBoard();
        };

        document.getElementById("action-back").onclick = () => {
            const index = this.boardData.items.indexOf(item);
            this.boardData.items.splice(index, 1);
            this.boardData.items.unshift(item);
            this.renderBoard();
            this.saveBoard();
        };

        document.getElementById("action-delete").onclick = () => {
            if (item.pinned) return;
            this.boardData.items = this.boardData.items.filter(i => i.id !== item.id);
            this.boardData.selection = [];
            this.renderBoard();
            this.saveBoard();
        };

        const pinToggleButton = document.getElementById("action-pin-toggle");
        if (pinToggleButton) {
            pinToggleButton.onclick = () => {
                item.pinned = !item.pinned;
                this.renderBoard();
                this.saveBoard();
            };
        }

        const togglePaletteButton = document.getElementById("action-toggle-palette");
        if (togglePaletteButton) {
            togglePaletteButton.onclick = () => {
                item.palette_hidden = !item.palette_hidden;
                this.renderBoard();
                this.saveBoard();
            };
        }

        const toggleImagePaletteButton = document.getElementById("action-toggle-image-palette");
        if (toggleImagePaletteButton) {
            toggleImagePaletteButton.onclick = async () => {
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
            autoLayoutButton.onclick = () => {
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
            const frameItems = this.getItemsInFrame(item);
            const canScatterInFrame = frameItems.length > 1;
            moodboardLayoutButton.disabled = !canScatterInFrame;
            moodboardLayoutButton.title = canScatterInFrame ? "Arrange the items in this frame into a looser moodboard composition" : "Need at least two items inside the frame";
            moodboardLayoutButton.onclick = () => {
                if (!canScatterInFrame) return;
                this.arrangeItemsAsMoodboard(frameItems, {
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
            const frameItems = this.getItemsInFrame(item);
            const canStripInFrame = frameItems.length > 1;
            storyStripLayoutButton.disabled = !canStripInFrame;
            storyStripLayoutButton.title = canStripInFrame ? "Arrange the items in this frame into a storyboard strip" : "Need at least two items inside the frame";
            storyStripLayoutButton.onclick = () => {
                if (!canStripInFrame) return;
                this.arrangeItemsAsStoryStrip(frameItems, {
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
            const frameItems = this.getItemsInFrame(item);
            const canStackInFrame = frameItems.length > 1;
            stackLayoutButton.disabled = !canStackInFrame;
            stackLayoutButton.title = canStackInFrame ? "Build an overlapping moodboard pile inside this frame" : "Need at least two items inside the frame";
            stackLayoutButton.onclick = () => {
                if (!canStackInFrame) return;
                this.arrangeItemsAsStack(frameItems, {
                    bounds: { x: item.x, y: item.y, w: item.w, h: item.h },
                    padding: 30,
                    allowResize: true,
                });
                this.restackItems(frameItems, (a, b) => (b.w * b.h) - (a.w * a.h));
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
        } else if (typeof extensionDefinition?.bindInspector === "function") {
            extensionDefinition.bindInspector({ workspace: this, item });
        }

        // Color handling for both frame and note
        if (item.type === "frame" || item.type === "note") {
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
    }

    setupInteractions() {
        // Simple pan and zoom logic
        let isPanning = false;
        let isMinimapDragging = false;
        let startPos = { x: 0, y: 0 };

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
            // Deselect if clicking the canvas directly
            if (this.isCanvasBackgroundTarget(e.target)) {
                this.boardData.selection = [];
                this.renderBoard();
                this.saveBoard();
            }

            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                isPanning = true;
                this.isInteracting = true;
                startPos = { x: e.clientX - this.offset.x, y: e.clientY - this.offset.y };
            }
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
            }
        };

        window.onmouseup = () => {
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
        };

        // Drag and drop support
        this.canvasContainer.ondragover = (e) => e.preventDefault();
        
        window.onpaste = async (e) => {
            const items = e.clipboardData.items;
            for (const item of items) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    const formData = new FormData();
                    formData.append("image", file);
                    
                    const response = await fetch(`/mkr/storyboard/${this.boardId}/upload`, {
                        method: "POST",
                        body: formData
                    });
                    
                    const result = await response.json();
                    if (result.filename) {
                        this.boardData.items.push(createImageItem({
                            x: -this.offset.x / this.scale + 100,
                            y: -this.offset.y / this.scale + 100,
                            imageRef: result.filename,
                            label: "Pasted Image",
                            imageWidth: result.width,
                            imageHeight: result.height,
                            generateId: () => this.generateUUID()
                        }));
                        this.renderBoard();
                        await this.saveBoard();
                    }
                }
            }
        };

        this.canvasContainer.ondrop = async (e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            
            // Calculate position in canvas space
            const rect = this.canvasContainer.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - this.offset.x) / this.scale;
            const mouseY = (e.clientY - rect.top - this.offset.y) / this.scale;

            for (const file of files) {
                if (file.type.startsWith("image/")) {
                    const formData = new FormData();
                    formData.append("image", file);
                    
                    const response = await fetch(`/mkr/storyboard/${this.boardId}/upload`, {
                        method: "POST",
                        body: formData
                    });
                    
                    const result = await response.json();
                    if (result.filename) {
                        this.boardData.items.push(createImageItem({
                            x: mouseX,
                            y: mouseY,
                            imageRef: result.filename,
                            label: file.name || "Dropped Image",
                            imageWidth: result.width,
                            imageHeight: result.height,
                            generateId: () => this.generateUUID()
                        }));
                        this.renderBoard();
                        await this.saveBoard();
                    }
                } else if (file.type.startsWith("video/")) {
                    const formData = new FormData();
                    formData.append("asset", file);

                    const response = await fetch(`/mkr/storyboard/${this.boardId}/upload`, {
                        method: "POST",
                        body: formData
                    });
                    const result = await response.json();
                    if (result.filename) {
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

                        this.boardData.items.push(createVideoItem({
                            x: mouseX,
                            y: mouseY,
                            videoRef: result.filename,
                            label: file.name || "Dropped Video",
                            videoWidth: videoSize.w,
                            videoHeight: videoSize.h,
                            generateId: () => this.generateUUID()
                        }));
                        this.renderBoard();
                        await this.saveBoard();
                    }
                }
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

        if (this.boardData.selection.length > 0) {
            const selectedItems = this.boardData.selection
                .map(id => this.boardData.items.find(i => i.id === id))
                .filter(Boolean);
            const moodboardItems = selectedItems.filter(item => this.isMoodboardContentItem(item));
            this.contextMenu.appendChild(createButton("Bring to Front", () => document.getElementById("action-front")?.click()));
            this.contextMenu.appendChild(createButton("Send to Back", () => document.getElementById("action-back")?.click()));
            const anyPinned = selectedItems.some(i => i.pinned);
            const pinLabel = anyPinned ? "Unpin Selected" : "Pin Selected";
            this.contextMenu.appendChild(createButton(pinLabel, () => {
                selectedItems.forEach(i => i.pinned = !anyPinned);
                this.renderBoard();
                this.saveBoard();
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

            const presentableItems = selectedItems.filter(item => isMediaPresentationItem(item));
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

            const presentableFrames = selectedItems.filter(item => isFramePresentationItem(item));
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

                if (item.type === "image" || item.type === "video" || item.type === "frame") {
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
        } else {
            this.contextMenu.appendChild(createButton("Open Node/Widget Picker", () => {
                this.openExtensionPicker({ clientX: x, clientY: y });
            }));
            this.contextMenu.appendChild(createSeparator());

            const toolbarSections = [];
            const toolbarGroups = new Map();
            this.extensionRegistry.listToolbarExtensions().forEach((extension) => {
                const section = extension.toolbar?.section || "Insert";
                if (!toolbarGroups.has(section)) {
                    toolbarGroups.set(section, []);
                    toolbarSections.push(section);
                }
                toolbarGroups.get(section).push(extension);
            });

            toolbarSections.forEach((section, index) => {
                if (index > 0) this.contextMenu.appendChild(createSeparator());
                this.contextMenu.appendChild(createHeader(section));
                toolbarGroups.get(section).forEach((extension) => {
                    this.contextMenu.appendChild(createButton(extension.toolbar.label, () => {
                        void this.runToolbarExtension(extension.type);
                    }));
                });
            });
        }

        // Viewport constraint
        const rect = this.contextMenu.getBoundingClientRect();
        let left = x;
        let top = y;

        if (left + rect.width > window.innerWidth) {
            left = x - rect.width;
        }
        if (top + rect.height > window.innerHeight) {
            top = y - rect.height;
        }

        this.contextMenu.style.left = `${left}px`;
        this.contextMenu.style.top = `${top}px`;
    }

    updateTransform() {
        this.canvas.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
        this.updateGridOverlay();
        this.updateMinimap();
        this.updateMinimapControls();
    }
}

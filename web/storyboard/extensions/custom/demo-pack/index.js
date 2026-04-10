import { cameraMoveStoryboardExtension } from "../camera-move/index.js";
import { characterCardStoryboardExtension } from "../character-card/index.js";
import { DEFAULT_FRAME_COLOR } from "../../../design_system.js";
import { dialogueCardStoryboardExtension } from "../dialogue-card/index.js";
import { locationCardStoryboardExtension } from "../location-card/index.js";
import { moodTagStoryboardExtension } from "../mood-tag/index.js";
import { sceneDividerStoryboardExtension } from "../scene-divider/index.js";
import { shotCardStoryboardExtension } from "../shot-card/index.js";
import { storyBeatStoryboardExtension } from "../story-beat/index.js";
import { swatchStripStoryboardExtension } from "../swatch-strip/index.js";
import { getViewportPlacement } from "../utils.js";

function place(item, x, y, w = null, h = null) {
    item.x = x;
    item.y = y;
    if (Number.isFinite(w)) item.w = w;
    if (Number.isFinite(h)) item.h = h;
    return item;
}

export const demoPackStoryboardExtension = {
    id: "custom.demo-pack",
    type: "demo_pack",
    title: "Demo Set",
    toolbar: {
        buttonId: "storyboard-add-demo-pack",
        label: "Demo Set",
        title: "Insert a full dummy extension demo set",
        iconKey: "demoPack",
        section: "Sandbox Actions",
    },
    onTrigger(workspace) {
        const origin = getViewportPlacement(workspace, 120, 120);

        const frame = {
            id: `frame_${workspace.generateUUID()}`,
            type: "frame",
            x: origin.x,
            y: origin.y,
            w: 1180,
            h: 860,
            label: "Custom Extension Sandbox",
            scene_code: "DEMO",
            scene_subtitle: "Custom widget playground",
            color: DEFAULT_FRAME_COLOR,
            frame_presentation: "board",
        };

        const divider = place(
            sceneDividerStoryboardExtension.createItem(workspace),
            origin.x + 92,
            origin.y + 52,
            900,
            86,
        );
        divider.label = "Storyboard Sandbox";
        divider.content = "Custom extension widget cluster";

        const moodTag = place(
            moodTagStoryboardExtension.createItem(workspace),
            origin.x + 92,
            origin.y + 168,
            236,
            96,
        );

        const shotCard = place(
            shotCardStoryboardExtension.createItem(workspace),
            origin.x + 360,
            origin.y + 168,
            272,
            176,
        );

        const storyBeat = place(
            storyBeatStoryboardExtension.createItem(workspace),
            origin.x + 664,
            origin.y + 168,
            228,
            176,
        );

        const locationCard = place(
            locationCardStoryboardExtension.createItem(workspace),
            origin.x + 924,
            origin.y + 168,
            220,
            176,
        );

        const swatchStrip = place(
            swatchStripStoryboardExtension.createItem(workspace),
            origin.x + 92,
            origin.y + 388,
            328,
            142,
        );

        const characterCard = place(
            characterCardStoryboardExtension.createItem(workspace),
            origin.x + 452,
            origin.y + 388,
            276,
            196,
        );

        const dialogueCard = place(
            dialogueCardStoryboardExtension.createItem(workspace),
            origin.x + 760,
            origin.y + 388,
            384,
            154,
        );

        const cameraMove = place(
            cameraMoveStoryboardExtension.createItem(workspace),
            origin.x + 760,
            origin.y + 568,
            384,
            96,
        );

        const secondaryBeat = place(
            storyBeatStoryboardExtension.createItem(workspace),
            origin.x + 92,
            origin.y + 596,
            636,
            150,
        );
        secondaryBeat.label = "Reference turns into sequence";
        secondaryBeat.beat_stage = "Resolve";
        secondaryBeat.content = "Use this cluster to test selection, inspector editing, exports, and frame flattening.";

        const items = [
            frame,
            divider,
            moodTag,
            shotCard,
            storyBeat,
            locationCard,
            swatchStrip,
            characterCard,
            dialogueCard,
            cameraMove,
            secondaryBeat,
        ];
        items.forEach((item) => {
            item.sandbox_collection = "custom_demo";
        });
        return {
            items,
            selection: items.filter(item => item.type !== "frame").map(item => item.id),
        };
    },
};

import { blockingNoteStoryboardExtension } from "../blocking-note/index.js";
import { cameraMoveStoryboardExtension } from "../camera-move/index.js";
import { characterCardStoryboardExtension } from "../character-card/index.js";
import { checklistCardStoryboardExtension } from "../checklist-card/index.js";
import { continuityNoteStoryboardExtension } from "../continuity-note/index.js";
import { DEFAULT_FRAME_COLOR } from "../../../design_system.js";
import { dialogueCardStoryboardExtension } from "../dialogue-card/index.js";
import { editorialCardStoryboardExtension } from "../editorial-card/index.js";
import { gradeCardStoryboardExtension } from "../grade-card/index.js";
import { graphicsNoteStoryboardExtension } from "../graphics-note/index.js";
import { hairMakeupNoteStoryboardExtension } from "../hair-makeup-note/index.js";
import { lensCardStoryboardExtension } from "../lens-card/index.js";
import { lightingCueStoryboardExtension } from "../lighting-cue/index.js";
import { locationCardStoryboardExtension } from "../location-card/index.js";
import { moodTagStoryboardExtension } from "../mood-tag/index.js";
import { propCardStoryboardExtension } from "../prop-card/index.js";
import { productionNoteStoryboardExtension } from "../production-note/index.js";
import { promptCardStoryboardExtension } from "../prompt-card/index.js";
import { referenceBasketStoryboardExtension } from "../reference-basket/index.js";
import { sceneDividerStoryboardExtension } from "../scene-divider/index.js";
import { setDressingCardStoryboardExtension } from "../set-dressing-card/index.js";
import { shotCardStoryboardExtension } from "../shot-card/index.js";
import { soundCueStoryboardExtension } from "../sound-cue/index.js";
import { storyBeatStoryboardExtension } from "../story-beat/index.js";
import { stuntNoteStoryboardExtension } from "../stunt-note/index.js";
import { swatchStripStoryboardExtension } from "../swatch-strip/index.js";
import { transitionCardStoryboardExtension } from "../transition-card/index.js";
import { getViewportPlacement } from "../utils.js";
import { vfxNoteStoryboardExtension } from "../vfx-note/index.js";
import { wardrobeCardStoryboardExtension } from "../wardrobe-card/index.js";

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
            w: 1520,
            h: 2220,
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

        const promptCard = place(
            promptCardStoryboardExtension.createItem(workspace),
            origin.x + 92,
            origin.y + 298,
            328,
            196,
        );

        const shotCard = place(
            shotCardStoryboardExtension.createItem(workspace),
            origin.x + 360,
            origin.y + 168,
            272,
            176,
        );

        const checklistCard = place(
            checklistCardStoryboardExtension.createItem(workspace),
            origin.x + 452,
            origin.y + 846,
            276,
            220,
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

        const referenceBasket = place(
            referenceBasketStoryboardExtension.createItem(workspace),
            origin.x + 452,
            origin.y + 1438,
            276,
            190,
        );

        const lensCard = place(
            lensCardStoryboardExtension.createItem(workspace),
            origin.x + 1182,
            origin.y + 168,
            246,
            182,
        );

        const swatchStrip = place(
            swatchStripStoryboardExtension.createItem(workspace),
            origin.x + 92,
            origin.y + 388,
            328,
            142,
        );

        const setDressingCard = place(
            setDressingCardStoryboardExtension.createItem(workspace),
            origin.x + 92,
            origin.y + 560,
            328,
            186,
        );

        const characterCard = place(
            characterCardStoryboardExtension.createItem(workspace),
            origin.x + 452,
            origin.y + 388,
            276,
            196,
        );

        const wardrobeCard = place(
            wardrobeCardStoryboardExtension.createItem(workspace),
            origin.x + 452,
            origin.y + 618,
            276,
            188,
        );

        const dialogueCard = place(
            dialogueCardStoryboardExtension.createItem(workspace),
            origin.x + 760,
            origin.y + 388,
            384,
            154,
        );

        const hairMakeupNote = place(
            hairMakeupNoteStoryboardExtension.createItem(workspace),
            origin.x + 760,
            origin.y + 570,
            384,
            176,
        );

        const cameraMove = place(
            cameraMoveStoryboardExtension.createItem(workspace),
            origin.x + 760,
            origin.y + 780,
            384,
            96,
        );

        const lightingCue = place(
            lightingCueStoryboardExtension.createItem(workspace),
            origin.x + 1182,
            origin.y + 388,
            246,
            170,
        );

        const continuityNote = place(
            continuityNoteStoryboardExtension.createItem(workspace),
            origin.x + 1182,
            origin.y + 384,
            246,
            166,
        );

        const stuntNote = place(
            stuntNoteStoryboardExtension.createItem(workspace),
            origin.x + 92,
            origin.y + 1162,
            328,
            176,
        );

        const propCard = place(
            propCardStoryboardExtension.createItem(workspace),
            origin.x + 1182,
            origin.y + 584,
            246,
            162,
        );

        const soundCue = place(
            soundCueStoryboardExtension.createItem(workspace),
            origin.x + 760,
            origin.y + 696,
            384,
            132,
        );

        const transitionCard = place(
            transitionCardStoryboardExtension.createItem(workspace),
            origin.x + 1182,
            origin.y + 782,
            246,
            122,
        );

        const editorialCard = place(
            editorialCardStoryboardExtension.createItem(workspace),
            origin.x + 1182,
            origin.y + 938,
            246,
            152,
        );

        const productionNote = place(
            productionNoteStoryboardExtension.createItem(workspace),
            origin.x + 452,
            origin.y + 1234,
            276,
            170,
        );

        const vfxNote = place(
            vfxNoteStoryboardExtension.createItem(workspace),
            origin.x + 760,
            origin.y + 910,
            384,
            156,
        );

        const graphicsNote = place(
            graphicsNoteStoryboardExtension.createItem(workspace),
            origin.x + 760,
            origin.y + 1274,
            384,
            164,
        );

        const gradeCard = place(
            gradeCardStoryboardExtension.createItem(workspace),
            origin.x + 1182,
            origin.y + 1124,
            246,
            180,
        );

        const blockingNote = place(
            blockingNoteStoryboardExtension.createItem(workspace),
            origin.x + 452,
            origin.y + 1030,
            692,
            168,
        );

        const secondaryBeat = place(
            storyBeatStoryboardExtension.createItem(workspace),
            origin.x + 92,
            origin.y + 792,
            328,
            150,
        );
        secondaryBeat.label = "Reference turns into sequence";
        secondaryBeat.beat_stage = "Resolve";
        secondaryBeat.content = "Use this cluster to test selection, inspector editing, exports, and frame flattening.";

        const tertiaryBeat = place(
            storyBeatStoryboardExtension.createItem(workspace),
            origin.x + 92,
            origin.y + 978,
            328,
            150,
        );
        tertiaryBeat.label = "Cut tension through design";
        tertiaryBeat.beat_stage = "Aftermath";
        tertiaryBeat.content = "Test how the board reads once notes from multiple departments stack together.";

        const items = [
            frame,
            divider,
            moodTag,
            promptCard,
            shotCard,
            storyBeat,
            locationCard,
            lensCard,
            swatchStrip,
            setDressingCard,
            characterCard,
            wardrobeCard,
            checklistCard,
            dialogueCard,
            hairMakeupNote,
            cameraMove,
            lightingCue,
            continuityNote,
            stuntNote,
            propCard,
            soundCue,
            transitionCard,
            editorialCard,
            productionNote,
            vfxNote,
            graphicsNote,
            gradeCard,
            referenceBasket,
            blockingNote,
            secondaryBeat,
            tertiaryBeat,
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

import { blockingNoteStoryboardExtension } from "./blocking-note/index.js";
import { cameraMoveStoryboardExtension } from "./camera-move/index.js";
import { characterCardStoryboardExtension } from "./character-card/index.js";
import { checklistCardStoryboardExtension } from "./checklist-card/index.js";
import { clearDemoStoryboardExtension } from "./clear-demo/index.js";
import { continuityNoteStoryboardExtension } from "./continuity-note/index.js";
import { demoPackStoryboardExtension } from "./demo-pack/index.js";
import { dialogueCardStoryboardExtension } from "./dialogue-card/index.js";
import { editorialCardStoryboardExtension } from "./editorial-card/index.js";
import { gradeCardStoryboardExtension } from "./grade-card/index.js";
import { graphicsNoteStoryboardExtension } from "./graphics-note/index.js";
import { hairMakeupNoteStoryboardExtension } from "./hair-makeup-note/index.js";
import { lensCardStoryboardExtension } from "./lens-card/index.js";
import { lightingCueStoryboardExtension } from "./lighting-cue/index.js";
import { locationCardStoryboardExtension } from "./location-card/index.js";
import { moodTagStoryboardExtension } from "./mood-tag/index.js";
import { propCardStoryboardExtension } from "./prop-card/index.js";
import { sceneDividerStoryboardExtension } from "./scene-divider/index.js";
import { setDressingCardStoryboardExtension } from "./set-dressing-card/index.js";
import { shotCardStoryboardExtension } from "./shot-card/index.js";
import { soundCueStoryboardExtension } from "./sound-cue/index.js";
import { storyBeatStoryboardExtension } from "./story-beat/index.js";
import { productionNoteStoryboardExtension } from "./production-note/index.js";
import { promptCardStoryboardExtension } from "./prompt-card/index.js";
import { referenceBasketStoryboardExtension } from "./reference-basket/index.js";
import { stuntNoteStoryboardExtension } from "./stunt-note/index.js";
import { swatchStripStoryboardExtension } from "./swatch-strip/index.js";
import { transitionCardStoryboardExtension } from "./transition-card/index.js";
import { vfxNoteStoryboardExtension } from "./vfx-note/index.js";
import { wardrobeCardStoryboardExtension } from "./wardrobe-card/index.js";

// Keep custom experiments isolated here so we can iterate on extension ideas
// without pushing the main storyboard shell back into one giant file.
export const customStoryboardExtensions = [
    demoPackStoryboardExtension,
    clearDemoStoryboardExtension,
    moodTagStoryboardExtension,
    promptCardStoryboardExtension,
    checklistCardStoryboardExtension,
    referenceBasketStoryboardExtension,
    shotCardStoryboardExtension,
    storyBeatStoryboardExtension,
    swatchStripStoryboardExtension,
    sceneDividerStoryboardExtension,
    lensCardStoryboardExtension,
    setDressingCardStoryboardExtension,
    wardrobeCardStoryboardExtension,
    characterCardStoryboardExtension,
    locationCardStoryboardExtension,
    dialogueCardStoryboardExtension,
    hairMakeupNoteStoryboardExtension,
    continuityNoteStoryboardExtension,
    stuntNoteStoryboardExtension,
    cameraMoveStoryboardExtension,
    lightingCueStoryboardExtension,
    propCardStoryboardExtension,
    soundCueStoryboardExtension,
    transitionCardStoryboardExtension,
    editorialCardStoryboardExtension,
    productionNoteStoryboardExtension,
    graphicsNoteStoryboardExtension,
    gradeCardStoryboardExtension,
    vfxNoteStoryboardExtension,
    blockingNoteStoryboardExtension,
];

import { cameraMoveStoryboardExtension } from "./camera-move/index.js";
import { characterCardStoryboardExtension } from "./character-card/index.js";
import { clearDemoStoryboardExtension } from "./clear-demo/index.js";
import { demoPackStoryboardExtension } from "./demo-pack/index.js";
import { dialogueCardStoryboardExtension } from "./dialogue-card/index.js";
import { locationCardStoryboardExtension } from "./location-card/index.js";
import { moodTagStoryboardExtension } from "./mood-tag/index.js";
import { sceneDividerStoryboardExtension } from "./scene-divider/index.js";
import { shotCardStoryboardExtension } from "./shot-card/index.js";
import { storyBeatStoryboardExtension } from "./story-beat/index.js";
import { swatchStripStoryboardExtension } from "./swatch-strip/index.js";

// Keep custom experiments isolated here so we can iterate on extension ideas
// without pushing the main storyboard shell back into one giant file.
export const customStoryboardExtensions = [
    demoPackStoryboardExtension,
    clearDemoStoryboardExtension,
    moodTagStoryboardExtension,
    shotCardStoryboardExtension,
    storyBeatStoryboardExtension,
    swatchStripStoryboardExtension,
    sceneDividerStoryboardExtension,
    characterCardStoryboardExtension,
    locationCardStoryboardExtension,
    dialogueCardStoryboardExtension,
    cameraMoveStoryboardExtension,
];

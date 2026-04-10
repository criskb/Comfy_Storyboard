import assert from "node:assert/strict";

import { coreStoryboardExtensions } from "../web/storyboard/extensions/core/index.js";
import { customStoryboardExtensions } from "../web/storyboard/extensions/custom/index.js";
import {
    isStoryboardCoreExtension,
    loadStoryboardExtensionFavorites,
    matchesStoryboardExtensionQuery,
    saveStoryboardExtensionFavorites,
    STORYBOARD_MAX_PINNED_EXTENSIONS,
} from "../web/storyboard/extension_picker.js";

const extensions = [...coreStoryboardExtensions, ...customStoryboardExtensions].filter((extension) => extension?.toolbar);

const fakeStorage = {
    value: JSON.stringify([
        "mood_tag",
        "demo_pack",
        "mood_tag",
        "missing_type",
        "story_beat",
        "shot_card",
        "swatch_strip",
        "scene_divider",
        "clear_demo_pack",
    ]),
    getItem() {
        return this.value;
    },
    setItem(_key, nextValue) {
        this.value = nextValue;
    },
};

const favorites = loadStoryboardExtensionFavorites(extensions, fakeStorage);
assert.deepEqual(favorites, [
    "mood_tag",
    "demo_pack",
    "story_beat",
    "shot_card",
    "swatch_strip",
    "scene_divider",
]);
assert.equal(favorites.length, STORYBOARD_MAX_PINNED_EXTENSIONS);
assert.equal(isStoryboardCoreExtension(coreStoryboardExtensions[0]), true);
assert.equal(isStoryboardCoreExtension(customStoryboardExtensions[0]), false);

const moodTag = extensions.find((extension) => extension.type === "mood_tag");
const clearDemo = extensions.find((extension) => extension.type === "clear_demo_pack");
const slot = extensions.find((extension) => extension.type === "slot");

assert.ok(matchesStoryboardExtensionQuery(moodTag, "mood tag"));
assert.ok(matchesStoryboardExtensionQuery(clearDemo, "clear demo"));
assert.equal(matchesStoryboardExtensionQuery(slot, "sandbox"), false);

const savedFavorites = saveStoryboardExtensionFavorites([
    "clear_demo_pack",
    "story_beat",
    "shot_card",
], extensions, fakeStorage);

assert.deepEqual(savedFavorites, ["clear_demo_pack", "story_beat", "shot_card"]);
assert.deepEqual(JSON.parse(fakeStorage.value), savedFavorites);

console.log(JSON.stringify({
    pinned: favorites.length,
    saved: savedFavorites.length,
}));

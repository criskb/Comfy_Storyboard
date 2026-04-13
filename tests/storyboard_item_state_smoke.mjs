import assert from "node:assert/strict";

import {
    filterStoryboardSelectionIds,
    getStoryboardHiddenItems,
    getStoryboardLockedItems,
    getStoryboardVisibleItems,
    isStoryboardItemEditable,
    isStoryboardItemLocked,
    normalizeStoryboardItems,
} from "../web/storyboard/item_state.js";

const items = [
    { id: "legacy_pin", pinned: true, x: 0, y: 0, w: 10, h: 10 },
    { id: "hidden_item", hidden: "true", x: 20, y: 0, w: 10, h: 10 },
    { id: "plain", x: 40, y: 0, w: 10, h: 10 },
];

normalizeStoryboardItems(items, { mirrorLegacyPinned: true });

assert.equal(isStoryboardItemLocked(items[0]), true);
assert.equal(items[0].locked, true);
assert.equal(items[0].pinned, true);
assert.equal(isStoryboardItemEditable(items[0]), false);

assert.deepEqual(getStoryboardVisibleItems(items).map((item) => item.id), ["legacy_pin", "plain"]);
assert.deepEqual(getStoryboardHiddenItems(items).map((item) => item.id), ["hidden_item"]);
assert.deepEqual(getStoryboardLockedItems(items).map((item) => item.id), ["legacy_pin"]);
assert.deepEqual(filterStoryboardSelectionIds(["legacy_pin", "hidden_item", "plain"], items), ["legacy_pin", "plain"]);

console.log(JSON.stringify({
    visible: getStoryboardVisibleItems(items).length,
    locked: getStoryboardLockedItems(items).length,
}));

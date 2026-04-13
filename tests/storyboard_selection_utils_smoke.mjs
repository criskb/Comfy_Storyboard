import assert from "node:assert/strict";

import {
    cloneStoryboardItemsForPaste,
    getItemIdsIntersectingWorldRect,
    itemIntersectsWorldRect,
    normalizePixelRect,
    pixelRectExceedsThreshold,
    pixelRectToWorldRect,
} from "../web/storyboard/selection_utils.js";

const pixelRect = normalizePixelRect(40, 80, 10, 20);
assert.deepEqual(pixelRect, { x: 10, y: 20, w: 30, h: 60 });
assert.equal(pixelRectExceedsThreshold(pixelRect, 5), true);
assert.equal(pixelRectExceedsThreshold({ x: 0, y: 0, w: 2, h: 2 }, 5), false);

const worldRect = pixelRectToWorldRect({ x: 20, y: 40, w: 100, h: 80 }, { x: -10, y: 20 }, 2);
assert.deepEqual(worldRect, { x: 15, y: 10, w: 50, h: 40 });

const items = [
    { id: "a", x: 0, y: 0, w: 30, h: 30 },
    { id: "b", x: 40, y: 10, w: 20, h: 20, hidden: true },
    { id: "c", x: 80, y: 80, w: 10, h: 10 },
];

assert.equal(itemIntersectsWorldRect(items[0], { x: 10, y: 10, w: 5, h: 5 }), true);
assert.equal(itemIntersectsWorldRect(items[2], { x: 0, y: 0, w: 50, h: 50 }), false);
assert.deepEqual(getItemIdsIntersectingWorldRect(items, { x: 5, y: 5, w: 60, h: 30 }), ["a"]);
assert.deepEqual(getItemIdsIntersectingWorldRect(items, { x: 5, y: 5, w: 60, h: 30 }, { includeHidden: true }), ["a", "b"]);

const pastedItems = cloneStoryboardItemsForPaste([
    { id: "note_1", x: 10, y: 20, linked_ids: ["note_2"], tags: ["hero"], checklist_items: [{ done: false, label: "A" }] },
    { id: "note_2", x: 50, y: 60, linked_ids: ["note_1"] },
], {
    generateId: ((counter = 0) => () => `copy_${++counter}`)(),
    offsetX: 30,
    offsetY: 40,
});

assert.deepEqual(pastedItems.map((item) => item.id), ["copy_1", "copy_2"]);
assert.deepEqual(pastedItems.map((item) => [item.x, item.y]), [[40, 60], [80, 100]]);
assert.deepEqual(pastedItems[0].linked_ids, ["copy_2"]);
assert.deepEqual(pastedItems[1].linked_ids, ["copy_1"]);

pastedItems[0].checklist_items[0].done = true;
assert.equal(pastedItems[0].checklist_items[0].done, true);

console.log(JSON.stringify({
    hitCount: getItemIdsIntersectingWorldRect(items, { x: 5, y: 5, w: 60, h: 30 }).length,
    pasted: pastedItems.length,
}));

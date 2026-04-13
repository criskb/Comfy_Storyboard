import assert from "node:assert/strict";

import {
    createStoryboardHistorySignature,
    createStoryboardHistorySnapshot,
    parseStoryboardHistorySnapshot,
    pushStoryboardHistoryEntry,
} from "../web/storyboard/history.js";

const baseBoard = {
    items: [{ id: "item_1", type: "note", x: 0, y: 0, w: 100, h: 60, content: "A" }],
    groups: [{ id: "group_1", name: "Hero", item_ids: ["item_1"] }],
    selection: ["item_1"],
    settings: { grid: false, snap: true },
    viewport: { x: 100, y: 200, zoom: 2 },
};

const snapshot = createStoryboardHistorySnapshot(baseBoard);
const parsed = parseStoryboardHistorySnapshot(snapshot);
assert.deepEqual(parsed.items, baseBoard.items);
assert.deepEqual(parsed.groups, baseBoard.groups);
assert.deepEqual(parsed.selection, baseBoard.selection);
assert.deepEqual(parsed.settings, baseBoard.settings);

const selectionChanged = {
    ...baseBoard,
    selection: [],
    viewport: { x: 999, y: 999, zoom: 0.25 },
};
assert.equal(
    createStoryboardHistorySignature(selectionChanged),
    createStoryboardHistorySignature(baseBoard),
);

const changedBoard = {
    ...baseBoard,
    items: [...baseBoard.items, { id: "item_2", type: "note", x: 10, y: 20, w: 100, h: 60, content: "B" }],
};
assert.notEqual(
    createStoryboardHistorySignature(changedBoard),
    createStoryboardHistorySignature(baseBoard),
);

const pushed = pushStoryboardHistoryEntry(["a", "b"], "c", 2);
assert.deepEqual(pushed, ["b", "c"]);

console.log(JSON.stringify({
    selectionIgnored: true,
    stackSize: pushed.length,
}));

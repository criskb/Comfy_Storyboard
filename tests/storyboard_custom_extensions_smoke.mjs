import assert from "node:assert/strict";

import { clearDemoStoryboardExtension } from "../web/storyboard/extensions/custom/clear-demo/index.js";
import { customStoryboardExtensions } from "../web/storyboard/extensions/custom/index.js";
import { demoPackStoryboardExtension } from "../web/storyboard/extensions/custom/demo-pack/index.js";

let idCounter = 0;
const workspace = {
    scale: 1,
    offset: { x: 0, y: 0 },
    boardData: {
        items: [],
        selection: [],
    },
    generateUUID() {
        idCounter += 1;
        return `test_${idCounter}`;
    },
};

const demoResult = demoPackStoryboardExtension.onTrigger(workspace);
assert.ok(demoResult);
assert.ok(Array.isArray(demoResult.items));
assert.ok(demoResult.items.length >= 10);
assert.ok(demoResult.items.every((item) => item.sandbox_collection === "custom_demo"));
assert.ok(demoResult.selection.length > 0);

const registeredTypes = new Set(customStoryboardExtensions.map((extension) => extension.type));
["character_card", "location_card", "dialogue_card", "camera_move"].forEach((type) => {
    assert.ok(registeredTypes.has(type));
    assert.ok(demoResult.items.some((item) => item.type === type));
});

workspace.boardData.items = [...demoResult.items, { id: "keep_me", type: "note", x: 0, y: 0, w: 120, h: 80 }];
workspace.boardData.selection = demoResult.selection.slice();

const clearResult = clearDemoStoryboardExtension.onTrigger(workspace);
assert.deepEqual(clearResult, { handled: true });
assert.equal(workspace.boardData.items.length, 1);
assert.equal(workspace.boardData.items[0].id, "keep_me");
assert.deepEqual(workspace.boardData.selection, []);

console.log(JSON.stringify({
    demo_items: demoResult.items.length,
    remaining_items: workspace.boardData.items.length,
}));

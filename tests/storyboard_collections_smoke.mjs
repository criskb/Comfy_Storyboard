import assert from "node:assert/strict";

import {
    createStoryboardCollection,
    getStoryboardCollectionItems,
    normalizeStoryboardCollections,
    normalizeStoryboardCollectionColor,
    storyboardCollectionMatchesSelection,
} from "../web/storyboard/collections.js";

const items = [
    { id: "item_a", label: "A" },
    { id: "item_b", label: "B" },
];

const normalized = normalizeStoryboardCollections([
    { id: "group_1", name: "  Hero  ", color: "#abc", item_ids: ["item_a", "missing", "item_a"] },
    { id: "group_1", name: "", color: "bad", item_ids: ["item_b"] },
], items, {
    generateId: () => "generated_group",
});

assert.equal(normalized.length, 2);
assert.equal(normalized[0].id, "group_1");
assert.equal(normalized[0].name, "Hero");
assert.equal(normalized[0].color, "#aabbcc");
assert.deepEqual(normalized[0].item_ids, ["item_a"]);
assert.equal(normalized[1].id, "generated_group");
assert.equal(normalized[1].name, "Collection 2");
assert.deepEqual(normalized[1].item_ids, ["item_b"]);

const collection = createStoryboardCollection({
    name: "Favorites",
    itemIds: ["item_a", "item_b", "item_a"],
    generateId: () => "favorites",
});

assert.equal(collection.id, "favorites");
assert.deepEqual(collection.item_ids, ["item_a", "item_b"]);
assert.equal(normalizeStoryboardCollectionColor("#def"), "#ddeeff");
assert.deepEqual(getStoryboardCollectionItems(collection, items).map((item) => item.id), ["item_a", "item_b"]);
assert.equal(storyboardCollectionMatchesSelection(collection, ["item_b", "item_a"]), true);
assert.equal(storyboardCollectionMatchesSelection(collection, ["item_a"]), false);

console.log(JSON.stringify({
    normalized: normalized.length,
    collectionId: collection.id,
}));

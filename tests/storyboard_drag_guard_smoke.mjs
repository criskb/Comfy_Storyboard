import assert from "node:assert/strict";

import {
    eventTargetsStoryboardSurface,
    hasStoryboardExternalDragPayload,
    shouldCaptureStoryboardDragEvent,
} from "../web/storyboard/drag_guard.js";

const overlay = {
    contains(node) {
        return node === insideTarget;
    },
};
const insideTarget = { id: "inside" };
const outsideTarget = { id: "outside" };

assert.equal(
    hasStoryboardExternalDragPayload({
        items: [{ kind: "file" }],
        files: { length: 0 },
        types: [],
    }),
    true,
);

assert.equal(
    hasStoryboardExternalDragPayload({
        items: [],
        files: { length: 0 },
        types: ["Files"],
    }),
    true,
);

assert.equal(
    hasStoryboardExternalDragPayload({
        items: [],
        files: { length: 0 },
        types: ["text/plain"],
    }),
    false,
);

assert.equal(
    eventTargetsStoryboardSurface({
        target: outsideTarget,
        composedPath: () => [outsideTarget, overlay],
    }, overlay),
    true,
);

assert.equal(
    eventTargetsStoryboardSurface({
        target: outsideTarget,
        composedPath: () => [outsideTarget],
    }, overlay),
    false,
);

assert.equal(
    shouldCaptureStoryboardDragEvent({
        target: insideTarget,
        dataTransfer: {
            items: [{ kind: "file" }],
            files: { length: 1 },
            types: ["Files"],
        },
        composedPath: () => [insideTarget, overlay],
    }, overlay, true),
    true,
);

assert.equal(
    shouldCaptureStoryboardDragEvent({
        target: outsideTarget,
        dataTransfer: {
            items: [{ kind: "file" }],
            files: { length: 1 },
            types: ["Files"],
        },
        composedPath: () => [outsideTarget],
    }, overlay, true),
    false,
);

assert.equal(
    shouldCaptureStoryboardDragEvent({
        target: insideTarget,
        dataTransfer: {
            items: [],
            files: { length: 0 },
            types: ["text/plain"],
        },
        composedPath: () => [insideTarget, overlay],
    }, overlay, true),
    false,
);

console.log(JSON.stringify({
    capturesFiles: true,
    ignoresPlainText: true,
}));

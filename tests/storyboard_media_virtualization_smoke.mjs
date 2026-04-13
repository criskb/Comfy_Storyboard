import assert from "node:assert/strict";

import {
    STORYBOARD_MEDIA_ACTIVATION_BATCH_SIZE,
    STORYBOARD_MEDIA_MIN_MARGIN_WORLD,
    STORYBOARD_MEDIA_PRELOAD_MARGIN_PX,
    STORYBOARD_MEDIA_RETAIN_MARGIN_MULTIPLIER,
    getStoryboardMediaViewportDistance,
    getStoryboardMediaActivationRect,
    getStoryboardViewportWorldRect,
    isStoryboardMediaItem,
    shouldActivateStoryboardMedia,
} from "../web/storyboard/media_virtualization.js";

assert.equal(STORYBOARD_MEDIA_PRELOAD_MARGIN_PX, 960);
assert.equal(STORYBOARD_MEDIA_MIN_MARGIN_WORLD, 280);
assert.equal(STORYBOARD_MEDIA_RETAIN_MARGIN_MULTIPLIER, 1.35);
assert.equal(STORYBOARD_MEDIA_ACTIVATION_BATCH_SIZE, 6);

const viewportRect = getStoryboardViewportWorldRect({
    offset: { x: -200, y: 100 },
    scale: 2,
    width: 800,
    height: 600,
});
assert.deepEqual(viewportRect, { x: 100, y: -50, w: 400, h: 300 });

const activationRect = getStoryboardMediaActivationRect(viewportRect, {
    scale: 2,
    marginPx: 120,
    minMarginWorld: 40,
});
assert.deepEqual(activationRect, { x: 40, y: -110, w: 520, h: 420 });

assert.equal(isStoryboardMediaItem({ type: "image" }), true);
assert.equal(isStoryboardMediaItem({ type: "video" }), true);
assert.equal(isStoryboardMediaItem({ type: "note" }), false);

assert.equal(
    shouldActivateStoryboardMedia(
        { id: "img_near", type: "image", x: 530, y: 0, w: 40, h: 40 },
        viewportRect,
        { scale: 2, marginPx: 120, minMarginWorld: 40 },
    ),
    true,
);

assert.equal(
    shouldActivateStoryboardMedia(
        { id: "img_far", type: "image", x: 700, y: 0, w: 40, h: 40 },
        viewportRect,
        { scale: 2, marginPx: 120, minMarginWorld: 40 },
    ),
    false,
);

assert.equal(
    shouldActivateStoryboardMedia(
        { id: "img_retained", type: "image", x: 575, y: 0, w: 40, h: 40 },
        viewportRect,
        { scale: 2, marginPx: 120, minMarginWorld: 40, currentActive: true },
    ),
    true,
);

assert.equal(
    shouldActivateStoryboardMedia(
        { id: "vid_forced", type: "video", x: 700, y: 700, w: 40, h: 40 },
        viewportRect,
        { scale: 2, marginPx: 120, minMarginWorld: 40, forceActiveIds: ["vid_forced"] },
    ),
    true,
);

assert.equal(
    shouldActivateStoryboardMedia(
        { id: "note_1", type: "note", x: 2000, y: 2000, w: 40, h: 40 },
        viewportRect,
        { scale: 2, marginPx: 120, minMarginWorld: 40 },
    ),
    true,
);

assert.equal(
    getStoryboardMediaViewportDistance(
        { id: "inside", type: "image", x: 130, y: 20, w: 60, h: 60 },
        viewportRect,
    ),
    0,
);

assert.equal(
    getStoryboardMediaViewportDistance(
        { id: "right", type: "image", x: 610, y: 20, w: 40, h: 40 },
        viewportRect,
    ),
    12100,
);

console.log(JSON.stringify({
    viewportRect,
    activationRect,
    forcedActive: true,
}));

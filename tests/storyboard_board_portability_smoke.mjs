import assert from "node:assert/strict";

import {
    createStoryboardPackageFilename,
    sanitizeStoryboardBoardName,
    sanitizeStoryboardFileToken,
    suggestStoryboardImportName,
} from "../web/storyboard/board_portability.js";

assert.equal(sanitizeStoryboardBoardName("  Scene / Alpha  "), "Scene - Alpha");
assert.equal(sanitizeStoryboardBoardName("???", "Fallback Board"), "Fallback Board");
assert.equal(sanitizeStoryboardFileToken("Scene / Alpha"), "scene-alpha");

const filename = createStoryboardPackageFilename("Scene Alpha", "2026-04-11T12:34:56.000Z");
assert.equal(filename, "scene-alpha-2026-04-11T12-34-56Z.storyboard.json");

assert.equal(
    suggestStoryboardImportName({ board: { board_id: "Act 1 / Roof" } }, "Fallback"),
    "Act 1 - Roof Copy",
);
assert.equal(suggestStoryboardImportName({}, "Fallback"), "Fallback");

console.log(JSON.stringify({
    filename,
    suggested: suggestStoryboardImportName({ board: { board_id: "Scene 12" } }, "Fallback"),
}));

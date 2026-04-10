import { DEFAULT_FRAME_COLOR, DEFAULT_NOTE_COLOR } from "../../design_system.js";

function getViewportPlacement(workspace, x, y) {
    return {
        x: -workspace.offset.x / workspace.scale + x,
        y: -workspace.offset.y / workspace.scale + y,
    };
}

export const coreStoryboardExtensions = [
    {
        id: "core.slot",
        type: "slot",
        title: "Core Slot",
        toolbar: {
            buttonId: "storyboard-add-slot",
            label: "Add Slot",
            title: "Add Slot",
            iconKey: "slot",
            section: "Core Items",
        },
        createItem(workspace) {
            const position = getViewportPlacement(workspace, 100, 100);
            return {
                id: `slot_${Date.now()}`,
                type: "slot",
                x: position.x,
                y: position.y,
                w: 512,
                h: 512,
                label: "New Slot",
                tags: [],
            };
        },
    },
    {
        id: "core.note",
        type: "note",
        title: "Core Note",
        toolbar: {
            buttonId: "storyboard-add-note",
            label: "Add Note",
            title: "Add Note",
            iconKey: "note",
            section: "Core Items",
        },
        createItem(workspace) {
            const position = getViewportPlacement(workspace, 150, 150);
            return {
                id: `note_${Date.now()}`,
                type: "note",
                x: position.x,
                y: position.y,
                w: 200,
                h: 150,
                content: "New Note",
                color: DEFAULT_NOTE_COLOR,
            };
        },
    },
    {
        id: "core.frame",
        type: "frame",
        title: "Core Frame",
        toolbar: {
            buttonId: "storyboard-add-frame",
            label: "Add Frame",
            title: "Add Frame",
            iconKey: "frame",
            section: "Core Items",
        },
        createItem(workspace) {
            const position = getViewportPlacement(workspace, 200, 200);
            return {
                id: `frame_${Date.now()}`,
                type: "frame",
                x: position.x,
                y: position.y,
                w: 600,
                h: 400,
                label: "New Frame",
                color: DEFAULT_FRAME_COLOR,
                scene_code: workspace.getNextFrameSceneCode(),
            };
        },
    },
    { id: "core.image", type: "image", title: "Core Image" },
    { id: "core.video", type: "video", title: "Core Video" },
    { id: "core.palette", type: "palette", title: "Core Palette" },
];

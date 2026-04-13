# ComfyUI Storyboard Workspace

![ComfyUI Storyboard Banner](assets/storyboard_banner.svg)

A PureRef-inspired storyboard and reference board for ComfyUI. This extension provides an infinite canvas where you can collect references, organize shots, and target generations directly into placeholders.

## Features

- **Infinite Canvas**: Pan and zoom workspace for organizing your creative process.
- **Direct Import**: Drag and drop local images or paste images/URLs directly into the workspace.
- **Workflow Integration**: 
    - **Generate to Selected**: Run a workflow and have the output land directly in a selected slot or item.
    - **Upstream Producer**: Send images to the board via tags or placeholder IDs.
    - **Downstream Consumer**: Pull curated images or batches from the board back into your workflow (e.g., for IPAdapter or control nets).
- **Organization Tools**: 
    - **Slots**: Create empty generation targets.
    - **Notes**: Add sticky notes for context and planning.
    - **Z-Order**: Bring items to front or send to back.
    - **Inspector**: Edit labels and tags for any item.
    - **Collections**: Save a multi-item selection as a named collection, then reselect, append, focus, rename, or refresh it later from the inspector.
- **Visibility + Locking**:
    - **Hide / Reveal**: Hide clutter temporarily, then reveal hidden items from the canvas `Actions` list or by collection.
    - **Lock / Unlock**: Freeze important items so they stay visible but cannot be moved, resized, cropped, or accidentally deleted.
- **Selection Tools**: Drag a marquee over the canvas to box-select items, then duplicate them in place for faster board building.
    - **History**: Undo and redo structural board edits from the header or with standard desktop shortcuts.
- **Portable Boards**:
    - **Copy Boards**: Duplicate an entire storyboard, including its local assets, before exploring a new direction.
    - **Export Packages**: Save a board as a portable `.storyboard.json` package with referenced images and videos embedded.
    - **Import Packages**: Restore packaged boards into a new board ID on another machine or project.

## Nodes

### 🎨 Storyboard
The main workspace node. 
- **Open Storyboard**: Launches the workspace window.
- **Action**: Can be used to programmatically clear the board.
- **Board ID**: Supports multiple independent boards.

### 🎨 Storyboard Send
Pushes images into a storyboard.
- **Target Mode**: `selected`, `placeholder_id`, `tag`, or `new_item`.
- **Target**: The ID or tag to match.
- **Append Mode**: Choose to replace or append to the target.

### 🎨 Storyboard Read
Reads images/data from a board.
- **Read Mode**: `first_selected`, `all_selected_batch`, `by_tag`, etc.
- **Tag Filter**: Filter items by their assigned tags.

### 🎨 Storyboard Slot
Creates named empty placeholders in the board.

## Installation

1. Clone this repository into your `ComfyUI/custom_nodes/` directory.
2. Restart ComfyUI.

## Usage

1. Add a **Storyboard** node to your graph.
2. Click **Open Storyboard** to open the workspace.
3. Drag in some images or add a **Slot**.
4. Use **Storyboard Send** in your generation pipe to target your board items.
5. Use **Storyboard Read** to feed board items into other nodes.

You can duplicate a board from the header, and use the canvas right-click `Actions` list to export a portable package or import a previously exported package.
The inspector now doubles as a lightweight collections manager, and the board remembers its last viewport so reopening a board brings you back to the same working area.
You can also use `Cmd/Ctrl+A` to select everything, `Cmd/Ctrl+D` to duplicate the current selection, and the standard copy/paste shortcuts to duplicate richer item payloads safely.
Undo uses `Cmd/Ctrl+Z`, and redo uses `Shift+Cmd/Ctrl+Z` or `Cmd/Ctrl+Y`.
Visible board items can now be hidden or locked directly from the inspector, multi-select tools, or collections, and hidden items can be revealed again from the canvas `Actions` menu without rebuilding the board.
Board import/export and hidden-item recovery are also available from the canvas right-click `Actions` list, and the main Storyboard node now outputs the raw `prompt_text` string alongside `conditioning`.
Image and video cards now stay dormant when they are far off-screen, then wake up shortly before they enter view so dense boards stay smoother without losing the board layout.

---

![ComfyUI Storyboard Signature](assets/storyboard_sig_icon.svg)

This extension/addon was created using Codex skill designed by Cris K B https://github.com/criskb/comfyui-node-extension-builder

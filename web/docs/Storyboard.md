# Storyboard

The main Storyboard workspace node opens the board UI and exposes the board state back into your workflow.

## Inputs

- `action`: Use `none` for normal operation or `clear` to wipe the current board.
- `target_id`: Reserved for targeted actions.
- `board_id`: Selects which storyboard to open or read.
- `version`: Manual refresh knob you can increment if you want to force downstream reevaluation.
- `prompt`: Optional prompt text to encode when a `CLIP` input is connected.
- `images`: Optional passthrough image input.
- `manifest_in`: Optional existing storyboard manifest.
- `clip`: Optional CLIP model for prompt conditioning.

## Outputs

- `selected_image`: First selected image or flattened selected frame.
- `selected_batch`: All selected image-like items as a batch.
- `selected_mask`: Zero mask matching `selected_image` size.
- `selected_meta`: JSON metadata for the current selection.
- `board_manifest`: Full board data for downstream nodes.
- `board_preview`: Flattened preview image of the current board.
- `conditioning`: Prompt conditioning generated from `prompt` and `clip`.
- `prompt_text`: Raw prompt string passed into the node.
- `ref_1` to `ref_8`: Image references taken from items assigned to reference slots.
- `ref_video_1` to `ref_video_8`: Video file paths for referenced video items.

## Tips

- Use multiple `board_id` values to keep separate storyboards for different scenes or projects.
- Use the board header actions to duplicate a board before trying a new layout pass, and use the canvas right-click `Actions` list to import/export `.storyboard.json` packages or reveal hidden items when you want to recover the board state without cluttering the top bar.
- Save multi-item selections as named collections from the inspector when you want reusable board clusters you can reselect, append, focus, refresh, hide, show, lock, or unlock later.
- Drag on empty canvas space to marquee-select items, then use `Cmd/Ctrl+D` to duplicate the selection or `Cmd/Ctrl+A` to grab the full board quickly.
- Use the header `Undo` / `Redo` controls or `Cmd/Ctrl+Z` and `Shift+Cmd/Ctrl+Z` to reverse structural board edits without losing your current viewport.
- Hide items when you want a cleaner working board, then use `Reveal Hidden` in the canvas `Actions` list or collection controls to bring them back.
- Lock items when you need them to stay visible but protected from drag, resize, crop, slot import, duplicate, and delete actions.
- Image and video items now stay dormant when they are well outside the viewport, then wake up as they get close so large boards avoid paying the full media rendering cost all at once.
- Frame items can be read as flattened images, which makes them useful as moodboard outputs.
- The node does not need to stay visible on screen after the board is created; the saved board state lives in the manifest.
- The board now restores its last saved viewport, which makes it easier to reopen dense boards exactly where you left off.
- Multi-select references and use `Scatter as Moodboard` for a looser collage composition, then `Frame Selection` to turn the result into a reusable board section.
- Use `Arrange as Story Strip` when you want a cleaner sequential storyboard read, or `Stack as Pile` when you want references to feel more like an overlapping moodboard cluster.
- Selected frames can now switch between rigid grid, loose moodboard scatter, storyboard strip, and stacked pile layouts without rebuilding the section by hand.
- Image and video items now support `Clean`, `Story Panel`, and `Polaroid` presentation presets, so you can switch between straightforward references, readable storyboard captions, and more editorial moodboard cards.
- Frames now support `Outline`, `Board Card`, and `Spotlight` styles, which makes it easier to separate clean storyboard sections from softer moodboard groupings.
- Frames can carry a `Scene Code` and `Subtitle`, and multi-selected frames can be renumbered automatically in reading order to build clearer sequential storyboards.
- The storyboard settings panel now controls grid visibility, snap-to-grid behavior, grid spacing, and panel visibility for the prompt bar, minimap, and inspector.
- The canvas now has a `core` / `custom` extension structure under `web/storyboard/extensions/`, so new storyboard item types can be added without continuing to grow the main workspace file.
- The top bar now stays focused on `Slot`, `Note`, `Frame`, and up to six pinned favorites. Use `Add Node/Widget` or double-click empty canvas to open the searchable node/widget picker.
- Inside the picker, right-click any non-core entry to pin or unpin it from the top bar.
- The custom extension sandbox now includes `Demo Set` and `Clear Demo` actions, so you can drop in a full tagged sandbox cluster and remove it again without touching the rest of the board.
- The custom sandbox now also has utility widgets with actual board actions: `Prompt Card` can write to the storyboard prompt bar, `Checklist Card` stores live completion state, and `Reference Basket` can capture and reselect groups of board items.
- Current custom sandbox widgets include `Mood Tag`, `Prompt Card`, `Checklist Card`, `Reference Basket`, `Shot Card`, `Story Beat`, `Swatch Strip`, `Scene Divider`, `Lens Card`, `Set Dressing Card`, `Character Card`, `Wardrobe Card`, `Location Card`, `Dialogue Card`, `Hair + Makeup Note`, `Stunt Note`, `Continuity Note`, `Camera Move`, `Lighting Cue`, `Prop Card`, `Sound Cue`, `Transition Card`, `Editorial Card`, `Production Note`, `Graphics Note`, `Grade Card`, `VFX Note`, and `Blocking Note`, each living in its own folder under `web/storyboard/extensions/custom/`.
- The empty-canvas context menu now groups insert tools into `Core Items`, `Sandbox Actions`, and `Sandbox Items`, which makes the growing extension library easier to browse.
- Image, video, slot, and note items support tilt so you can create more organic moodboard layouts instead of only rigid grids.

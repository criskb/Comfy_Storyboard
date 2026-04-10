# Storyboard Send

Push images or videos into a storyboard from a running workflow.

## Inputs

- `board_id`: Destination storyboard.
- `media_kind`: Choose `auto`, `image`, or `video`.
- `target_mode`: Send to the current selection, a specific placeholder id, a tag match, or create a new item.
- `target`: Used with `placeholder_id` or `tag`.
- `label`: Optional label to apply to created or replaced items.
- `tags`: Comma-separated tags to add to the received items.
- `append_mode`: `replace` updates matching items, `append` creates extras nearby when possible.
- `images`: Image batch input.
- `video` / `video_path`: Video source input.
- `manifest`: Optional manifest whose `board_id` overrides the text field.

## Behavior

- If you target the current selection, incoming images are matched against selected items in order.
- If more media arrives than selected items exist, extra items are created nearby.
- Tag mode can replace tagged items or append variants around the last matching item.

## Tips

- Give slots or placeholders stable labels and tags if you want deterministic routing.
- For gallery-style boards, use `new_item` plus tags so later reads can pull grouped references back out.

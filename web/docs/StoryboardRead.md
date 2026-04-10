# Storyboard Read

Read images back out of a storyboard manifest for downstream workflow use.

## Inputs

- `board_manifest`: Manifest output from the main `Storyboard` node.
- `read_mode`: Chooses how images are gathered.
- `tag_filter`: Used when `read_mode` is `by_tag`.

## Read Modes

- `first_selected`: Returns the first selected image-like item.
- `all_selected_batch`: Returns every selected image-like item as a padded batch.
- `by_tag`: Returns all image-like items containing the requested tag.
- `ordered_by_board`: Returns all readable image-like items in board order.
- `flattened_board`: Returns a single flattened preview image of the whole board.

## Outputs

- `image`: The selected image or batch.
- `metadata`: JSON describing the returned items and read mode.
- `ordering`: Comma-separated item ids in output order, or `flattened_board` for board previews.

## Notes

- Mixed image sizes are padded into a common batch shape instead of failing.
- Frames are treated as readable images by flattening their contents on demand.

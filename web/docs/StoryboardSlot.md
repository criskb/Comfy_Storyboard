# Storyboard Slot

Create structured slot metadata for workflows that want named placeholder targets.

## Inputs

- `name`: Human-readable slot label.
- `id`: Stable slot identifier.
- `tags`: Optional comma-separated tags for routing.

## Output

- `slot_data`: Lightweight slot metadata you can pass around or use when building higher-level workflows.

## Tip

- Use stable ids such as `shot_01`, `hero_closeup`, or `plate_bg` so `Storyboard Send` can target placeholders predictably.

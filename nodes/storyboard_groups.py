from __future__ import annotations

import re
import uuid

DEFAULT_STORYBOARD_COLLECTION_COLORS = (
    "#7dd3fc",
    "#fda4af",
    "#86efac",
    "#fde68a",
    "#c4b5fd",
    "#f9a8d4",
)

HEX_COLOR_PATTERN = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def normalize_storyboard_collection_color(value, fallback):
    color = str(value or "").strip()
    if not HEX_COLOR_PATTERN.match(color):
        return fallback
    if len(color) == 4:
        return "#" + "".join(channel * 2 for channel in color[1:])
    return color.lower()


def normalize_storyboard_groups(groups, items):
    item_ids = {
        str(item.get("id")).strip()
        for item in (items or [])
        if isinstance(item, dict) and item.get("id")
    }
    normalized = []
    seen_group_ids = set()

    for index, raw_group in enumerate(groups or []):
        if not isinstance(raw_group, dict):
            continue

        group_id = str(raw_group.get("id") or "").strip()
        if not group_id or group_id in seen_group_ids:
            group_id = str(uuid.uuid4())
        seen_group_ids.add(group_id)

        name = str(raw_group.get("name") or "").strip() or f"Collection {len(normalized) + 1}"
        fallback_color = DEFAULT_STORYBOARD_COLLECTION_COLORS[index % len(DEFAULT_STORYBOARD_COLLECTION_COLORS)]
        color = normalize_storyboard_collection_color(raw_group.get("color"), fallback_color)

        raw_item_ids = raw_group.get("item_ids")
        if raw_item_ids is None:
            raw_item_ids = raw_group.get("items")

        collection_item_ids = []
        seen_item_ids = set()
        for item_id in raw_item_ids or []:
            normalized_id = str(item_id or "").strip()
            if not normalized_id or normalized_id not in item_ids or normalized_id in seen_item_ids:
                continue
            collection_item_ids.append(normalized_id)
            seen_item_ids.add(normalized_id)

        normalized_group = {
            "id": group_id,
            "name": name,
            "color": color,
            "item_ids": collection_item_ids,
        }

        created_at = str(raw_group.get("created_at") or "").strip()
        updated_at = str(raw_group.get("updated_at") or "").strip()
        if created_at:
            normalized_group["created_at"] = created_at
        if updated_at:
            normalized_group["updated_at"] = updated_at

        normalized.append(normalized_group)

    return normalized

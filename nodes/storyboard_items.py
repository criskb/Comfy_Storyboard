from __future__ import annotations


FALSEY_TEXT_VALUES = {"", "0", "false", "no", "off", "null", "undefined"}


def normalize_storyboard_bool(value):
    if isinstance(value, str):
        return value.strip().lower() not in FALSEY_TEXT_VALUES
    return bool(value)


def is_storyboard_item_hidden(item):
    return isinstance(item, dict) and normalize_storyboard_bool(item.get("hidden"))


def is_storyboard_item_locked(item):
    return isinstance(item, dict) and (
        normalize_storyboard_bool(item.get("locked"))
        or normalize_storyboard_bool(item.get("pinned"))
    )


def normalize_storyboard_item_state(item, *, mirror_legacy_pinned=False):
    if not isinstance(item, dict):
        return item

    hidden = is_storyboard_item_hidden(item)
    locked = is_storyboard_item_locked(item)

    if hidden:
        item["hidden"] = True
    else:
        item.pop("hidden", None)

    if locked:
        item["locked"] = True
    else:
        item.pop("locked", None)

    if mirror_legacy_pinned:
        if locked:
            item["pinned"] = True
        else:
            item.pop("pinned", None)
    else:
        item.pop("pinned", None)

    return item


def normalize_storyboard_items(items, *, mirror_legacy_pinned=False):
    for item in items or []:
        normalize_storyboard_item_state(item, mirror_legacy_pinned=mirror_legacy_pinned)
    return items or []


def normalize_storyboard_selection(selection, items, *, include_hidden=False):
    allowed_ids = {
        str(item.get("id")).strip()
        for item in normalize_storyboard_items(items)
        if isinstance(item, dict)
        and item.get("id")
        and (include_hidden or not is_storyboard_item_hidden(item))
    }

    return [
        item_id
        for item_id in (
            str(raw_item_id or "").strip()
            for raw_item_id in (selection or [])
        )
        if item_id and item_id in allowed_ids
    ]

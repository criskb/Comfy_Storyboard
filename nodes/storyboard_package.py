from __future__ import annotations

import base64
import copy
import mimetypes
import os
from datetime import datetime, timezone

from .storyboard_items import normalize_storyboard_items, normalize_storyboard_selection

STORYBOARD_PACKAGE_FORMAT = "comfyui-storyboard-package"
STORYBOARD_PACKAGE_VERSION = 1
STORYBOARD_ASSET_REFERENCE_KEYS = ("image_ref", "video_ref")


def clone_board_payload(board_data):
    board = copy.deepcopy(board_data if isinstance(board_data, dict) else {})
    board.setdefault("items", [])
    board.setdefault("groups", [])
    board.setdefault("selection", [])
    board.setdefault("viewport", {"x": 0, "y": 0, "zoom": 1})
    normalize_storyboard_items(board["items"])
    board["selection"] = normalize_storyboard_selection(board.get("selection", []), board["items"])
    return board


def safe_asset_name(filename):
    cleaned = os.path.basename(str(filename or "").strip())
    return cleaned or None


def iter_board_asset_names(items):
    seen = set()
    for item in items or []:
        if not isinstance(item, dict):
            continue
        for key in STORYBOARD_ASSET_REFERENCE_KEYS:
            asset_name = safe_asset_name(item.get(key))
            if asset_name and asset_name not in seen:
                seen.add(asset_name)
                yield asset_name


def normalize_board_selection(board_data):
    normalize_storyboard_items(board_data.get("items", []))
    board_data["selection"] = normalize_storyboard_selection(
        board_data.get("selection", []),
        board_data.get("items", []),
    )
    return board_data


def build_storyboard_package(board_data, assets_path):
    board = normalize_board_selection(clone_board_payload(board_data))
    assets = []
    missing_assets = []

    for asset_name in iter_board_asset_names(board.get("items", [])):
        full_path = os.path.join(assets_path, asset_name)
        if not os.path.isfile(full_path):
            missing_assets.append(asset_name)
            continue

        with open(full_path, "rb") as asset_file:
            encoded = base64.b64encode(asset_file.read()).decode("ascii")

        assets.append({
            "filename": asset_name,
            "content_type": mimetypes.guess_type(asset_name)[0] or "application/octet-stream",
            "encoding": "base64",
            "data": encoded,
        })

    return {
        "format": STORYBOARD_PACKAGE_FORMAT,
        "version": STORYBOARD_PACKAGE_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "board": board,
        "assets": assets,
        "missing_assets": missing_assets,
    }


def parse_storyboard_package(package_data):
    if not isinstance(package_data, dict):
        raise ValueError("Storyboard package must be a JSON object.")

    package_format = str(package_data.get("format") or "").strip()
    if package_format != STORYBOARD_PACKAGE_FORMAT:
        raise ValueError("Unsupported storyboard package format.")

    version = int(package_data.get("version") or 0)
    if version != STORYBOARD_PACKAGE_VERSION:
        raise ValueError(f"Unsupported storyboard package version: {version}")

    board_payload = package_data.get("board")
    if not isinstance(board_payload, dict):
        raise ValueError("Storyboard package is missing the board payload.")

    assets_payload = package_data.get("assets") or []
    if not isinstance(assets_payload, list):
        raise ValueError("Storyboard package assets must be a list.")

    return normalize_board_selection(clone_board_payload(board_payload)), assets_payload


def _build_unique_asset_name(filename, used_names):
    safe_name = safe_asset_name(filename) or "asset.bin"
    stem, ext = os.path.splitext(safe_name)
    candidate = safe_name
    suffix = 2

    while candidate in used_names:
        candidate = f"{stem}_{suffix}{ext}"
        suffix += 1

    used_names.add(candidate)
    return candidate


def write_package_assets(assets_payload, assets_path):
    os.makedirs(assets_path, exist_ok=True)
    used_names = set()
    asset_name_map = {}

    for asset in assets_payload:
        if not isinstance(asset, dict):
            continue

        source_name = safe_asset_name(asset.get("filename"))
        if not source_name or source_name in asset_name_map:
            continue

        encoded = asset.get("data")
        if not isinstance(encoded, str) or not encoded.strip():
            continue

        try:
            raw_bytes = base64.b64decode(encoded.encode("ascii"), validate=True)
        except Exception as exc:
            raise ValueError(f"Failed to decode packaged asset '{source_name}': {exc}") from exc

        target_name = _build_unique_asset_name(source_name, used_names)
        full_path = os.path.join(assets_path, target_name)
        with open(full_path, "wb") as asset_file:
            asset_file.write(raw_bytes)

        asset_name_map[source_name] = target_name

    return asset_name_map


def remap_item_asset_references(items, asset_name_map):
    missing_assets = set()

    for item in items or []:
        if not isinstance(item, dict):
            continue
        for key in STORYBOARD_ASSET_REFERENCE_KEYS:
            original_ref = item.get(key)
            source_name = safe_asset_name(original_ref)
            if not source_name:
                continue
            mapped_name = asset_name_map.get(source_name)
            if mapped_name:
                item[key] = mapped_name
            else:
                missing_assets.add(source_name)

    return sorted(missing_assets)

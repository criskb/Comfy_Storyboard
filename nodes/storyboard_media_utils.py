from __future__ import annotations

import os

import numpy as np
import torch
from PIL import Image


def blank_image_tensor(width=64, height=64):
    return torch.zeros((1, height, width, 3), dtype=torch.float32)


def blank_mask_tensor(width=64, height=64):
    return torch.zeros((1, height, width), dtype=torch.float32)


def apply_normalized_crop(image, crop):
    if not crop:
        return image

    width, height = image.size
    left = int(float(crop.get("x", 0.0)) * width)
    top = int(float(crop.get("y", 0.0)) * height)
    right = int((float(crop.get("x", 0.0)) + float(crop.get("w", 1.0))) * width)
    bottom = int((float(crop.get("y", 0.0)) + float(crop.get("h", 1.0))) * height)

    left = max(0, min(width - 1, left))
    top = max(0, min(height - 1, top))
    right = max(left + 1, min(width, right))
    bottom = max(top + 1, min(height, bottom))
    return image.crop((left, top, right, bottom))


def pil_to_image_tensor(image):
    rgb_image = image.convert("RGB")
    image_np = np.array(rgb_image).astype(np.float32) / 255.0
    return torch.from_numpy(image_np).unsqueeze(0)


def ensure_single_image_tensor(image_tensor):
    if image_tensor.dim() == 4 and image_tensor.shape[0] == 1:
        return image_tensor.squeeze(0)
    if image_tensor.dim() == 3:
        return image_tensor
    raise ValueError(f"Expected IMAGE tensor with shape [1,H,W,C] or [H,W,C], got {tuple(image_tensor.shape)}")


def batch_image_tensors(image_tensors, fill_value=0.0):
    if not image_tensors:
        return blank_image_tensor()

    single_tensors = [ensure_single_image_tensor(tensor) for tensor in image_tensors]
    max_height = max(int(tensor.shape[0]) for tensor in single_tensors)
    max_width = max(int(tensor.shape[1]) for tensor in single_tensors)
    channels = int(single_tensors[0].shape[2])

    batch = []
    for tensor in single_tensors:
        height = int(tensor.shape[0])
        width = int(tensor.shape[1])
        canvas = torch.full((max_height, max_width, channels), fill_value, dtype=tensor.dtype)
        y_offset = max(0, (max_height - height) // 2)
        x_offset = max(0, (max_width - width) // 2)
        canvas[y_offset:y_offset + height, x_offset:x_offset + width, :] = tensor
        batch.append(canvas.unsqueeze(0))

    return torch.cat(batch, dim=0)


def resolve_item_asset_path(store, board_id, item, allow_frames=False, frame_scale=2.0):
    item_type = item.get("type")
    assets_path = store._get_assets_path(board_id)

    if item_type == "image" and item.get("image_ref"):
        path = os.path.join(assets_path, item["image_ref"])
        return path if os.path.exists(path) else None

    if item_type == "frame" and allow_frames and item.get("id"):
        filename = store.flatten_frame(board_id, item["id"], scale=frame_scale)
        if filename:
            path = os.path.join(assets_path, filename)
            return path if os.path.exists(path) else None

    return None


def load_item_pil_image(store, board_id, item, allow_frames=False, frame_scale=2.0):
    image_path = resolve_item_asset_path(
        store,
        board_id,
        item,
        allow_frames=allow_frames,
        frame_scale=frame_scale,
    )
    if not image_path:
        return None

    try:
        image = Image.open(image_path).convert("RGB")
        if item.get("type") != "frame":
            image = apply_normalized_crop(image, item.get("crop"))
        return image
    except Exception as exc:
        print(f"Storyboard: failed to load item image '{item.get('id', 'unknown')}': {exc}")
        return None


def load_item_image_tensor(store, board_id, item, allow_frames=False, frame_scale=2.0):
    image = load_item_pil_image(
        store,
        board_id,
        item,
        allow_frames=allow_frames,
        frame_scale=frame_scale,
    )
    if image is None:
        return None
    return pil_to_image_tensor(image)

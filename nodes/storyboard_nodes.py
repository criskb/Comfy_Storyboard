import os
import torch
import json
import uuid
from PIL import Image
import numpy as np
from .storyboard_store import store

class Storyboard:
    @classmethod
    def IS_CHANGED(s, **kwargs):
        return float("nan")

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "action": (["none", "open", "clear", "export", "save_to_manifest"], {"default": "none"}),
                "target_id": ("STRING", {"default": ""}),
                "board_id": ("STRING", {"default": "default"}),
                "version": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "prompt": ("STRING", {"multiline": True, "default": ""}),
            },
            "optional": {
                "images": ("IMAGE",),
                "manifest_in": ("STORYBOARD_MANIFEST",),
                "clip": ("CLIP",),
            }
        }

    RETURN_TYPES = (
        "IMAGE", "IMAGE", "MASK", "JSON", "STORYBOARD_MANIFEST", "IMAGE", "CONDITIONING",
        "IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE",
        "STRING", "STRING", "STRING", "STRING", "STRING", "STRING", "STRING", "STRING",
    )
    RETURN_NAMES = (
        "selected_image", "selected_batch", "selected_mask", "selected_meta", "board_manifest", "board_preview", "conditioning",
        "ref_1", "ref_2", "ref_3", "ref_4", "ref_5", "ref_6", "ref_7", "ref_8",
        "ref_video_1", "ref_video_2", "ref_video_3", "ref_video_4", "ref_video_5", "ref_video_6", "ref_video_7", "ref_video_8",
    )
    FUNCTION = "process"
    CATEGORY = "Storyboard"

    def process(self, action="none", target_id="", board_id="default", version=0, prompt="", images=None, manifest_in=None, clip=None):
        board_data = store.get_board(board_id)
        
        if action == "clear":
            board_data["items"] = []
            board_data["selection"] = []
            store.save_board(board_data)
        
        # Prompt conditioning
        conditioning = None
        if clip is not None and prompt:
            tokens = clip.tokenize(prompt)
            cond, pooled = clip.encode_from_tokens(tokens, return_pooled=True)
            conditioning = [[cond, {"pooled_output": pooled}]]
        
        # Reference images
        refs = [torch.zeros((1, 64, 64, 3)) for _ in range(8)]
        ref_videos = ["" for _ in range(8)]
        items = board_data.get("items", [])
        
        # Sort items to maintain layering during flattening
        items = sorted(items, key=lambda x: (x.get("type") != "frame", items.index(x)))

        for item in items:
            ref_idx = item.get("ref_id")
            if not ref_idx or not (1 <= ref_idx <= 8):
                continue

            img_path = None
            if item.get("type") == "image" and item.get("image_ref"):
                img_path = os.path.join(store._get_assets_path(board_id), item["image_ref"])
            elif item.get("type") == "video" and item.get("video_ref"):
                ref_videos[ref_idx - 1] = os.path.join(store._get_assets_path(board_id), item["video_ref"])
                continue
            elif item.get("type") == "frame":
                # Automatically flatten frame
                filename = store.flatten_frame(board_id, item["id"], scale=2.0)
                if filename:
                    img_path = os.path.join(store._get_assets_path(board_id), filename)

            if img_path and os.path.exists(img_path):
                img = Image.open(img_path).convert("RGB")
                
                # Apply crop if present
                crop = item.get("crop")
                if crop:
                    w, h = img.size
                    left = int(crop["x"] * w)
                    top = int(crop["y"] * h)
                    right = int((crop["x"] + crop["w"]) * w)
                    bottom = int((crop["y"] + crop["h"]) * h)
                    # Ensure valid crop boundaries
                    left = max(0, min(w - 1, left))
                    top = max(0, min(h - 1, top))
                    right = max(left + 1, min(w, right))
                    bottom = max(top + 1, min(h, bottom))
                    img = img.crop((left, top, right, bottom))

                img_np = np.array(img).astype(np.float32) / 255.0
                refs[ref_idx - 1] = torch.from_numpy(img_np).unsqueeze(0)
        
        # Return currently selected images and manifest
        # (This is a simplified implementation for v1)
        dummy_image = torch.zeros((1, 64, 64, 3))
        dummy_mask = torch.zeros((1, 64, 64))
        dummy_json = {}
        
        return (dummy_image, dummy_image, dummy_mask, dummy_json, board_data, dummy_image, conditioning, *refs, *ref_videos)

class StoryboardSend:
    @classmethod
    def IS_CHANGED(s, **kwargs):
        return float("nan")

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "board_id": ("STRING", {"default": "default"}),
                "media_kind": (["auto", "image", "video"], {"default": "auto"}),
                "target_mode": (["selected", "placeholder_id", "tag", "new_item"], {"default": "selected"}),
                "target": ("STRING", {"default": ""}),
                "label": ("STRING", {"default": ""}),
                "tags": ("STRING", {"default": ""}),
                "append_mode": (["replace", "append"], {"default": "replace"}),
            },
            "optional": {
                "images": ("IMAGE",),
                "video": ("VIDEO",),
                "video_path": ("STRING", {"default": ""}),
                "manifest": ("STORYBOARD_MANIFEST",),
            }
        }

    RETURN_TYPES = ("IMAGE", "STORYBOARD_MANIFEST")
    RETURN_NAMES = ("passthrough_image", "updated_manifest")
    FUNCTION = "send"
    CATEGORY = "Storyboard"
    OUTPUT_NODE = True

    def send(self, board_id, media_kind, target_mode, target, label, tags, append_mode, images=None, video=None, video_path="", manifest=None):
        if manifest and isinstance(manifest, dict) and "board_id" in manifest:
            board_id = manifest["board_id"]
        
        if not board_id:
            board_id = "default"
            
        raw_tags = [t.strip() for t in (tags or "").split(",") if t.strip()]
        board_data = store.get_board(board_id)
        selection = board_data.get("selection", [])
        items = board_data.get("items", [])
        
        def get_display_size(source_w, source_h, max_size=512):
            source_w = max(1, int(source_w))
            source_h = max(1, int(source_h))
            aspect = source_w / source_h
            if source_w >= source_h:
                w = max_size
                h = max(50, int(round(w / aspect)))
            else:
                h = max_size
                w = max(50, int(round(h * aspect)))
            return w, h, aspect

        media_entries = []

        if images is not None and media_kind in ("auto", "image"):
            for i in range(images.shape[0]):
                img_tensor = images[i].unsqueeze(0)
                img_h = int(images[i].shape[0])
                img_w = int(images[i].shape[1])
                filename = store.add_asset(board_id, img_tensor)
                media_entries.append({
                    "kind": "image",
                    "filename": filename,
                    "source_w": img_w,
                    "source_h": img_h,
                })

        resolved_video_path = (video_path or "").strip()
        if not resolved_video_path and video is not None:
            if isinstance(video, str):
                resolved_video_path = video
            elif isinstance(video, dict):
                resolved_video_path = video.get("path") or video.get("filename") or video.get("fullpath") or ""
            elif isinstance(video, (list, tuple)) and len(video) > 0:
                first = video[0]
                if isinstance(first, str):
                    resolved_video_path = first

        should_use_video = bool(resolved_video_path) and (media_kind == "video" or (media_kind == "auto" and not media_entries))
        if should_use_video:
            src = resolved_video_path.strip()
            if os.path.exists(src):
                video_filename = store.add_video_asset(board_id, src)
            else:
                candidate = os.path.join(store._get_assets_path(board_id), os.path.basename(src))
                if os.path.exists(candidate):
                    video_filename = os.path.basename(candidate)
                else:
                    raise ValueError(f"StoryboardSend: video source not found: {resolved_video_path}")
            media_entries = [{
                "kind": "video",
                "filename": video_filename,
                "source_w": 640,
                "source_h": 360,
            }]

        if media_kind == "video" and not resolved_video_path:
            raise ValueError("StoryboardSend: media_kind is 'video' but no video/video_path input was provided.")
        if media_kind == "image" and images is None:
            raise ValueError("StoryboardSend: media_kind is 'image' but no images input was provided.")
        if not media_entries:
            raise ValueError("StoryboardSend: no media received. Connect IMAGE or provide video_path.")

        print(f"StoryboardSend: Sending {len(media_entries)} {media_entries[0]['kind']} item(s) to board '{board_id}' (mode: {target_mode})")

        def apply_media_to_item(item, entry, overwrite_size=False):
            source_w = entry["source_w"]
            source_h = entry["source_h"]
            aspect = source_w / max(1, source_h)
            item["type"] = entry["kind"]
            item["label"] = label or item.get("label", ("Video" if entry["kind"] == "video" else "Updated"))
            item["tags"] = list(dict.fromkeys(item.get("tags", []) + raw_tags))
            item["image_width"] = source_w
            item["image_height"] = source_h
            item["aspect"] = aspect
            if overwrite_size:
                item["w"], item["h"], _ = get_display_size(source_w, source_h)
            else:
                current_w = max(50, int(item.get("w", 512)))
                item["h"] = max(50, int(round(current_w / aspect)))
            if entry["kind"] == "image":
                item["image_ref"] = entry["filename"]
                item.pop("video_ref", None)
            else:
                item["video_ref"] = entry["filename"]
                item.pop("image_ref", None)
                item.pop("crop", None)

        def create_new_at_end(entry, idx, base_label="Generated"):
            # Find a good spot for the new item
            last_item = items[-1] if items else {"x": 0, "y": 0, "w": 512, "h": 512}
            source_w = entry["source_w"]
            source_h = entry["source_h"]
            w, h, aspect = get_display_size(source_w, source_h)
            item = {
                "id": str(uuid.uuid4()),
                "type": entry["kind"],
                "x": last_item["x"] + last_item["w"] + 20 + (idx * 532),
                "y": last_item["y"],
                "w": w,
                "h": h,
                "label": label or ("Generated Video" if entry["kind"] == "video" else base_label),
                "tags": raw_tags,
                "image_width": source_w,
                "image_height": source_h,
                "aspect": aspect
            }
            if entry["kind"] == "image":
                item["image_ref"] = entry["filename"]
            else:
                item["video_ref"] = entry["filename"]
            return item

        if target_mode == "selected" and selection:
            # Map batch items to selected items
            for i in range(len(media_entries)):
                entry = media_entries[i]
                source_w = entry["source_w"]
                source_h = entry["source_h"]
                if i < len(selection):
                    # Replace existing item
                    item_id = selection[i]
                    for item in items:
                        if item["id"] == item_id:
                            apply_media_to_item(item, entry)
                            break
                else:
                    # Append new items nearby the first selection
                    first_item = next((it for it in items if it["id"] == selection[0]), None)
                    if first_item:
                        aspect = source_w / max(1, source_h)
                        new_item = {
                            "id": str(uuid.uuid4()),
                            "type": entry["kind"],
                            "x": first_item["x"] + first_item["w"] + 20 + ((i - len(selection)) * 10),
                            "y": first_item["y"] + ((i - len(selection)) * 10),
                            "w": first_item["w"],
                            "h": max(50, int(round(first_item["w"] / aspect))),
                            "label": label or "Batch variant",
                            "tags": raw_tags,
                            "image_width": source_w,
                            "image_height": source_h,
                            "aspect": aspect
                        }
                        if entry["kind"] == "image":
                            new_item["image_ref"] = entry["filename"]
                        else:
                            new_item["video_ref"] = entry["filename"]
                        items.append(new_item)

        elif target_mode == "placeholder_id" and target:
            # Find the placeholder with the given ID
            found = False
            for item in items:
                if item["id"] == target:
                    apply_media_to_item(item, media_entries[0])
                    # Handle extra media in batch
                    if len(media_entries) > 1 and append_mode == "append":
                        for i, entry in enumerate(media_entries[1:]):
                            source_w = entry["source_w"]
                            source_h = entry["source_h"]
                            aspect = source_w / max(1, source_h)
                            new_item = {
                                "id": str(uuid.uuid4()),
                                "type": entry["kind"],
                                "x": item["x"] + item["w"] + 20 + (i * 10),
                                "y": item["y"] + (i * 10),
                                "w": item["w"],
                                "h": max(50, int(round(item["w"] / aspect))),
                                "label": label or "Variant",
                                "tags": raw_tags,
                                "image_width": source_w,
                                "image_height": source_h,
                                "aspect": aspect
                            }
                            if entry["kind"] == "image":
                                new_item["image_ref"] = entry["filename"]
                            else:
                                new_item["video_ref"] = entry["filename"]
                            items.append(new_item)
                    found = True
                    break
            if not found:
                # If placeholder ID not found, treat as new items
                for i, entry in enumerate(media_entries):
                    items.append(create_new_at_end(entry, i))

        elif target_mode == "tag" and target:
            # Find items with the given tag
            tag_items = [it for it in items if target in it.get("tags", [])]
            if tag_items:
                for i, entry in enumerate(media_entries):
                    source_w = entry["source_w"]
                    source_h = entry["source_h"]
                    if i < len(tag_items):
                        apply_media_to_item(tag_items[i], entry)
                    elif append_mode == "append":
                        # Append extras near the last tagged item
                        last_tag_item = tag_items[-1]
                        aspect = source_w / max(1, source_h)
                        new_item = {
                            "id": str(uuid.uuid4()),
                            "type": entry["kind"],
                            "x": last_tag_item["x"] + last_tag_item["w"] + 20 + ((i - len(tag_items)) * 10),
                            "y": last_tag_item["y"] + ((i - len(tag_items)) * 10),
                            "w": last_tag_item["w"],
                            "h": max(50, int(round(last_tag_item["w"] / aspect))),
                            "label": label or "Tagged variant",
                            "tags": raw_tags or [target],
                            "image_width": source_w,
                            "image_height": source_h,
                            "aspect": aspect
                        }
                        if entry["kind"] == "image":
                            new_item["image_ref"] = entry["filename"]
                        else:
                            new_item["video_ref"] = entry["filename"]
                        items.append(new_item)
            else:
                # If no items with tag found, create new items with the tag
                for i, entry in enumerate(media_entries):
                    items.append(create_new_at_end(entry, i, base_label=f"Tag: {target}"))

        else:
            # target_mode == "new_item" or fallback
            for i, entry in enumerate(media_entries):
                items.append(create_new_at_end(entry, i))
        
        board_data["items"] = items
        store.save_board(board_data)
        passthrough = images if images is not None else torch.zeros((1, 64, 64, 3))
        return (passthrough, board_data)


class StoryboardRead:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "board_manifest": ("STORYBOARD_MANIFEST",),
                "read_mode": (["first_selected", "all_selected_batch", "by_tag", "ordered_by_board", "flattened_board"], {"default": "first_selected"}),
                "tag_filter": ("STRING", {"default": ""}),
            }
        }

    RETURN_TYPES = ("IMAGE", "JSON", "STRING")
    RETURN_NAMES = ("image", "metadata", "ordering")
    FUNCTION = "read"
    CATEGORY = "Storyboard"

    def read(self, board_manifest, read_mode, tag_filter):
        items = board_manifest.get("items", [])
        selection = board_manifest.get("selection", [])
        board_id = board_manifest.get("board_id")
        
        filtered_items = []
        if read_mode == "first_selected" and selection:
            filtered_items = [next((item for item in items if item["id"] == selection[0]), None)]
        elif read_mode == "all_selected_batch" and selection:
            filtered_items = [item for item in items if item["id"] in selection]
        elif read_mode == "by_tag":
            filtered_items = [item for item in items if tag_filter in item.get("tags", [])]
        else:
            # Default to all items
            filtered_items = items
            
        filtered_items = [item for item in filtered_items if item and item.get("image_ref")]
        
        if not filtered_items:
            dummy_image = torch.zeros((1, 64, 64, 3))
            return (dummy_image, {}, "")
            
        # Load images
        images = []
        for item in filtered_items:
            img_path = os.path.join(store._get_assets_path(board_id), item["image_ref"])
            if os.path.exists(img_path):
                img = Image.open(img_path).convert("RGB")
                img_np = np.array(img).astype(np.float32) / 255.0
                images.append(torch.from_numpy(img_np))
        
        if not images:
            dummy_image = torch.zeros((1, 64, 64, 3))
            return (dummy_image, {}, "")
            
        # Stack images into a batch
        # Ensure all images are same size for batching (simple approach: resize to first)
        target_size = images[0].shape[:2]
        resized_images = []
        for img in images:
            if img.shape[:2] != target_size:
                # Resize logic needed here if we want to batch differently sized images
                pass
            resized_images.append(img.unsqueeze(0))
            
        batch = torch.cat(resized_images, dim=0)
        metadata = {"items": filtered_items}
        ordering = ",".join([item["id"] for item in filtered_items])
        
        return (batch, metadata, ordering)

class StoryboardSlot:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "name": ("STRING", {"default": "Slot 1"}),
                "id": ("STRING", {"default": "slot_01"}),
                "tags": ("STRING", {"default": ""}),
            }
        }

    RETURN_TYPES = ("STORYBOARD_SLOT",)
    RETURN_NAMES = ("slot_data",)
    FUNCTION = "create_slot"
    CATEGORY = "Storyboard"

    def create_slot(self, name, id, tags):
        return ({"name": name, "id": id, "tags": tags},)

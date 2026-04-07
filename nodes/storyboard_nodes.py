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

    RETURN_TYPES = ("IMAGE", "IMAGE", "MASK", "JSON", "STORYBOARD_MANIFEST", "IMAGE", "CONDITIONING", "IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE")
    RETURN_NAMES = ("selected_image", "selected_batch", "selected_mask", "selected_meta", "board_manifest", "board_preview", "conditioning", "ref_1", "ref_2", "ref_3", "ref_4", "ref_5", "ref_6", "ref_7", "ref_8")
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
        items = board_data.get("items", [])
        for item in items:
            ref_idx = item.get("ref_id")
            if ref_idx and 1 <= ref_idx <= 8 and item.get("image_ref"):
                img_path = os.path.join(store._get_assets_path(board_id), item["image_ref"])
                if os.path.exists(img_path):
                    img = Image.open(img_path).convert("RGB")
                    img_np = np.array(img).astype(np.float32) / 255.0
                    refs[ref_idx - 1] = torch.from_numpy(img_np).unsqueeze(0)
        
        # Return currently selected images and manifest
        # (This is a simplified implementation for v1)
        dummy_image = torch.zeros((1, 64, 64, 3))
        dummy_mask = torch.zeros((1, 64, 64))
        dummy_json = {}
        
        return (dummy_image, dummy_image, dummy_mask, dummy_json, board_data, dummy_image, conditioning, *refs)

class StoryboardSend:
    @classmethod
    def IS_CHANGED(s, **kwargs):
        return float("nan")

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE",),
                "board_id": ("STRING", {"default": "default"}),
                "target_mode": (["selected", "placeholder_id", "tag", "new_item"], {"default": "selected"}),
                "target": ("STRING", {"default": ""}),
                "label": ("STRING", {"default": ""}),
                "tags": ("STRING", {"default": ""}),
                "append_mode": (["replace", "append"], {"default": "replace"}),
            },
            "optional": {
                "manifest": ("STORYBOARD_MANIFEST",),
            }
        }

    RETURN_TYPES = ("IMAGE", "STORYBOARD_MANIFEST")
    RETURN_NAMES = ("passthrough_image", "updated_manifest")
    FUNCTION = "send"
    CATEGORY = "Storyboard"
    OUTPUT_NODE = True

    def send(self, images, board_id, target_mode, target, label, tags, append_mode, manifest=None):
        if manifest and isinstance(manifest, dict) and "board_id" in manifest:
            board_id = manifest["board_id"]
        
        if not board_id:
            board_id = "default"
            
        print(f"StoryboardSend: Sending {images.shape[0]} images to board '{board_id}' (mode: {target_mode})")
        board_data = store.get_board(board_id)
        selection = board_data.get("selection", [])
        items = board_data.get("items", [])
        
        # Save images to assets
        filenames = []
        for i in range(images.shape[0]):
            img_tensor = images[i].unsqueeze(0)
            filename = store.add_asset(board_id, img_tensor)
            filenames.append(filename)
            
        def create_new_at_end(fname, idx, base_label="Generated"):
            # Find a good spot for the new item
            last_item = items[-1] if items else {"x": 0, "y": 0, "w": 512, "h": 512}
            return {
                "id": str(uuid.uuid4()),
                "type": "image",
                "x": last_item["x"] + last_item["w"] + 20 + (idx * 532),
                "y": last_item["y"],
                "w": 512,
                "h": 512,
                "label": label or base_label,
                "tags": tags.split(",") if tags else [],
                "image_ref": fname
            }

        if target_mode == "selected" and selection:
            # Map batch items to selected items
            for i in range(len(filenames)):
                filename = filenames[i]
                if i < len(selection):
                    # Replace existing item
                    item_id = selection[i]
                    for item in items:
                        if item["id"] == item_id:
                            item["image_ref"] = filename
                            item["type"] = "image"
                            item["label"] = label or item.get("label", "Updated")
                            item["tags"] = list(set(item.get("tags", []) + (tags.split(",") if tags else [])))
                            break
                else:
                    # Append new items nearby the first selection
                    first_item = next((it for it in items if it["id"] == selection[0]), None)
                    if first_item:
                        new_item = {
                            "id": str(uuid.uuid4()),
                            "type": "image",
                            "x": first_item["x"] + first_item["w"] + 20 + ((i - len(selection)) * 10),
                            "y": first_item["y"] + ((i - len(selection)) * 10),
                            "w": first_item["w"],
                            "h": first_item["h"],
                            "label": label or "Batch variant",
                            "tags": tags.split(",") if tags else [],
                            "image_ref": filename
                        }
                        items.append(new_item)

        elif target_mode == "placeholder_id" and target:
            # Find the placeholder with the given ID
            found = False
            for item in items:
                if item["id"] == target:
                    item["image_ref"] = filenames[0]
                    item["type"] = "image"
                    item["label"] = label or item.get("label", "")
                    item["tags"] = list(set(item.get("tags", []) + (tags.split(",") if tags else [])))
                    
                    # Handle extra images in batch
                    if len(filenames) > 1 and append_mode == "append":
                        for i, fname in enumerate(filenames[1:]):
                            new_item = {
                                "id": str(uuid.uuid4()),
                                "type": "image",
                                "x": item["x"] + item["w"] + 20 + (i * 10),
                                "y": item["y"] + (i * 10),
                                "w": item["w"],
                                "h": item["h"],
                                "label": label or "Variant",
                                "tags": tags.split(",") if tags else [],
                                "image_ref": fname
                            }
                            items.append(new_item)
                    found = True
                    break
            if not found:
                # If placeholder ID not found, treat as new items
                for i, filename in enumerate(filenames):
                    items.append(create_new_at_end(filename, i))

        elif target_mode == "tag" and target:
            # Find items with the given tag
            tag_items = [it for it in items if target in it.get("tags", [])]
            if tag_items:
                for i, filename in enumerate(filenames):
                    if i < len(tag_items):
                        it = tag_items[i]
                        it["image_ref"] = filename
                        it["type"] = "image"
                        it["label"] = label or it.get("label", "")
                    elif append_mode == "append":
                        # Append extras near the last tagged item
                        last_tag_item = tag_items[-1]
                        new_item = {
                            "id": str(uuid.uuid4()),
                            "type": "image",
                            "x": last_tag_item["x"] + last_tag_item["w"] + 20 + ((i - len(tag_items)) * 10),
                            "y": last_tag_item["y"] + ((i - len(tag_items)) * 10),
                            "w": last_tag_item["w"],
                            "h": last_tag_item["h"],
                            "label": label or "Tagged variant",
                            "tags": tags.split(",") if tags else [target],
                            "image_ref": filename
                        }
                        items.append(new_item)
            else:
                # If no items with tag found, create new items with the tag
                for i, filename in enumerate(filenames):
                    items.append(create_new_at_end(filename, i, base_label=f"Tag: {target}"))

        else:
            # target_mode == "new_item" or fallback
            for i, filename in enumerate(filenames):
                items.append(create_new_at_end(filename, i))
        
        board_data["items"] = items
        store.save_board(board_data)
        return (images, board_data)


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

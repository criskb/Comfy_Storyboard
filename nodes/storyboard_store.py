import os
import json
import uuid
from PIL import Image
import numpy as np
import torch

class StoryboardStore:
    def __init__(self, base_path):
        self.base_path = base_path
        if not os.path.exists(self.base_path):
            os.makedirs(self.base_path)

    def _get_board_path(self, board_id):
        return os.path.join(self.base_path, board_id)

    def _get_assets_path(self, board_id):
        return os.path.join(self._get_board_path(board_id), "assets")

    def get_board(self, board_id):
        board_path = self._get_board_path(board_id)
        json_path = os.path.join(board_path, "board.json")
        
        if not os.path.exists(json_path):
            return {
                "board_id": board_id,
                "version": 1,
                "viewport": {"x": 0, "y": 0, "zoom": 1},
                "items": [],
                "groups": [],
                "selection": [],
                "settings": {
                    "snap": True,
                    "grid": False,
                    "auto_receive_generated": True
                }
            }
        
        with open(json_path, 'r') as f:
            return json.load(f)

    def save_board(self, board_data, notify=True):
        board_id = board_data.get("board_id")
        if not board_id:
            board_id = str(uuid.uuid4())
            board_data["board_id"] = board_id

        board_path = self._get_board_path(board_id)
        if not os.path.exists(board_path):
            os.makedirs(board_path)

        json_path = os.path.join(board_path, "board.json")
        with open(json_path, 'w') as f:
            json.dump(board_data, f, indent=2)
        
        if notify:
            try:
                from server import PromptServer
                print(f"Storyboard: Notifying update for board '{board_id}'")
                # Using send_sync for better compatibility with ComfyUI's frontend API
                PromptServer.instance.send_sync("storyboard_update", {"board_id": board_id})
            except Exception as e:
                print(f"Storyboard: Failed to notify update: {e}")
                pass
        
        return board_id

    def add_asset(self, board_id, image, filename=None):
        assets_path = self._get_assets_path(board_id)
        if not os.path.exists(assets_path):
            os.makedirs(assets_path)

        if filename is None:
            filename = f"{uuid.uuid4()}.png"
        
        full_path = os.path.join(assets_path, filename)
        
        # Convert torch tensor to PIL Image if needed
        if isinstance(image, torch.Tensor):
            i = 255. * image.cpu().numpy().squeeze()
            img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
            img.save(full_path)
        elif isinstance(image, Image.Image):
            image.save(full_path)
        
        return filename

    def list_boards(self):
        if not os.path.exists(self.base_path):
            return []
        boards = []
        for d in os.listdir(self.base_path):
            if os.path.isdir(os.path.join(self.base_path, d)):
                boards.append(d)
        return boards

    def delete_board(self, board_id):
        import shutil
        board_path = self._get_board_path(board_id)
        if os.path.exists(board_path):
            shutil.rmtree(board_path)
            return True
        return False

    def flatten_frame(self, board_id, frame_id, scale=2.0):
        board_data = self.get_board(board_id)
        frame = next((i for i in board_data["items"] if i["id"] == frame_id), None)
        if not frame or frame["type"] != "frame":
            return None

        # Find items inside the frame
        contained_items = []
        for item in board_data["items"]:
            if item["id"] == frame_id: continue
            if (item["x"] >= frame["x"] and item["y"] >= frame["y"] and
                (item["x"] + item["w"]) <= (frame["x"] + frame["w"]) and
                (item["y"] + item["h"]) <= (frame["y"] + frame["h"])):
                contained_items.append(item)

        # Create base image with higher resolution
        from PIL import Image, ImageDraw, ImageFont
        canvas_w = int(frame["w"] * scale)
        canvas_h = int(frame["h"] * scale)
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)

        # Draw frame background
        bg_color = frame.get("color", "#4CAF50")
        if bg_color.startswith("#"):
            hex_color = bg_color.lstrip('#')
            rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            draw.rectangle([0, 0, canvas_w, canvas_h], fill=(*rgb, 26)) # 10% opacity
            draw.rectangle([0, 0, canvas_w, canvas_h], outline=(*rgb, 255), width=int(3 * scale))

        # Draw items in order they appear in board data
        assets_path = self._get_assets_path(board_id)
        for item in contained_items:
            rel_x = int((item["x"] - frame["x"]) * scale)
            rel_y = int((item["y"] - frame["y"]) * scale)
            rel_w = int(item["w"] * scale)
            rel_h = int(item["h"] * scale)

            if item["type"] == "image" and item.get("image_ref"):
                img_path = os.path.join(assets_path, item["image_ref"])
                if os.path.exists(img_path):
                    try:
                        img = Image.open(img_path).convert("RGBA")
                        
                        # Apply crop if present
                        crop = item.get("crop")
                        if crop:
                            w, h = img.size
                            left = int(crop["x"] * w)
                            top = int(crop["y"] * h)
                            right = int((crop["x"] + crop["w"]) * w)
                            bottom = int((crop["y"] + crop["h"]) * h)
                            left = max(0, min(w - 1, left))
                            top = max(0, min(h - 1, top))
                            right = max(left + 1, min(w, right))
                            bottom = max(top + 1, min(h, bottom))
                            img = img.crop((left, top, right, bottom))

                        # Use LANCZOS for high quality resizing
                        img = img.resize((rel_w, rel_h), Image.Resampling.LANCZOS)
                        
                        # Apply rounded corners
                        mask = Image.new("L", (rel_w, rel_h), 0)
                        mask_draw = ImageDraw.Draw(mask)
                        mask_draw.rounded_rectangle([0, 0, rel_w, rel_h], radius=int(12 * scale), fill=255)
                        
                        temp_canvas = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
                        temp_canvas.paste(img, (0, 0), mask)
                        canvas.alpha_composite(temp_canvas, (rel_x, rel_y))
                    except Exception as e:
                        print(f"Error drawing image in flatten: {e}")
            elif item["type"] == "note":
                color = item.get("color", "#ffeb3b")
                if color.startswith("#"):
                    hex_c = color.lstrip('#')
                    rgb = tuple(int(hex_c[i:i+2], 16) for i in (0, 2, 4))
                    
                    mask = Image.new("L", (rel_w, rel_h), 0)
                    mask_draw = ImageDraw.Draw(mask)
                    mask_draw.rounded_rectangle([0, 0, rel_w, rel_h], radius=int(12 * scale), fill=255)
                    
                    note_img = Image.new("RGBA", (rel_w, rel_h), (*rgb, 255))
                    canvas.paste(note_img, (rel_x, rel_y), mask)
                    
                    # Add text to note
                    content = item.get("content", "")
                    if content:
                        note_draw = ImageDraw.Draw(canvas)
                        text_len = len(content)
                        area = rel_w * rel_h
                        font_size = int(np.sqrt(area / (text_len or 1)) * 0.8)
                        font_size = max(int(12 * scale), min(font_size, int(rel_h * 0.5)))
                        
                        try:
                            font = ImageFont.load_default()
                        except:
                            font = ImageFont.load_default()
                            
                        note_draw.text((rel_x + rel_w/2, rel_y + rel_h/2), content, fill=(0,0,0,255), anchor="mm")

            elif item["type"] == "slot":
                mask = Image.new("L", (rel_w, rel_h), 0)
                mask_draw = ImageDraw.Draw(mask)
                mask_draw.rounded_rectangle([0, 0, rel_w, rel_h], radius=int(12 * scale), fill=255)
                
                slot_img = Image.new("RGBA", (rel_w, rel_h), (26, 26, 26, 255))
                canvas.paste(slot_img, (rel_x, rel_y), mask)
                
                # Add label
                slot_draw = ImageDraw.Draw(canvas)
                slot_draw.text((rel_x + rel_w/2, rel_y + rel_h/2), item.get("label", "Slot"), fill=(255,255,255,255), anchor="mm")

        # Save result
        filename = f"flattened_{uuid.uuid4()}.png"
        canvas.save(os.path.join(assets_path, filename))
        return filename

    def get_frame_palette(self, board_id, frame_id, num_colors=8):
        board_data = self.get_board(board_id)
        frame = next((i for i in board_data["items"] if i["id"] == frame_id), None)
        if not frame or frame["type"] != "frame":
            return []

        # Find images inside the frame
        image_items = []
        for item in board_data["items"]:
            if item["type"] == "image" and item.get("image_ref"):
                if (item["x"] >= frame["x"] and item["y"] >= frame["y"] and
                    (item["x"] + item["w"]) <= (frame["x" ] + frame["w"]) and
                    (item["y"] + item["h"]) <= (frame["y"] + frame["h"])):
                    image_items.append(item)

        if not image_items:
            return []

        from PIL import Image
        combined_img = Image.new("RGB", (100 * len(image_items), 100))
        
        assets_path = self._get_assets_path(board_id)
        valid_images = 0
        for i, item in enumerate(image_items):
            img_path = os.path.join(assets_path, item["image_ref"])
            if os.path.exists(img_path):
                try:
                    img = Image.open(img_path).convert("RGB")
                    crop = item.get("crop")
                    if crop:
                        w, h = img.size
                        left = int(crop["x"] * w)
                        top = int(crop["y"] * h)
                        right = int((crop["x"] + crop["w"]) * w)
                        bottom = int((crop["y"] + crop["h"]) * h)
                        img = img.crop((left, top, right, bottom))
                    
                    img = img.resize((100, 100), Image.Resampling.NEAREST)
                    combined_img.paste(img, (valid_images * 100, 0))
                    valid_images += 1
                except:
                    continue

        if valid_images == 0:
            return []

        combined_img = combined_img.crop((0, 0, valid_images * 100, 100))
        
        # Simpler quantization for robustness
        combined_img = combined_img.convert("P", palette=Image.Palette.ADAPTIVE, colors=num_colors).convert("RGB")
        colors = combined_img.getcolors(num_colors * 10)
        
        if not colors: return []
        colors.sort(key=lambda x: x[0], reverse=True)
        
        hex_colors = []
        for count, rgb in colors[:num_colors]:
            hex_colors.append('#{:02x}{:02x}{:02x}'.format(rgb[0], rgb[1], rgb[2]))
            
        return hex_colors

    def rename_board(self, old_id, new_id):
        old_path = self._get_board_path(old_id)
        new_path = self._get_board_path(new_id)
        if os.path.exists(old_path) and not os.path.exists(new_path):
            os.rename(old_path, new_path)
            # Update board_id in the json
            board_data = self.get_board(new_id)
            board_data["board_id"] = new_id
            self.save_board(board_data, notify=True)
            return True
        return False

# Global instance
STORYBOARD_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "storyboards")
store = StoryboardStore(STORYBOARD_DATA_PATH)

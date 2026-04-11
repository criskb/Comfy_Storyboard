import os
import json
import uuid
import shutil
import math
import textwrap
from PIL import Image, ImageDraw
import numpy as np
import torch

from .storyboard_media_utils import apply_normalized_crop

DEFAULT_FRAME_COLOR = "#ffffff"
DEFAULT_FRAME_RGB = (255, 255, 255)
DEFAULT_BOARD_SETTINGS = {
    "snap": True,
    "grid": False,
    "grid_spacing": 32,
    "auto_receive_generated": True,
    "show_prompt": True,
    "show_minimap": True,
    "show_inspector": True,
}

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
                "settings": dict(DEFAULT_BOARD_SETTINGS)
            }
        
        with open(json_path, 'r') as f:
            board = json.load(f)
            board["settings"] = {
                **DEFAULT_BOARD_SETTINGS,
                **(board.get("settings") or {}),
            }
            return board

    def save_board(self, board_data, notify=True):
        board_id = board_data.get("board_id")
        if not board_id:
            board_id = str(uuid.uuid4())
            board_data["board_id"] = board_id

        board_data["settings"] = {
            **DEFAULT_BOARD_SETTINGS,
            **(board_data.get("settings") or {}),
        }

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

    def add_video_asset(self, board_id, source_path, filename=None):
        assets_path = self._get_assets_path(board_id)
        if not os.path.exists(assets_path):
            os.makedirs(assets_path)

        ext = os.path.splitext(source_path)[1].lower() or ".mp4"
        if filename is None:
            filename = f"{uuid.uuid4()}{ext}"
        full_path = os.path.join(assets_path, filename)
        shutil.copy2(source_path, full_path)
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

    def _sorted_render_items(self, items):
        order = {id(item): index for index, item in enumerate(items)}
        return sorted(items, key=lambda item: (item.get("type") != "frame", order.get(id(item), 0)))

    def _hex_to_rgb(self, color, fallback=DEFAULT_FRAME_RGB):
        if not isinstance(color, str) or not color.startswith("#"):
            return fallback

        value = color.lstrip("#")
        if len(value) == 3:
            value = "".join(channel * 2 for channel in value)
        if len(value) != 6:
            return fallback

        try:
            return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))
        except ValueError:
            return fallback

    def _text_color_for_bg(self, rgb):
        luminance = (0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2])
        if luminance > 150:
            return (20, 20, 24, 255)
        return (245, 245, 245, 255)

    def _rounded_mask(self, width, height, radius):
        width = max(1, int(width))
        height = max(1, int(height))
        radius = max(1, int(radius))
        mask = Image.new("L", (width, height), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([0, 0, width, height], radius=radius, fill=255)
        return mask

    def _item_rotation(self, item):
        try:
            rotation = float(item.get("rotation", 0) or 0)
        except (TypeError, ValueError):
            return 0.0
        return max(-25.0, min(25.0, rotation))

    def _media_presentation(self, item):
        value = str(item.get("media_presentation", "") or "").strip().lower()
        if value in {"clean", "panel", "polaroid"}:
            return value
        return "clean"

    def _frame_presentation(self, item):
        value = str(item.get("frame_presentation", "") or "").strip().lower()
        if value in {"outline", "board", "spotlight"}:
            return value
        return "outline"

    def _media_caption_text(self, item, presentation=None):
        resolved_presentation = presentation or self._media_presentation(item)
        label = str(item.get("label", "") or "").strip()
        tags = [str(tag).strip() for tag in item.get("tags", []) if str(tag).strip()]

        if label:
            text = label
        elif resolved_presentation == "polaroid" and tags:
            text = f"#{tags[0]}"
        elif tags:
            text = "  ".join(f"#{tag}" for tag in tags[:3])
        else:
            text = ""

        if len(text) > 42:
            text = f"{text[:39]}..."
        return text

    def _media_layout(self, rel_w, rel_h, presentation, scale=1.0):
        if presentation == "polaroid":
            pad = max(8, int(round(12 * scale)))
            footer_h = max(28, int(round(42 * scale)))
            return {
                "media_box": (pad, pad, max(pad + 1, rel_w - pad), max(pad + 1, rel_h - footer_h)),
                "caption_box": (pad, max(pad + 1, rel_h - footer_h), max(pad + 1, rel_w - pad), max(pad + 1, rel_h - pad)),
                "card_radius": max(8, int(round(12 * scale))),
                "media_radius": max(6, int(round(10 * scale))),
            }

        if presentation == "panel":
            margin = max(8, int(round(10 * scale)))
            caption_h = max(26, int(round(min(rel_h * 0.22, 48 * scale))))
            return {
                "media_box": (0, 0, rel_w, rel_h),
                "caption_box": (margin, max(margin, rel_h - caption_h - margin), max(margin + 1, rel_w - margin), max(margin + 1, rel_h - margin)),
                "card_radius": max(8, int(round(12 * scale))),
                "media_radius": max(6, int(round(10 * scale))),
            }

        return {
            "media_box": (0, 0, rel_w, rel_h),
            "caption_box": None,
            "card_radius": max(8, int(round(12 * scale))),
            "media_radius": max(6, int(round(10 * scale))),
        }

    def _draw_media_caption(self, draw, caption_box, text, presentation, scale=1.0):
        if not caption_box or not text:
            return

        x0, y0, x1, y1 = caption_box
        if presentation == "polaroid":
            draw.text(
                ((x0 + x1) / 2.0, (y0 + y1) / 2.0),
                text,
                fill=(31, 41, 55, 255),
                anchor="mm",
            )
            return

        if presentation == "panel":
            radius = max(8, int(round(12 * scale)))
            draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=(15, 23, 42, 212))
            draw.text(
                (x0 + max(10, int(round(12 * scale))), (y0 + y1) / 2.0),
                text,
                fill=(248, 250, 252, 255),
                anchor="lm",
            )

    def _frame_header_meta(self, item):
        scene_code = str(item.get("scene_code", "") or "").strip()
        title = str(item.get("label", "") or "").strip()
        subtitle = str(item.get("scene_subtitle", "") or "").strip()
        if len(scene_code) > 12:
            scene_code = scene_code[:12]
        if len(title) > 42:
            title = f"{title[:39]}..."
        if len(subtitle) > 68:
            subtitle = f"{subtitle[:65]}..."
        return scene_code, title, subtitle

    def _item_render_bounds(self, item):
        x = float(item.get("x", 0))
        y = float(item.get("y", 0))
        width = max(1.0, float(item.get("w", 1)))
        height = max(1.0, float(item.get("h", 1)))
        rotation = abs(self._item_rotation(item))
        if rotation < 0.01:
            return (x, y, x + width, y + height)

        radians = math.radians(rotation)
        rotated_w = abs(width * math.cos(radians)) + abs(height * math.sin(radians))
        rotated_h = abs(width * math.sin(radians)) + abs(height * math.cos(radians))
        center_x = x + (width / 2.0)
        center_y = y + (height / 2.0)
        return (
            center_x - (rotated_w / 2.0),
            center_y - (rotated_h / 2.0),
            center_x + (rotated_w / 2.0),
            center_y + (rotated_h / 2.0),
        )

    def _composite_item_tile(self, canvas, tile, rel_x, rel_y, rel_w, rel_h, rotation=0.0):
        if abs(rotation) > 0.01:
            tile = tile.rotate(-rotation, resample=Image.Resampling.BICUBIC, expand=True)

        center_x = rel_x + (rel_w / 2.0)
        center_y = rel_y + (rel_h / 2.0)
        paste_x = int(round(center_x - (tile.width / 2.0)))
        paste_y = int(round(center_y - (tile.height / 2.0)))
        canvas.alpha_composite(tile, (paste_x, paste_y))

    def _draw_item_to_canvas(self, canvas, board_id, item, rel_x, rel_y, rel_w, rel_h, scale=1.0):
        rel_w = max(1, int(rel_w))
        rel_h = max(1, int(rel_h))
        rel_x = int(rel_x)
        rel_y = int(rel_y)
        corner_radius = max(4, int(12 * scale))
        item_type = item.get("type")
        assets_path = self._get_assets_path(board_id)
        rotation = self._item_rotation(item)

        if item_type == "image" and item.get("image_ref"):
            img_path = os.path.join(assets_path, item["image_ref"])
            if not os.path.exists(img_path):
                return
            try:
                img = Image.open(img_path).convert("RGBA")
                img = apply_normalized_crop(img, item.get("crop"))
                presentation = self._media_presentation(item)
                layout = self._media_layout(rel_w, rel_h, presentation, scale=scale)
                media_x0, media_y0, media_x1, media_y1 = layout["media_box"]
                media_w = max(1, media_x1 - media_x0)
                media_h = max(1, media_y1 - media_y0)
                img = img.resize((media_w, media_h), Image.Resampling.LANCZOS)
                mask = self._rounded_mask(media_w, media_h, layout["media_radius"])
                item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
                draw = ImageDraw.Draw(item_tile)
                if presentation == "polaroid":
                    draw.rounded_rectangle(
                        [0, 0, rel_w - 1, rel_h - 1],
                        radius=layout["card_radius"],
                        fill=(247, 241, 232, 255),
                        outline=(232, 224, 214, 255),
                    )
                item_tile.paste(img, (media_x0, media_y0), mask)
                self._draw_media_caption(
                    draw,
                    layout.get("caption_box"),
                    self._media_caption_text(item, presentation),
                    presentation,
                    scale=scale,
                )
                self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            except Exception as exc:
                print(f"Storyboard: failed to render image item '{item.get('id', 'unknown')}': {exc}")
            return

        if item_type == "video" and item.get("video_ref"):
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            presentation = self._media_presentation(item)
            layout = self._media_layout(rel_w, rel_h, presentation, scale=scale)
            media_x0, media_y0, media_x1, media_y1 = layout["media_box"]
            media_w = max(1, media_x1 - media_x0)
            media_h = max(1, media_y1 - media_y0)
            if presentation == "polaroid":
                draw.rounded_rectangle(
                    [0, 0, rel_w - 1, rel_h - 1],
                    radius=layout["card_radius"],
                    fill=(247, 241, 232, 255),
                    outline=(232, 224, 214, 255),
                )
            mask = self._rounded_mask(media_w, media_h, layout["media_radius"])
            video_img = Image.new("RGBA", (media_w, media_h), (36, 36, 40, 255))
            item_tile.paste(video_img, (media_x0, media_y0), mask)
            draw = ImageDraw.Draw(item_tile)
            icon_size = max(10, int(min(media_w, media_h) * 0.22))
            center_x = media_x0 + (media_w // 2)
            center_y = media_y0 + (media_h // 2)
            triangle = [
                (center_x - icon_size // 2, center_y - icon_size),
                (center_x - icon_size // 2, center_y + icon_size),
                (center_x + icon_size, center_y),
            ]
            draw.polygon(triangle, fill=(255, 255, 255, 220))
            caption_text = self._media_caption_text(item, presentation)
            if presentation == "clean":
                label = caption_text or (item.get("label") or "Video").strip()
                if label:
                    draw.text(
                        (center_x, media_y0 + media_h - max(14, int(16 * scale))),
                        label,
                        fill=(235, 235, 235, 255),
                        anchor="ms",
                    )
            else:
                self._draw_media_caption(
                    draw,
                    layout.get("caption_box"),
                    caption_text,
                    presentation,
                    scale=scale,
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "note":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            rgb = self._hex_to_rgb(item.get("color", "#ffeb3b"), fallback=(255, 235, 59))
            mask = self._rounded_mask(rel_w, rel_h, corner_radius)
            note_img = Image.new("RGBA", (rel_w, rel_h), (*rgb, 255))
            item_tile.paste(note_img, (0, 0), mask)
            content = (item.get("content") or "").strip()
            if content:
                draw = ImageDraw.Draw(item_tile)
                max_chars = max(10, min(42, rel_w // max(8, int(8 * scale))))
                wrapped = textwrap.fill(content, width=max_chars)
                draw.multiline_text(
                    (max(12, int(14 * scale)), max(12, int(14 * scale))),
                    wrapped,
                    fill=self._text_color_for_bg(rgb),
                    spacing=max(4, int(6 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "slot":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            mask = self._rounded_mask(rel_w, rel_h, corner_radius)
            slot_img = Image.new("RGBA", (rel_w, rel_h), (26, 26, 26, 255))
            item_tile.paste(slot_img, (0, 0), mask)
            draw = ImageDraw.Draw(item_tile)
            draw.text(
                (rel_w / 2, rel_h / 2),
                item.get("label", "Slot"),
                fill=(255, 255, 255, 255),
                anchor="mm",
            )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "mood_tag":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            mask = self._rounded_mask(rel_w, rel_h, corner_radius)
            mood_img = Image.new("RGBA", (rel_w, rel_h), (15, 23, 42, 240))
            item_tile.paste(mood_img, (0, 0), mask)
            stripe_w = max(4, int(6 * scale))
            draw.rectangle([0, 0, stripe_w, rel_h], fill=(*accent_rgb, 255))
            pad_x = stripe_w + max(12, int(16 * scale))
            pad_y = max(12, int(16 * scale))
            draw.text(
                (pad_x, pad_y),
                "MOOD",
                fill=(*accent_rgb, 255),
            )
            title = str(item.get("label", "") or "").strip() or "Mood Tag"
            if len(title) > 32:
                title = f"{title[:29]}..."
            draw.text(
                (pad_x, pad_y + max(16, int(18 * scale))),
                title,
                fill=(248, 250, 252, 255),
            )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(14, min(42, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad_x, pad_y + max(34, int(38 * scale))),
                    wrapped,
                    fill=(226, 232, 240, 220),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "shot_card":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(250, 246, 240, 252),
                outline=(219, 224, 230, 255),
                width=max(1, int(2 * scale)),
            )
            pad = max(12, int(16 * scale))
            badge_h = max(18, int(24 * scale))
            shot_type = str(item.get("shot_type", "") or "").strip().upper() or "WIDE"
            badge_w = min(rel_w - (pad * 2), max(56, int(len(shot_type) * 8 * scale) + int(22 * scale)))
            badge_box = [pad, pad, pad + badge_w, pad + badge_h]
            draw.rounded_rectangle(
                badge_box,
                radius=max(8, int(12 * scale)),
                fill=(*accent_rgb, 255),
            )
            draw.text(
                ((badge_box[0] + badge_box[2]) / 2.0, (badge_box[1] + badge_box[3]) / 2.0),
                shot_type,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text(
                (rel_w - pad, pad + (badge_h / 2.0)),
                "Shot",
                fill=(100, 116, 139, 255),
                anchor="rm",
            )
            title = str(item.get("label", "") or "").strip() or "Shot Card"
            if len(title) > 34:
                title = f"{title[:31]}..."
            title_y = badge_box[3] + max(12, int(14 * scale))
            draw.text(
                (pad, title_y),
                title,
                fill=(15, 23, 42, 255),
            )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(16, min(42, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad, title_y + max(18, int(24 * scale))),
                    wrapped,
                    fill=(71, 85, 105, 255),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "story_beat":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(248, 250, 252, 252),
                outline=(217, 226, 236, 255),
                width=max(1, int(2 * scale)),
            )
            band_h = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, band_h + max(4, int(6 * scale))],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            stage = str(item.get("beat_stage", "") or "").strip().upper() or "SETUP"
            stage_h = max(18, int(24 * scale))
            stage_w = min(rel_w - (pad * 2), max(74, int(len(stage) * 7 * scale) + int(22 * scale)))
            stage_box = [pad, band_h + max(8, int(10 * scale)), pad + stage_w, band_h + max(8, int(10 * scale)) + stage_h]
            draw.rounded_rectangle(stage_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((stage_box[0] + stage_box[2]) / 2.0, (stage_box[1] + stage_box[3]) / 2.0),
                stage,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            title = str(item.get("label", "") or "").strip() or "Story Beat"
            if len(title) > 34:
                title = f"{title[:31]}..."
            title_y = stage_box[3] + max(12, int(14 * scale))
            draw.text((pad, title_y), title, fill=(15, 23, 42, 255))
            copy = str(item.get("content", "") or "").strip()
            if copy:
                max_chars = max(16, min(44, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(copy, width=max_chars)
                draw.multiline_text(
                    (pad, title_y + max(18, int(24 * scale))),
                    wrapped,
                    fill=(71, 85, 105, 255),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "swatch_strip":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(248, 250, 252, 252),
                outline=(217, 226, 236, 255),
                width=max(1, int(2 * scale)),
            )
            pad = max(12, int(16 * scale))
            title = str(item.get("label", "") or "").strip() or "Swatch Strip"
            if len(title) > 28:
                title = f"{title[:25]}..."
            draw.text((pad, pad), title, fill=(15, 23, 42, 255))
            raw_swatches = item.get("swatches") or ["#f4efe6", "#cab9a5", "#7a8795", "#1f2937"]
            swatches = []
            for value in raw_swatches:
                rgb = self._hex_to_rgb(value, fallback=None)
                if rgb:
                    swatches.append(rgb)
            if not swatches:
                swatches = [(244, 239, 230), (202, 185, 165), (122, 135, 149), (31, 41, 55)]
            gap = max(6, int(8 * scale))
            swatch_y = pad + max(18, int(22 * scale))
            swatch_h = max(34, int(48 * scale))
            swatch_w = max(22, int((rel_w - (pad * 2) - (gap * (len(swatches) - 1))) / max(1, len(swatches))))
            cursor_x = pad
            for rgb in swatches[:6]:
                draw.rounded_rectangle(
                    [cursor_x, swatch_y, cursor_x + swatch_w, swatch_y + swatch_h],
                    radius=max(6, int(10 * scale)),
                    fill=(*rgb, 255),
                    outline=(15, 23, 42, 20),
                )
                cursor_x += swatch_w + gap
            note = str(item.get("content", "") or "").strip()
            if note:
                if len(note) > 54:
                    note = f"{note[:51]}..."
                draw.text(
                    (pad, swatch_y + swatch_h + max(10, int(12 * scale))),
                    note,
                    fill=(71, 85, 105, 255),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "scene_divider":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            center_y = max(14, int(rel_h * 0.34))
            draw.line(
                [(0, center_y), (rel_w, center_y)],
                fill=(255, 255, 255, 56),
                width=max(1, int(2 * scale)),
            )
            label = str(item.get("label", "") or "").strip().upper() or "SCENE DIVIDER"
            if len(label) > 26:
                label = f"{label[:23]}..."
            badge_h = max(22, int(28 * scale))
            badge_w = min(rel_w - max(20, int(24 * scale)), max(120, int(len(label) * 8 * scale) + int(34 * scale)))
            badge_x0 = int((rel_w - badge_w) / 2)
            badge_box = [badge_x0, max(6, int(8 * scale)), badge_x0 + badge_w, max(6, int(8 * scale)) + badge_h]
            draw.rounded_rectangle(
                badge_box,
                radius=max(10, int(14 * scale)),
                fill=(*accent_rgb, 255),
            )
            draw.text(
                ((badge_box[0] + badge_box[2]) / 2.0, (badge_box[1] + badge_box[3]) / 2.0),
                label,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            subtitle = str(item.get("content", "") or "").strip()
            if subtitle:
                if len(subtitle) > 42:
                    subtitle = f"{subtitle[:39]}..."
                draw.text(
                    (rel_w / 2.0, badge_box[3] + max(10, int(12 * scale))),
                    subtitle,
                    fill=(226, 232, 240, 192),
                    anchor="ma",
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "character_card":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(10, 15, 24, 246),
                outline=(36, 45, 60, 255),
                width=max(1, int(2 * scale)),
            )
            band_h = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, band_h + max(4, int(6 * scale))],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            role = str(item.get("character_role", "") or "").strip().upper() or "LEAD"
            role_h = max(18, int(24 * scale))
            role_w = min(rel_w - (pad * 2), max(66, int(len(role) * 7 * scale) + int(22 * scale)))
            role_box = [rel_w - pad - role_w, band_h + max(8, int(10 * scale)), rel_w - pad, band_h + max(8, int(10 * scale)) + role_h]
            draw.rounded_rectangle(role_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((role_box[0] + role_box[2]) / 2.0, (role_box[1] + role_box[3]) / 2.0),
                role,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text(
                (pad, band_h + max(14, int(18 * scale))),
                "CHARACTER",
                fill=(203, 213, 225, 165),
            )
            name = str(item.get("label", "") or "").strip() or "Character Card"
            if len(name) > 26:
                name = f"{name[:23]}..."
            name_y = role_box[3] + max(12, int(14 * scale))
            draw.text((pad, name_y), name, fill=(248, 250, 252, 255))
            look = str(item.get("look", "") or "").strip()
            if look:
                max_chars = max(16, min(42, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(look, width=max_chars)
                draw.multiline_text(
                    (pad, name_y + max(18, int(24 * scale))),
                    wrapped,
                    fill=(226, 232, 240, 212),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(18, min(44, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad, rel_h - max(46, int(52 * scale))),
                    wrapped,
                    fill=(203, 213, 225, 176),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "location_card":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(250, 246, 240, 252),
                outline=(219, 224, 230, 255),
                width=max(1, int(2 * scale)),
            )
            stripe_w = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, stripe_w + max(3, int(4 * scale)), rel_h - 1],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            time_of_day = str(item.get("time_of_day", "") or "").strip().upper() or "NIGHT"
            time_h = max(18, int(24 * scale))
            time_w = min(rel_w - (pad * 2), max(72, int(len(time_of_day) * 7 * scale) + int(22 * scale)))
            time_box = [pad + stripe_w, pad, pad + stripe_w + time_w, pad + time_h]
            draw.rounded_rectangle(time_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((time_box[0] + time_box[2]) / 2.0, (time_box[1] + time_box[3]) / 2.0),
                time_of_day,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text(
                (rel_w - pad, pad + (time_h / 2.0)),
                "Location",
                fill=(100, 116, 139, 255),
                anchor="rm",
            )
            title = str(item.get("label", "") or "").strip() or "Location Card"
            if len(title) > 28:
                title = f"{title[:25]}..."
            title_y = time_box[3] + max(12, int(14 * scale))
            draw.text((pad + stripe_w, title_y), title, fill=(15, 23, 42, 255))
            atmosphere = str(item.get("content", "") or "").strip()
            if atmosphere:
                max_chars = max(16, min(40, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(atmosphere, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, title_y + max(18, int(24 * scale))),
                    wrapped,
                    fill=(71, 85, 105, 255),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "prompt_card":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(17, 24, 39, 248),
                outline=(39, 48, 64, 255),
                width=max(1, int(2 * scale)),
            )
            band_h = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, band_h + max(4, int(6 * scale))],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            draw.text((pad, band_h + max(14, int(18 * scale))), "PROMPT", fill=(248, 250, 252, 180))
            title = str(item.get("label", "") or "").strip() or "Prompt Card"
            if len(title) > 28:
                title = f"{title[:25]}..."
            title_y = band_h + max(30, int(36 * scale))
            draw.text((pad, title_y), title, fill=(248, 250, 252, 255))
            prompt_text = str(item.get("prompt_text", "") or "").strip()
            if prompt_text:
                max_chars = max(18, min(46, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(prompt_text, width=max_chars)
                draw.multiline_text(
                    (pad, title_y + max(18, int(24 * scale))),
                    wrapped,
                    fill=(226, 232, 240, 220),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(18, min(46, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad, rel_h - max(34, int(40 * scale))),
                    wrapped,
                    fill=(203, 213, 225, 176),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "checklist_card":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(248, 250, 252, 252),
                outline=(217, 226, 236, 255),
                width=max(1, int(2 * scale)),
            )
            stripe_w = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, stripe_w + max(3, int(4 * scale)), rel_h - 1],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            items = item.get("checklist_items", []) or []
            done_count = sum(1 for entry in items if entry.get("done"))
            chip_text = f"{done_count}/{len(items) or 0}"
            chip_w = max(48, int(len(chip_text) * 8 * scale) + int(20 * scale))
            chip_h = max(18, int(24 * scale))
            chip_box = [rel_w - pad - chip_w, pad, rel_w - pad, pad + chip_h]
            draw.rounded_rectangle(chip_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((chip_box[0] + chip_box[2]) / 2.0, (chip_box[1] + chip_box[3]) / 2.0),
                chip_text,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            title = str(item.get("label", "") or "").strip() or "Checklist Card"
            if len(title) > 26:
                title = f"{title[:23]}..."
            title_y = pad + max(2, int(2 * scale))
            draw.text((pad + stripe_w, title_y), title, fill=(15, 23, 42, 255))
            row_y = chip_box[3] + max(12, int(14 * scale))
            for index, entry in enumerate(items[:5]):
                check_size = max(10, int(12 * scale))
                box_y = row_y + index * max(20, int(24 * scale))
                draw.rounded_rectangle(
                    [pad + stripe_w, box_y, pad + stripe_w + check_size, box_y + check_size],
                    radius=max(2, int(3 * scale)),
                    outline=(*accent_rgb, 255),
                    width=max(1, int(2 * scale)),
                )
                if entry.get("done"):
                    draw.line(
                        [
                            (pad + stripe_w + max(2, int(3 * scale)), box_y + max(6, int(7 * scale))),
                            (pad + stripe_w + max(5, int(6 * scale)), box_y + max(9, int(10 * scale))),
                            (pad + stripe_w + max(10, int(11 * scale)), box_y + max(2, int(3 * scale))),
                        ],
                        fill=(*accent_rgb, 255),
                        width=max(1, int(2 * scale)),
                    )
                label = str(entry.get("label", "") or "").strip()
                if len(label) > 28:
                    label = f"{label[:25]}..."
                draw.text(
                    (pad + stripe_w + max(18, int(22 * scale)), box_y + check_size / 2.0),
                    label,
                    fill=(71, 85, 105, 255),
                    anchor="lm",
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "reference_basket":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(15, 23, 42, 246),
                outline=(39, 48, 64, 255),
                width=max(1, int(2 * scale)),
            )
            band_h = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, band_h + max(4, int(6 * scale))],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            linked_ids = item.get("linked_ids", []) or []
            chip_text = str(len(linked_ids))
            chip_w = max(34, int(len(chip_text) * 8 * scale) + int(18 * scale))
            chip_h = max(18, int(24 * scale))
            chip_box = [rel_w - pad - chip_w, band_h + max(8, int(10 * scale)), rel_w - pad, band_h + max(8, int(10 * scale)) + chip_h]
            draw.rounded_rectangle(chip_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((chip_box[0] + chip_box[2]) / 2.0, (chip_box[1] + chip_box[3]) / 2.0),
                chip_text,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            title = str(item.get("label", "") or "").strip() or "Reference Basket"
            if len(title) > 26:
                title = f"{title[:23]}..."
            title_y = chip_box[3] + max(10, int(12 * scale))
            draw.text((pad, title_y), title, fill=(248, 250, 252, 255))
            preview = ", ".join(linked_ids[:4]) if linked_ids else "No linked items yet"
            if len(preview) > 42:
                preview = f"{preview[:39]}..."
            draw.multiline_text(
                (pad, title_y + max(18, int(24 * scale))),
                preview,
                fill=(226, 232, 240, 216),
                spacing=max(3, int(4 * scale)),
            )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(18, min(42, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad, rel_h - max(34, int(40 * scale))),
                    wrapped,
                    fill=(203, 213, 225, 176),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "lens_card":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(248, 250, 252, 252),
                outline=(217, 226, 236, 255),
                width=max(1, int(2 * scale)),
            )
            band_h = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, band_h + max(4, int(6 * scale))],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            family = str(item.get("lens_family", "") or "").strip().upper() or "PRIME"
            family_h = max(18, int(24 * scale))
            family_w = min(rel_w - (pad * 2), max(72, int(len(family) * 7 * scale) + int(22 * scale)))
            family_box = [pad, band_h + max(8, int(10 * scale)), pad + family_w, band_h + max(8, int(10 * scale)) + family_h]
            draw.rounded_rectangle(family_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((family_box[0] + family_box[2]) / 2.0, (family_box[1] + family_box[3]) / 2.0),
                family,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((rel_w - pad, band_h + max(20, int(22 * scale))), "Lens", fill=(100, 116, 139, 180), anchor="rm")
            title = str(item.get("label", "") or "").strip() or "Lens Card"
            if len(title) > 28:
                title = f"{title[:25]}..."
            title_y = family_box[3] + max(12, int(14 * scale))
            draw.text((pad, title_y), title, fill=(15, 23, 42, 255))
            focal = str(item.get("focal_length", "") or "").strip()
            if focal:
                draw.text((pad, title_y + max(18, int(22 * scale))), focal.upper(), fill=(100, 116, 139, 196))
            coverage = str(item.get("coverage", "") or "").strip()
            if coverage:
                max_chars = max(16, min(38, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(coverage, width=max_chars)
                draw.multiline_text(
                    (pad, title_y + max(38, int(44 * scale))),
                    wrapped,
                    fill=(71, 85, 105, 255),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(16, min(38, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad, rel_h - max(28, int(34 * scale))),
                    wrapped,
                    fill=(71, 85, 105, 216),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "wardrobe_card":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(248, 250, 252, 252),
                outline=(217, 226, 236, 255),
                width=max(1, int(2 * scale)),
            )
            band_h = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, band_h + max(4, int(6 * scale))],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            priority = str(item.get("wardrobe_priority", "") or "").strip().upper() or "HERO"
            priority_h = max(18, int(24 * scale))
            priority_w = min(rel_w - (pad * 2), max(72, int(len(priority) * 7 * scale) + int(22 * scale)))
            priority_box = [rel_w - pad - priority_w, band_h + max(8, int(10 * scale)), rel_w - pad, band_h + max(8, int(10 * scale)) + priority_h]
            draw.rounded_rectangle(priority_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((priority_box[0] + priority_box[2]) / 2.0, (priority_box[1] + priority_box[3]) / 2.0),
                priority,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((pad, band_h + max(14, int(18 * scale))), "WARDROBE", fill=(100, 116, 139, 180))
            title = str(item.get("label", "") or "").strip() or "Wardrobe Card"
            if len(title) > 24:
                title = f"{title[:21]}..."
            title_y = priority_box[3] + max(12, int(14 * scale))
            draw.text((pad, title_y), title, fill=(15, 23, 42, 255))
            silhouette = str(item.get("silhouette", "") or "").strip()
            if silhouette:
                max_chars = max(16, min(38, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(silhouette, width=max_chars)
                draw.multiline_text(
                    (pad, title_y + max(18, int(24 * scale))),
                    wrapped,
                    fill=(71, 85, 105, 255),
                    spacing=max(3, int(4 * scale)),
                )
            palette = str(item.get("palette_note", "") or "").strip()
            if palette:
                draw.text(
                    (pad, rel_h - max(42, int(48 * scale))),
                    palette.upper(),
                    fill=(100, 116, 139, 180),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(16, min(38, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad, rel_h - max(28, int(34 * scale))),
                    wrapped,
                    fill=(71, 85, 105, 216),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "set_dressing_card":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(15, 23, 42, 246),
                outline=(39, 48, 64, 255),
                width=max(1, int(2 * scale)),
            )
            stripe_w = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, stripe_w + max(3, int(4 * scale)), rel_h - 1],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            zone = str(item.get("dressing_zone", "") or "").strip().upper() or "FOREGROUND"
            zone_h = max(18, int(24 * scale))
            zone_w = min(rel_w - (pad * 2), max(86, int(len(zone) * 7 * scale) + int(22 * scale)))
            zone_box = [pad + stripe_w, pad, pad + stripe_w + zone_w, pad + zone_h]
            draw.rounded_rectangle(zone_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((zone_box[0] + zone_box[2]) / 2.0, (zone_box[1] + zone_box[3]) / 2.0),
                zone,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((rel_w - pad, pad + (zone_h / 2.0)), "Set Dressing", fill=(203, 213, 225, 170), anchor="rm")
            title = str(item.get("label", "") or "").strip() or "Set Dressing Card"
            if len(title) > 28:
                title = f"{title[:25]}..."
            title_y = zone_box[3] + max(12, int(14 * scale))
            draw.text((pad + stripe_w, title_y), title, fill=(248, 250, 252, 255))
            stack = str(item.get("texture_stack", "") or "").strip()
            if stack:
                max_chars = max(18, min(40, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(stack, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, title_y + max(18, int(22 * scale))),
                    wrapped,
                    fill=(226, 232, 240, 220),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(18, min(40, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, rel_h - max(36, int(42 * scale))),
                    wrapped,
                    fill=(203, 213, 225, 178),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "dialogue_card":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(17, 24, 39, 248),
                outline=(39, 48, 64, 255),
                width=max(1, int(2 * scale)),
            )
            pad = max(12, int(16 * scale))
            speaker = str(item.get("label", "") or "").strip().upper() or "SPEAKER"
            speaker_h = max(18, int(24 * scale))
            speaker_w = min(rel_w - (pad * 2), max(72, int(len(speaker) * 7 * scale) + int(22 * scale)))
            speaker_box = [pad, pad, pad + speaker_w, pad + speaker_h]
            draw.rounded_rectangle(speaker_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((speaker_box[0] + speaker_box[2]) / 2.0, (speaker_box[1] + speaker_box[3]) / 2.0),
                speaker,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            delivery = str(item.get("delivery", "") or "").strip().upper()
            if delivery:
                draw.text(
                    (rel_w - pad, pad + (speaker_h / 2.0)),
                    delivery,
                    fill=(203, 213, 225, 170),
                    anchor="rm",
                )
            draw.text(
                (pad, speaker_box[3] + max(6, int(6 * scale))),
                "“",
                fill=(*accent_rgb, 255),
            )
            line_text = str(item.get("line_text", "") or "").strip() or "Dialogue line"
            max_chars = max(18, min(48, rel_w // max(7, int(8 * scale))))
            wrapped = textwrap.fill(line_text, width=max_chars)
            draw.multiline_text(
                (pad + max(12, int(14 * scale)), speaker_box[3] + max(18, int(22 * scale))),
                wrapped,
                fill=(248, 250, 252, 240),
                spacing=max(3, int(4 * scale)),
            )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "hair_makeup_note":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(17, 24, 39, 248),
                outline=(39, 48, 64, 255),
                width=max(1, int(2 * scale)),
            )
            band_h = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, band_h + max(4, int(6 * scale))],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            area = str(item.get("hmu_area", "") or "").strip().upper() or "HAIR"
            area_h = max(18, int(24 * scale))
            area_w = min(rel_w - (pad * 2), max(72, int(len(area) * 7 * scale) + int(22 * scale)))
            area_box = [pad, band_h + max(8, int(10 * scale)), pad + area_w, band_h + max(8, int(10 * scale)) + area_h]
            draw.rounded_rectangle(area_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((area_box[0] + area_box[2]) / 2.0, (area_box[1] + area_box[3]) / 2.0),
                area,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((rel_w - pad, band_h + max(20, int(22 * scale))), "HMU", fill=(203, 213, 225, 170), anchor="rm")
            title = str(item.get("label", "") or "").strip() or "Hair + Makeup Note"
            if len(title) > 34:
                title = f"{title[:31]}..."
            title_y = area_box[3] + max(12, int(14 * scale))
            draw.text((pad, title_y), title, fill=(248, 250, 252, 255))
            application = str(item.get("application", "") or "").strip()
            if application:
                max_chars = max(18, min(52, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(application, width=max_chars)
                draw.multiline_text(
                    (pad, title_y + max(18, int(22 * scale))),
                    wrapped,
                    fill=(226, 232, 240, 216),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(18, min(52, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad, rel_h - max(36, int(42 * scale))),
                    wrapped,
                    fill=(203, 213, 225, 178),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "stunt_note":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(19, 18, 27, 248),
                outline=(55, 65, 81, 255),
                width=max(1, int(2 * scale)),
            )
            stripe_w = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, stripe_w + max(3, int(4 * scale)), rel_h - 1],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            level = str(item.get("stunt_level", "") or "").strip().upper() or "COORDINATION"
            level_h = max(18, int(24 * scale))
            level_w = min(rel_w - (pad * 2), max(82, int(len(level) * 7 * scale) + int(22 * scale)))
            level_box = [pad + stripe_w, pad, pad + stripe_w + level_w, pad + level_h]
            draw.rounded_rectangle(level_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((level_box[0] + level_box[2]) / 2.0, (level_box[1] + level_box[3]) / 2.0),
                level,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((rel_w - pad, pad + (level_h / 2.0)), "Stunt", fill=(203, 213, 225, 170), anchor="rm")
            title = str(item.get("label", "") or "").strip() or "Stunt Note"
            if len(title) > 30:
                title = f"{title[:27]}..."
            title_y = level_box[3] + max(12, int(14 * scale))
            draw.text((pad + stripe_w, title_y), title, fill=(248, 250, 252, 255))
            rigging = str(item.get("rigging", "") or "").strip()
            if rigging:
                max_chars = max(18, min(42, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(rigging, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, title_y + max(18, int(22 * scale))),
                    wrapped,
                    fill=(226, 232, 240, 216),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(18, min(42, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, rel_h - max(36, int(42 * scale))),
                    wrapped,
                    fill=(203, 213, 225, 178),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "camera_move":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(248, 250, 252, 252),
                outline=(217, 226, 236, 255),
                width=max(1, int(2 * scale)),
            )
            stripe_w = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, stripe_w + max(3, int(4 * scale)), rel_h - 1],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            move_type = str(item.get("move_type", "") or "").strip().upper() or "STATIC"
            move_h = max(18, int(24 * scale))
            move_w = min(rel_w - (pad * 2), max(74, int(len(move_type) * 7 * scale) + int(22 * scale)))
            move_box = [pad + stripe_w, pad, pad + stripe_w + move_w, pad + move_h]
            draw.rounded_rectangle(move_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((move_box[0] + move_box[2]) / 2.0, (move_box[1] + move_box[3]) / 2.0),
                move_type,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            duration = str(item.get("duration", "") or "").strip().upper()
            if duration:
                duration_w = min(
                    rel_w - move_box[2] - (pad * 2),
                    max(54, int(len(duration) * 7 * scale) + int(18 * scale))
                )
                duration_box = [move_box[2] + max(8, int(8 * scale)), pad, move_box[2] + max(8, int(8 * scale)) + duration_w, pad + move_h]
                draw.rounded_rectangle(
                    duration_box,
                    radius=max(8, int(12 * scale)),
                    fill=(15, 23, 42, 14),
                    outline=(15, 23, 42, 24),
                )
                draw.text(
                    ((duration_box[0] + duration_box[2]) / 2.0, (duration_box[1] + duration_box[3]) / 2.0),
                    duration,
                    fill=(71, 85, 105, 255),
                    anchor="mm",
                )
            title = str(item.get("label", "") or "").strip() or "Camera Move"
            if len(title) > 44:
                title = f"{title[:41]}..."
            title_y = move_box[3] + max(10, int(12 * scale))
            draw.text((pad + stripe_w, title_y), title, fill=(15, 23, 42, 255))
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(20, min(56, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, title_y + max(14, int(18 * scale))),
                    wrapped,
                    fill=(71, 85, 105, 255),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "continuity_note":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(15, 23, 42, 246),
                outline=(39, 48, 64, 255),
                width=max(1, int(2 * scale)),
            )
            stripe_w = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, stripe_w + max(3, int(4 * scale)), rel_h - 1],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            continuity = str(item.get("continuity_type", "") or "").strip().upper() or "PROP MATCH"
            type_h = max(18, int(24 * scale))
            type_w = min(rel_w - (pad * 2), max(82, int(len(continuity) * 7 * scale) + int(22 * scale)))
            type_box = [pad + stripe_w, pad, pad + stripe_w + type_w, pad + type_h]
            draw.rounded_rectangle(type_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((type_box[0] + type_box[2]) / 2.0, (type_box[1] + type_box[3]) / 2.0),
                continuity,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((rel_w - pad, pad + (type_h / 2.0)), "Continuity", fill=(203, 213, 225, 170), anchor="rm")
            title = str(item.get("label", "") or "").strip() or "Continuity Note"
            if len(title) > 30:
                title = f"{title[:27]}..."
            title_y = type_box[3] + max(12, int(14 * scale))
            draw.text((pad + stripe_w, title_y), title, fill=(248, 250, 252, 255))
            checkpoint = str(item.get("checkpoint", "") or "").strip()
            if checkpoint:
                max_chars = max(18, min(42, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(checkpoint, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, title_y + max(18, int(22 * scale))),
                    wrapped,
                    fill=(226, 232, 240, 216),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(18, min(42, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, rel_h - max(40, int(46 * scale))),
                    wrapped,
                    fill=(203, 213, 225, 178),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "lighting_cue":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(15, 23, 42, 246),
                outline=(39, 48, 64, 255),
                width=max(1, int(2 * scale)),
            )
            stripe_w = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, stripe_w + max(3, int(4 * scale)), rel_h - 1],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            style = str(item.get("lighting_style", "") or "").strip().upper() or "SOFT KEY"
            style_h = max(18, int(24 * scale))
            style_w = min(rel_w - (pad * 2), max(72, int(len(style) * 7 * scale) + int(22 * scale)))
            style_box = [pad + stripe_w, pad, pad + stripe_w + style_w, pad + style_h]
            draw.rounded_rectangle(style_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((style_box[0] + style_box[2]) / 2.0, (style_box[1] + style_box[3]) / 2.0),
                style,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text(
                (rel_w - pad, pad + (style_h / 2.0)),
                "Lighting",
                fill=(203, 213, 225, 170),
                anchor="rm",
            )
            title = str(item.get("label", "") or "").strip() or "Lighting Cue"
            if len(title) > 28:
                title = f"{title[:25]}..."
            title_y = style_box[3] + max(12, int(14 * scale))
            draw.text((pad + stripe_w, title_y), title, fill=(248, 250, 252, 255))
            source = str(item.get("source", "") or "").strip()
            if source:
                max_chars = max(18, min(42, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(source, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, title_y + max(18, int(24 * scale))),
                    wrapped,
                    fill=(226, 232, 240, 220),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(18, min(44, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, rel_h - max(46, int(52 * scale))),
                    wrapped,
                    fill=(203, 213, 225, 180),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "prop_card":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(248, 250, 252, 252),
                outline=(217, 226, 236, 255),
                width=max(1, int(2 * scale)),
            )
            band_h = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, band_h + max(4, int(6 * scale))],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            state = str(item.get("prop_state", "") or "").strip().upper() or "HERO PROP"
            state_h = max(18, int(24 * scale))
            state_w = min(rel_w - (pad * 2), max(84, int(len(state) * 7 * scale) + int(22 * scale)))
            state_box = [rel_w - pad - state_w, band_h + max(8, int(10 * scale)), rel_w - pad, band_h + max(8, int(10 * scale)) + state_h]
            draw.rounded_rectangle(state_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((state_box[0] + state_box[2]) / 2.0, (state_box[1] + state_box[3]) / 2.0),
                state,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((pad, band_h + max(14, int(18 * scale))), "PROP", fill=(100, 116, 139, 180))
            title = str(item.get("label", "") or "").strip() or "Prop Card"
            if len(title) > 24:
                title = f"{title[:21]}..."
            title_y = state_box[3] + max(12, int(14 * scale))
            draw.text((pad, title_y), title, fill=(15, 23, 42, 255))
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(16, min(40, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad, title_y + max(18, int(24 * scale))),
                    wrapped,
                    fill=(71, 85, 105, 255),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "sound_cue":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(17, 24, 39, 248),
                outline=(39, 48, 64, 255),
                width=max(1, int(2 * scale)),
            )
            pad = max(12, int(16 * scale))
            sound_type = str(item.get("sound_type", "") or "").strip().upper() or "AMBIENCE"
            type_h = max(18, int(24 * scale))
            type_w = min(rel_w - (pad * 2), max(76, int(len(sound_type) * 7 * scale) + int(22 * scale)))
            type_box = [pad, pad, pad + type_w, pad + type_h]
            draw.rounded_rectangle(type_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((type_box[0] + type_box[2]) / 2.0, (type_box[1] + type_box[3]) / 2.0),
                sound_type,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((rel_w - pad, pad + (type_h / 2.0)), "Sound", fill=(203, 213, 225, 170), anchor="rm")
            title = str(item.get("label", "") or "").strip() or "Sound Cue"
            if len(title) > 34:
                title = f"{title[:31]}..."
            title_y = type_box[3] + max(10, int(12 * scale))
            draw.text((pad, title_y), title, fill=(248, 250, 252, 255))
            bar_y = title_y + max(20, int(24 * scale))
            bar_width = max(6, int(8 * scale))
            bar_gap = max(4, int(6 * scale))
            bar_heights = [10, 20, 14, 24, 12, 18]
            cursor_x = pad
            for bar_h in bar_heights:
                height = max(6, int(bar_h * scale))
                draw.rounded_rectangle(
                    [cursor_x, bar_y + max(0, int(24 * scale) - height), cursor_x + bar_width, bar_y + max(0, int(24 * scale))],
                    radius=max(3, int(4 * scale)),
                    fill=(*accent_rgb, 240),
                )
                cursor_x += bar_width + bar_gap
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(18, min(48, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad, bar_y + max(30, int(34 * scale))),
                    wrapped,
                    fill=(203, 213, 225, 176),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "transition_card":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(12, 18, 28, 235),
                outline=(255, 255, 255, 48),
                width=max(1, int(2 * scale)),
            )
            pad = max(12, int(16 * scale))
            transition = str(item.get("transition_type", "") or "").strip().upper() or "CUT"
            type_h = max(18, int(24 * scale))
            type_w = min(rel_w - (pad * 2), max(70, int(len(transition) * 7 * scale) + int(22 * scale)))
            type_box = [int((rel_w - type_w) / 2), pad, int((rel_w + type_w) / 2), pad + type_h]
            draw.rounded_rectangle(type_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((type_box[0] + type_box[2]) / 2.0, (type_box[1] + type_box[3]) / 2.0),
                transition,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            arrow_y = type_box[3] + max(16, int(18 * scale))
            arrow_x0 = int(rel_w * 0.28)
            arrow_x1 = int(rel_w * 0.72)
            draw.line([(arrow_x0, arrow_y), (arrow_x1, arrow_y)], fill=(226, 232, 240, 120), width=max(1, int(2 * scale)))
            draw.line([(arrow_x1 - max(6, int(8 * scale)), arrow_y - max(6, int(8 * scale))), (arrow_x1, arrow_y)], fill=(226, 232, 240, 120), width=max(1, int(2 * scale)))
            draw.line([(arrow_x1 - max(6, int(8 * scale)), arrow_y + max(6, int(8 * scale))), (arrow_x1, arrow_y)], fill=(226, 232, 240, 120), width=max(1, int(2 * scale)))
            title = str(item.get("label", "") or "").strip() or "Transition Card"
            if len(title) > 30:
                title = f"{title[:27]}..."
            title_y = arrow_y + max(14, int(18 * scale))
            draw.text((rel_w / 2.0, title_y), title, fill=(248, 250, 252, 245), anchor="ma")
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(16, min(34, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (rel_w / 2.0, title_y + max(18, int(24 * scale))),
                    wrapped,
                    fill=(203, 213, 225, 176),
                    spacing=max(3, int(4 * scale)),
                    anchor="ma",
                    align="center",
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "editorial_card":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(248, 250, 252, 252),
                outline=(217, 226, 236, 255),
                width=max(1, int(2 * scale)),
            )
            stripe_w = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, stripe_w + max(3, int(4 * scale)), rel_h - 1],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            rhythm = str(item.get("edit_rhythm", "") or "").strip().upper() or "HOLD"
            rhythm_h = max(18, int(24 * scale))
            rhythm_w = min(rel_w - (pad * 2), max(74, int(len(rhythm) * 7 * scale) + int(22 * scale)))
            rhythm_box = [pad + stripe_w, pad, pad + stripe_w + rhythm_w, pad + rhythm_h]
            draw.rounded_rectangle(rhythm_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((rhythm_box[0] + rhythm_box[2]) / 2.0, (rhythm_box[1] + rhythm_box[3]) / 2.0),
                rhythm,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((rel_w - pad, pad + (rhythm_h / 2.0)), "Editorial", fill=(100, 116, 139, 255), anchor="rm")
            title = str(item.get("label", "") or "").strip() or "Editorial Card"
            if len(title) > 32:
                title = f"{title[:29]}..."
            title_y = rhythm_box[3] + max(12, int(14 * scale))
            draw.text((pad + stripe_w, title_y), title, fill=(15, 23, 42, 255))
            logic = str(item.get("cut_logic", "") or "").strip()
            if logic:
                max_chars = max(16, min(38, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(logic, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, title_y + max(18, int(22 * scale))),
                    wrapped,
                    fill=(71, 85, 105, 255),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(16, min(38, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, rel_h - max(28, int(34 * scale))),
                    wrapped,
                    fill=(100, 116, 139, 216),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "production_note":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(248, 250, 252, 252),
                outline=(217, 226, 236, 255),
                width=max(1, int(2 * scale)),
            )
            band_h = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, band_h + max(4, int(6 * scale))],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            department = str(item.get("production_department", "") or "").strip().upper() or "ART"
            dept_h = max(18, int(24 * scale))
            dept_w = min(rel_w - (pad * 2), max(72, int(len(department) * 7 * scale) + int(22 * scale)))
            dept_box = [pad, band_h + max(8, int(10 * scale)), pad + dept_w, band_h + max(8, int(10 * scale)) + dept_h]
            draw.rounded_rectangle(dept_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((dept_box[0] + dept_box[2]) / 2.0, (dept_box[1] + dept_box[3]) / 2.0),
                department,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((rel_w - pad, band_h + max(20, int(22 * scale))), "Production", fill=(100, 116, 139, 180), anchor="rm")
            title = str(item.get("label", "") or "").strip() or "Production Note"
            if len(title) > 28:
                title = f"{title[:25]}..."
            title_y = dept_box[3] + max(12, int(14 * scale))
            draw.text((pad, title_y), title, fill=(15, 23, 42, 255))
            status = str(item.get("status", "") or "").strip()
            if status:
                max_chars = max(16, min(38, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(status, width=max_chars)
                draw.multiline_text(
                    (pad, title_y + max(18, int(22 * scale))),
                    wrapped,
                    fill=(71, 85, 105, 255),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(16, min(38, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad, rel_h - max(28, int(34 * scale))),
                    wrapped,
                    fill=(100, 116, 139, 216),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "graphics_note":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(17, 24, 39, 248),
                outline=(39, 48, 64, 255),
                width=max(1, int(2 * scale)),
            )
            stripe_w = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, stripe_w + max(3, int(4 * scale)), rel_h - 1],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            graphic_type = str(item.get("graphic_type", "") or "").strip().upper() or "SCREEN INSERT"
            type_h = max(18, int(24 * scale))
            type_w = min(rel_w - (pad * 2), max(96, int(len(graphic_type) * 7 * scale) + int(22 * scale)))
            type_box = [pad + stripe_w, pad, pad + stripe_w + type_w, pad + type_h]
            draw.rounded_rectangle(type_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((type_box[0] + type_box[2]) / 2.0, (type_box[1] + type_box[3]) / 2.0),
                graphic_type,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((rel_w - pad, pad + (type_h / 2.0)), "Graphics", fill=(203, 213, 225, 170), anchor="rm")
            title = str(item.get("label", "") or "").strip() or "Graphics Note"
            if len(title) > 42:
                title = f"{title[:39]}..."
            title_y = type_box[3] + max(12, int(14 * scale))
            draw.text((pad + stripe_w, title_y), title, fill=(248, 250, 252, 255))
            placement = str(item.get("placement", "") or "").strip()
            if placement:
                max_chars = max(20, min(54, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(placement, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, title_y + max(18, int(22 * scale))),
                    wrapped,
                    fill=(226, 232, 240, 216),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(20, min(54, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, rel_h - max(36, int(42 * scale))),
                    wrapped,
                    fill=(203, 213, 225, 178),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "grade_card":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(11, 16, 28, 246),
                outline=(55, 65, 81, 255),
                width=max(1, int(2 * scale)),
            )
            band_h = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, band_h + max(4, int(6 * scale))],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            direction = str(item.get("grade_direction", "") or "").strip().upper() or "SILVER BLUE"
            direction_h = max(18, int(24 * scale))
            direction_w = min(rel_w - (pad * 2), max(88, int(len(direction) * 7 * scale) + int(22 * scale)))
            direction_box = [pad, band_h + max(8, int(10 * scale)), pad + direction_w, band_h + max(8, int(10 * scale)) + direction_h]
            draw.rounded_rectangle(direction_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((direction_box[0] + direction_box[2]) / 2.0, (direction_box[1] + direction_box[3]) / 2.0),
                direction,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((rel_w - pad, band_h + max(20, int(22 * scale))), "Grade", fill=(203, 213, 225, 170), anchor="rm")
            title = str(item.get("label", "") or "").strip() or "Grade Card"
            if len(title) > 28:
                title = f"{title[:25]}..."
            title_y = direction_box[3] + max(12, int(14 * scale))
            draw.text((pad, title_y), title, fill=(248, 250, 252, 255))
            palette = str(item.get("palette_note", "") or "").strip()
            if palette:
                max_chars = max(16, min(36, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(palette, width=max_chars)
                draw.multiline_text(
                    (pad, title_y + max(18, int(22 * scale))),
                    wrapped,
                    fill=(191, 219, 254, 228),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(16, min(36, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad, rel_h - max(28, int(34 * scale))),
                    wrapped,
                    fill=(203, 213, 225, 180),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "vfx_note":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(9, 14, 24, 246),
                outline=(255, 255, 255, 24),
                width=max(1, int(2 * scale)),
            )
            band_h = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, band_h + max(4, int(6 * scale))],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            task = str(item.get("vfx_task", "") or "").strip().upper() or "CLEANUP"
            task_h = max(18, int(24 * scale))
            task_w = min(rel_w - (pad * 2), max(82, int(len(task) * 7 * scale) + int(22 * scale)))
            task_box = [pad, band_h + max(8, int(10 * scale)), pad + task_w, band_h + max(8, int(10 * scale)) + task_h]
            draw.rounded_rectangle(task_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((task_box[0] + task_box[2]) / 2.0, (task_box[1] + task_box[3]) / 2.0),
                task,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((rel_w - pad, band_h + max(20, int(22 * scale))), "VFX", fill=(203, 213, 225, 170), anchor="rm")
            title = str(item.get("label", "") or "").strip() or "VFX Note"
            if len(title) > 34:
                title = f"{title[:31]}..."
            title_y = task_box[3] + max(12, int(14 * scale))
            draw.text((pad, title_y), title, fill=(248, 250, 252, 255))
            status = str(item.get("plate_status", "") or "").strip()
            if status:
                max_chars = max(18, min(52, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(status, width=max_chars)
                draw.multiline_text(
                    (pad, title_y + max(18, int(22 * scale))),
                    wrapped,
                    fill=(191, 219, 254, 230),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(18, min(52, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad, rel_h - max(36, int(42 * scale))),
                    wrapped,
                    fill=(226, 232, 240, 178),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "blocking_note":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            accent_rgb = self._hex_to_rgb(item.get("accent", "#ffffff"))
            draw.rounded_rectangle(
                [0, 0, rel_w - 1, rel_h - 1],
                radius=corner_radius,
                fill=(248, 250, 252, 252),
                outline=(217, 226, 236, 255),
                width=max(1, int(2 * scale)),
            )
            stripe_w = max(4, int(5 * scale))
            draw.rounded_rectangle(
                [0, 0, stripe_w + max(3, int(4 * scale)), rel_h - 1],
                radius=corner_radius,
                fill=(*accent_rgb, 255),
            )
            pad = max(12, int(16 * scale))
            pattern = str(item.get("blocking_pattern", "") or "").strip().upper() or "CROSS LEFT"
            pattern_h = max(18, int(24 * scale))
            pattern_w = min(rel_w - (pad * 2), max(88, int(len(pattern) * 7 * scale) + int(22 * scale)))
            pattern_box = [pad + stripe_w, pad, pad + stripe_w + pattern_w, pad + pattern_h]
            draw.rounded_rectangle(pattern_box, radius=max(8, int(12 * scale)), fill=(*accent_rgb, 255))
            draw.text(
                ((pattern_box[0] + pattern_box[2]) / 2.0, (pattern_box[1] + pattern_box[3]) / 2.0),
                pattern,
                fill=self._text_color_for_bg(accent_rgb),
                anchor="mm",
            )
            draw.text((rel_w - pad, pad + (pattern_h / 2.0)), "Blocking", fill=(100, 116, 139, 255), anchor="rm")
            title = str(item.get("label", "") or "").strip() or "Blocking Note"
            if len(title) > 54:
                title = f"{title[:51]}..."
            title_y = pattern_box[3] + max(12, int(14 * scale))
            draw.text((pad + stripe_w, title_y), title, fill=(15, 23, 42, 255))
            staging = str(item.get("staging", "") or "").strip()
            if staging:
                max_chars = max(28, min(76, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(staging, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, title_y + max(18, int(22 * scale))),
                    wrapped,
                    fill=(71, 85, 105, 255),
                    spacing=max(3, int(4 * scale)),
                )
            note = str(item.get("content", "") or "").strip()
            if note:
                max_chars = max(28, min(76, rel_w // max(7, int(8 * scale))))
                wrapped = textwrap.fill(note, width=max_chars)
                draw.multiline_text(
                    (pad + stripe_w, rel_h - max(34, int(40 * scale))),
                    wrapped,
                    fill=(100, 116, 139, 216),
                    spacing=max(3, int(4 * scale)),
                )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)
            return

        if item_type == "frame":
            item_tile = Image.new("RGBA", (rel_w, rel_h), (0, 0, 0, 0))
            draw = ImageDraw.Draw(item_tile)
            rgb = self._hex_to_rgb(item.get("color", DEFAULT_FRAME_COLOR))
            presentation = self._frame_presentation(item)
            scene_code, title, subtitle = self._frame_header_meta(item)
            frame_box = [0, 0, rel_w - 1, rel_h - 1]
            frame_radius = max(8, int(14 * scale))
            border_width = max(1, int(3 * scale))

            if presentation == "board":
                shadow_offset = max(4, int(8 * scale))
                draw.rounded_rectangle(
                    [shadow_offset, shadow_offset, rel_w - 1, rel_h - 1],
                    radius=frame_radius,
                    fill=(0, 0, 0, 34),
                )
                draw.rounded_rectangle(
                    frame_box,
                    radius=frame_radius,
                    fill=(250, 246, 240, 225),
                    outline=(*rgb, 230),
                    width=border_width,
                )
            elif presentation == "spotlight":
                draw.rounded_rectangle(
                    frame_box,
                    radius=frame_radius,
                    fill=(15, 23, 42, 132),
                    outline=(*rgb, 240),
                    width=border_width,
                )
            else:
                draw.rounded_rectangle(
                    frame_box,
                    radius=frame_radius,
                    fill=(*rgb, 20),
                    outline=(*rgb, 235),
                    width=border_width,
                )
            if presentation in {"board", "spotlight"}:
                badge_y = max(10, int(14 * scale))
                badge_h = max(22, int(28 * scale))
                cursor_x = max(10, int(14 * scale))
                if scene_code:
                    badge_w = min(rel_w - (cursor_x * 2), max(48, int(len(scene_code) * 7 * scale) + int(20 * scale)))
                    badge_box = [cursor_x, badge_y, cursor_x + badge_w, badge_y + badge_h]
                    draw.rounded_rectangle(
                        badge_box,
                        radius=max(10, int(14 * scale)),
                        fill=(*rgb, 245),
                    )
                    draw.text(
                        ((badge_box[0] + badge_box[2]) / 2.0, (badge_box[1] + badge_box[3]) / 2.0),
                        scene_code,
                        fill=self._text_color_for_bg(rgb),
                        anchor="mm",
                    )
                    cursor_x = badge_box[2] + max(8, int(8 * scale))
                if title:
                    title_w = min(
                        rel_w - cursor_x - max(10, int(14 * scale)),
                        max(96, int(len(title) * 8 * scale) + int(26 * scale))
                    )
                    title_box = [cursor_x, badge_y, max(cursor_x + 32, cursor_x + title_w), badge_y + badge_h]
                    draw.rounded_rectangle(
                        title_box,
                        radius=max(10, int(14 * scale)),
                        fill=(*rgb, 245),
                    )
                    draw.text(
                        ((title_box[0] + title_box[2]) / 2.0, (title_box[1] + title_box[3]) / 2.0),
                        title,
                        fill=self._text_color_for_bg(rgb),
                        anchor="mm",
                    )
                if subtitle:
                    subtitle_y = badge_y + badge_h + max(6, int(8 * scale))
                    draw.text(
                        (max(10, int(14 * scale)), subtitle_y),
                        subtitle,
                        fill=(245, 245, 245, 235) if presentation == "spotlight" else (255, 250, 242, 240),
                    )
            else:
                header_y = max(12, int(14 * scale))
                header_x = max(12, int(16 * scale))
                header_parts = [part for part in [scene_code, title] if part]
                header_text = "  ".join(header_parts)
                if header_text:
                    draw.text(
                        (header_x, header_y),
                        header_text,
                        fill=(*rgb, 255),
                    )
                if subtitle:
                    draw.text(
                        (header_x, header_y + max(14, int(18 * scale))),
                        subtitle,
                        fill=(232, 232, 235, 230),
                    )
            self._composite_item_tile(canvas, item_tile, rel_x, rel_y, rel_w, rel_h, rotation=rotation)

    def render_board_preview(self, board_id, item_ids=None, scale=1.0, padding=32, max_side=1536):
        board_data = self.get_board(board_id)
        items = board_data.get("items", [])
        if item_ids is not None:
            wanted_ids = set(item_ids)
            items = [item for item in items if item.get("id") in wanted_ids]

        render_items = [
            item for item in items
            if all(key in item for key in ("x", "y", "w", "h"))
        ]
        if not render_items:
            return None

        visual_bounds = [self._item_render_bounds(item) for item in render_items]
        min_x = min(bounds[0] for bounds in visual_bounds)
        min_y = min(bounds[1] for bounds in visual_bounds)
        max_x = max(bounds[2] for bounds in visual_bounds)
        max_y = max(bounds[3] for bounds in visual_bounds)

        content_w = max(1, int(round((max_x - min_x) * scale)))
        content_h = max(1, int(round((max_y - min_y) * scale)))
        longest_side = max(content_w, content_h)
        if longest_side > max_side:
            fit_scale = max_side / float(longest_side)
            scale *= fit_scale
            content_w = max(1, int(round((max_x - min_x) * scale)))
            content_h = max(1, int(round((max_y - min_y) * scale)))

        canvas = Image.new("RGBA", (content_w + (padding * 2), content_h + (padding * 2)), (18, 18, 20, 255))

        for item in self._sorted_render_items(render_items):
            rel_x = int(round((item["x"] - min_x) * scale)) + padding
            rel_y = int(round((item["y"] - min_y) * scale)) + padding
            rel_w = int(round(item["w"] * scale))
            rel_h = int(round(item["h"] * scale))
            self._draw_item_to_canvas(canvas, board_id, item, rel_x, rel_y, rel_w, rel_h, scale=scale)

        return canvas.convert("RGB")

    def flatten_frame(self, board_id, frame_id, scale=2.0):
        board_data = self.get_board(board_id)
        frame = next((i for i in board_data["items"] if i["id"] == frame_id), None)
        if not frame or frame["type"] != "frame":
            return None

        # Find items inside the frame (center point must be inside)
        contained_items = []
        for item in board_data["items"]:
            if item["id"] == frame_id: continue
            
            # Use center point for detection to be more lenient
            cx = item["x"] + item["w"] / 2
            cy = item["y"] + item["h"] / 2
            
            if (cx >= frame["x"] and cy >= frame["y"] and
                cx <= (frame["x"] + frame["w"]) and
                cy <= (frame["y"] + frame["h"])):
                contained_items.append(item)

        # Create base image with higher resolution
        canvas_w = int(frame["w"] * scale)
        canvas_h = int(frame["h"] * scale)
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)

        # Draw frame background
        bg_color = frame.get("color", DEFAULT_FRAME_COLOR)
        if bg_color.startswith("#"):
            hex_color = bg_color.lstrip('#')
            rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            draw.rectangle([0, 0, canvas_w, canvas_h], fill=(*rgb, 26)) # 10% opacity
            draw.rectangle([0, 0, canvas_w, canvas_h], outline=(*rgb, 255), width=int(3 * scale))

        # Draw items in board order so exported frame previews match the canvas layering.
        assets_path = self._get_assets_path(board_id)
        os.makedirs(assets_path, exist_ok=True)
        for item in self._sorted_render_items(contained_items):
            rel_x = int((item["x"] - frame["x"]) * scale)
            rel_y = int((item["y"] - frame["y"]) * scale)
            rel_w = int(item["w"] * scale)
            rel_h = int(item["h"] * scale)
            self._draw_item_to_canvas(canvas, board_id, item, rel_x, rel_y, rel_w, rel_h, scale=scale)

        # Save result
        filename = f"flattened_{uuid.uuid4()}.png"
        canvas.save(os.path.join(assets_path, filename))
        return filename

    def get_frame_palette(self, board_id, frame_id, num_colors=12):
        board_data = self.get_board(board_id)
        frame = next((i for i in board_data["items"] if i["id"] == frame_id), None)
        if not frame or frame["type"] != "frame":
            return []

        # Find images inside the frame (center point must be inside)
        image_items = []
        for item in board_data["items"]:
            if item["type"] == "image" and item.get("image_ref"):
                cx = item["x"] + item["w"] / 2
                cy = item["y"] + item["h"] / 2
                
                if (cx >= frame["x"] and cy >= frame["y"] and
                    cx <= (frame["x"] + frame["w"]) and
                    cy <= (frame["y"] + frame["h"])):
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
                    img = apply_normalized_crop(img, item.get("crop"))
                    
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
        
        # Sort by count first to get the most common ones
        colors.sort(key=lambda x: x[0], reverse=True)
        top_colors = [c[1] for c in colors[:num_colors]]
        
        # Then sort by hue for a nice rainbow-like presentation
        import colorsys
        def get_hue(rgb):
            h, s, v = colorsys.rgb_to_hsv(rgb[0]/255.0, rgb[1]/255.0, rgb[2]/255.0)
            return h
        
        top_colors.sort(key=get_hue)
        
        hex_colors = []
        for rgb in top_colors:
            hex_colors.append('#{:02x}{:02x}{:02x}'.format(rgb[0], rgb[1], rgb[2]))
            
        return hex_colors

    def get_image_palette(self, board_id, item_id, num_colors=8):
        board_data = self.get_board(board_id)
        item = next((i for i in board_data.get("items", []) if i.get("id") == item_id), None)
        if not item or item.get("type") != "image" or not item.get("image_ref"):
            return {"colors": [], "filename": None, "width": 0, "height": 0}

        assets_path = self._get_assets_path(board_id)
        img_path = os.path.join(assets_path, item["image_ref"])
        if not os.path.exists(img_path):
            return {"colors": [], "filename": None, "width": 0, "height": 0}

        img = Image.open(img_path).convert("RGB")
        img = apply_normalized_crop(img, item.get("crop"))

        sample = img.resize((200, 200), Image.Resampling.NEAREST)
        quantized = sample.convert("P", palette=Image.Palette.ADAPTIVE, colors=num_colors).convert("RGB")
        colors = quantized.getcolors(num_colors * 50) or []
        colors.sort(key=lambda x: x[0], reverse=True)
        top_colors = [c[1] for c in colors[:num_colors]]

        import colorsys
        top_colors.sort(key=lambda rgb: colorsys.rgb_to_hsv(rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0)[0])
        hex_colors = ['#{:02x}{:02x}{:02x}'.format(rgb[0], rgb[1], rgb[2]) for rgb in top_colors]

        swatch_w = 160
        swatch_h = 52
        palette_img = Image.new("RGB", (swatch_w, max(1, len(hex_colors)) * swatch_h), (20, 20, 20))
        draw = ImageDraw.Draw(palette_img)

        for idx, hex_color in enumerate(hex_colors):
            y0 = idx * swatch_h
            y1 = y0 + swatch_h
            rgb = tuple(int(hex_color[i:i+2], 16) for i in (1, 3, 5))
            draw.rectangle([0, y0, swatch_w, y1], fill=rgb)

        filename = f"palette_{uuid.uuid4()}.png"
        palette_img.save(os.path.join(assets_path, filename))
        return {
            "colors": hex_colors,
            "filename": filename,
            "width": swatch_w,
            "height": palette_img.height
        }

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

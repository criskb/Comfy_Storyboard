import os
import unittest
from tempfile import TemporaryDirectory

from nodes.storyboard_store import StoryboardStore


class StoryboardCustomExtensionsTest(unittest.TestCase):
    def build_demo_board(self, board_id="dummy_smoke"):
        return {
            "board_id": board_id,
            "items": [
                {
                    "id": "frame_main",
                    "type": "frame",
                    "x": 0,
                    "y": 0,
                    "w": 1220,
                    "h": 880,
                    "label": "Dummy Zone",
                    "color": "#ffffff",
                    "frame_presentation": "board",
                },
                {
                    "id": "mood_1",
                    "type": "mood_tag",
                    "x": 48,
                    "y": 70,
                    "w": 220,
                    "h": 92,
                    "label": "Quiet Tension",
                    "content": "Soft light and held breath.",
                    "accent": "#d6e4ff",
                },
                {
                    "id": "shot_1",
                    "type": "shot_card",
                    "x": 300,
                    "y": 70,
                    "w": 272,
                    "h": 176,
                    "label": "Opening Reveal",
                    "shot_type": "Wide",
                    "content": "Begin wide, then let the subject puncture the frame.",
                    "accent": "#fde68a",
                },
                {
                    "id": "beat_1",
                    "type": "story_beat",
                    "x": 600,
                    "y": 70,
                    "w": 268,
                    "h": 168,
                    "label": "The world shifts",
                    "beat_stage": "Conflict",
                    "content": "Reference images become sequential beats.",
                    "accent": "#c7f9cc",
                },
                {
                    "id": "swatch_1",
                    "type": "swatch_strip",
                    "x": 80,
                    "y": 320,
                    "w": 308,
                    "h": 136,
                    "label": "Base Palette",
                    "content": "Stone, canvas, fog, graphite",
                    "swatches": ["#f4efe6", "#cab9a5", "#7a8795", "#1f2937"],
                },
                {
                    "id": "divider_1",
                    "type": "scene_divider",
                    "x": 460,
                    "y": 68,
                    "w": 380,
                    "h": 86,
                    "label": "Sequence Two",
                    "content": "Night interiors",
                    "accent": "#bfdbfe",
                },
                {
                    "id": "character_1",
                    "type": "character_card",
                    "x": 430,
                    "y": 320,
                    "w": 272,
                    "h": 196,
                    "label": "Ari Vale",
                    "character_role": "Lead",
                    "look": "Weathered coat, silver ring, tired eyes",
                    "content": "Reserved but vigilant. Every glance feels preloaded.",
                    "accent": "#e2e8f0",
                },
                {
                    "id": "location_1",
                    "type": "location_card",
                    "x": 876,
                    "y": 118,
                    "w": 244,
                    "h": 176,
                    "label": "Harbor Rooftop",
                    "time_of_day": "Night",
                    "content": "Wet concrete, sodium haze, wind pushing loose fabric.",
                    "accent": "#bfdbfe",
                },
                {
                    "id": "dialogue_1",
                    "type": "dialogue_card",
                    "x": 732,
                    "y": 352,
                    "w": 388,
                    "h": 154,
                    "label": "Mara",
                    "line_text": "If we wait for it to feel safe, we stay here forever.",
                    "delivery": "Measured",
                    "accent": "#fde68a",
                },
                {
                    "id": "move_1",
                    "type": "camera_move",
                    "x": 732,
                    "y": 540,
                    "w": 388,
                    "h": 100,
                    "label": "Reveal the subject as the wind shifts",
                    "move_type": "Push In",
                    "duration": "4 beats",
                    "content": "Stay gentle and deliberate. Let the frame settle before the face lands.",
                    "accent": "#c7f9cc",
                },
            ],
            "selection": [],
            "settings": {},
        }

    def test_render_board_preview_supports_custom_extension_items(self):
        with TemporaryDirectory() as tmp:
            store = StoryboardStore(tmp)
            board = self.build_demo_board()
            store.save_board(board, notify=False)

            preview = store.render_board_preview(board["board_id"], scale=1.0)

            self.assertIsNotNone(preview)
            self.assertGreater(preview.size[0], 0)
            self.assertGreater(preview.size[1], 0)

    def test_flatten_frame_creates_assets_dir_for_layout_only_board(self):
        with TemporaryDirectory() as tmp:
            store = StoryboardStore(tmp)
            board = self.build_demo_board()
            store.save_board(board, notify=False)

            flattened_name = store.flatten_frame(board["board_id"], "frame_main", scale=1.0)

            self.assertTrue(flattened_name)
            flattened_path = os.path.join(store._get_assets_path(board["board_id"]), flattened_name)
            self.assertTrue(os.path.exists(flattened_path))


if __name__ == "__main__":
    unittest.main()

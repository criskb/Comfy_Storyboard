import os
import unittest
from tempfile import TemporaryDirectory

from PIL import Image

from nodes.storyboard_store import StoryboardStore


class StoryboardStorePortabilityTest(unittest.TestCase):
    def create_store(self):
        tempdir = TemporaryDirectory()
        self.addCleanup(tempdir.cleanup)
        return StoryboardStore(tempdir.name), tempdir.name

    def test_export_and_import_board_package_round_trips_assets(self):
        store, temp_path = self.create_store()
        board_id = "scene-alpha"

        image_filename = store.add_asset(
            board_id,
            Image.new("RGB", (32, 24), (24, 48, 96)),
            filename="frame_ref.png",
        )

        source_video_path = os.path.join(temp_path, "clip_source.mp4")
        with open(source_video_path, "wb") as video_file:
            video_file.write(b"storyboard-video-bytes")
        video_filename = store.add_video_asset(board_id, source_video_path, filename="clip_ref.mp4")

        board_data = {
            "board_id": board_id,
            "version": 1,
            "viewport": {"x": 10, "y": 20, "zoom": 1.2},
            "items": [
                {
                    "id": "image_1",
                    "type": "image",
                    "x": 10,
                    "y": 20,
                    "w": 320,
                    "h": 240,
                    "image_ref": image_filename,
                    "label": "Frame",
                },
                {
                    "id": "video_1",
                    "type": "video",
                    "x": 360,
                    "y": 20,
                    "w": 320,
                    "h": 180,
                    "video_ref": video_filename,
                    "label": "Clip",
                },
                {
                    "id": "note_1",
                    "type": "note",
                    "x": 30,
                    "y": 320,
                    "w": 180,
                    "h": 120,
                    "content": "Portable board package",
                    "color": "#ffee58",
                },
            ],
            "selection": ["image_1", "video_1"],
        }
        store.save_board(board_data, notify=False)

        package_data = store.export_board_package(board_id)

        self.assertEqual(package_data["format"], "comfyui-storyboard-package")
        self.assertEqual(package_data["version"], 1)
        self.assertEqual(len(package_data["assets"]), 2)
        self.assertEqual(package_data["missing_assets"], [])

        result = store.import_board_package(package_data, board_id="scene-alpha-copy", notify=False)
        self.assertEqual(result["board_id"], "scene-alpha-copy")
        self.assertEqual(result["item_count"], 3)
        self.assertEqual(result["asset_count"], 2)
        self.assertEqual(result["missing_assets"], [])

        imported_board = store.get_board("scene-alpha-copy")
        self.assertEqual(imported_board["board_id"], "scene-alpha-copy")
        self.assertEqual(imported_board["selection"], ["image_1", "video_1"])
        self.assertEqual(len(imported_board["items"]), 3)

        imported_image = next(item for item in imported_board["items"] if item["id"] == "image_1")
        imported_video = next(item for item in imported_board["items"] if item["id"] == "video_1")
        imported_assets_path = store._get_assets_path("scene-alpha-copy")

        self.assertTrue(os.path.isfile(os.path.join(imported_assets_path, imported_image["image_ref"])))
        self.assertTrue(os.path.isfile(os.path.join(imported_assets_path, imported_video["video_ref"])))

        with open(os.path.join(imported_assets_path, imported_image["image_ref"]), "rb") as imported_image_file:
            imported_image_bytes = imported_image_file.read()
        with open(os.path.join(store._get_assets_path(board_id), image_filename), "rb") as original_image_file:
            original_image_bytes = original_image_file.read()
        self.assertEqual(imported_image_bytes, original_image_bytes)

        with open(os.path.join(imported_assets_path, imported_video["video_ref"]), "rb") as imported_video_file:
            imported_video_bytes = imported_video_file.read()
        with open(os.path.join(store._get_assets_path(board_id), video_filename), "rb") as original_video_file:
            original_video_bytes = original_video_file.read()
        self.assertEqual(imported_video_bytes, original_video_bytes)

    def test_duplicate_board_copies_assets_and_updates_board_id(self):
        store, _ = self.create_store()
        board_id = "scene-beta"

        image_filename = store.add_asset(
            board_id,
            Image.new("RGB", (20, 20), (200, 120, 40)),
            filename="still.png",
        )
        board_data = {
            "board_id": board_id,
            "items": [
                {
                    "id": "image_1",
                    "type": "image",
                    "x": 0,
                    "y": 0,
                    "w": 160,
                    "h": 160,
                    "image_ref": image_filename,
                }
            ],
            "selection": ["image_1"],
        }
        store.save_board(board_data, notify=False)

        duplicated = store.duplicate_board(board_id, "scene-beta-copy", notify=False)
        self.assertTrue(duplicated)

        copied_board = store.get_board("scene-beta-copy")
        self.assertEqual(copied_board["board_id"], "scene-beta-copy")
        self.assertEqual(copied_board["selection"], ["image_1"])

        copied_asset_path = os.path.join(store._get_assets_path("scene-beta-copy"), image_filename)
        self.assertTrue(os.path.isfile(copied_asset_path))

        with open(os.path.join(store._get_assets_path(board_id), image_filename), "rb") as original_file:
            original_bytes = original_file.read()
        with open(copied_asset_path, "rb") as copied_file:
            copied_bytes = copied_file.read()
        self.assertEqual(copied_bytes, original_bytes)

    def test_import_board_package_rejects_existing_board_id(self):
        store, _ = self.create_store()
        board_id = "scene-gamma"

        store.save_board({"board_id": board_id, "items": [], "selection": []}, notify=False)
        package_data = store.export_board_package(board_id)

        with self.assertRaises(ValueError):
            store.import_board_package(package_data, board_id=board_id, notify=False)

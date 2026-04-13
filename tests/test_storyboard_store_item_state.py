import unittest
from tempfile import TemporaryDirectory

from nodes.storyboard_store import StoryboardStore


class StoryboardStoreItemStateTest(unittest.TestCase):
    def create_store(self):
        tempdir = TemporaryDirectory()
        self.addCleanup(tempdir.cleanup)
        return StoryboardStore(tempdir.name)

    def test_item_state_normalization_migrates_pinned_and_filters_hidden_selection(self):
        store = self.create_store()
        board_id = "item-state-board"

        store.save_board({
            "board_id": board_id,
            "items": [
                {"id": "legacy_locked", "type": "note", "x": 0, "y": 0, "w": 100, "h": 60, "content": "A", "pinned": True},
                {"id": "hidden_note", "type": "note", "x": 120, "y": 0, "w": 100, "h": 60, "content": "B", "hidden": True},
                {"id": "plain_note", "type": "note", "x": 240, "y": 0, "w": 100, "h": 60, "content": "C"},
            ],
            "selection": ["legacy_locked", "hidden_note", "plain_note"],
        }, notify=False)

        board = store.get_board(board_id)
        items_by_id = {item["id"]: item for item in board["items"]}

        self.assertEqual(board["selection"], ["legacy_locked", "plain_note"])
        self.assertTrue(items_by_id["legacy_locked"]["locked"])
        self.assertNotIn("pinned", items_by_id["legacy_locked"])
        self.assertTrue(items_by_id["hidden_note"]["hidden"])
        self.assertNotIn("locked", items_by_id["plain_note"])

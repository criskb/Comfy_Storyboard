import unittest
from tempfile import TemporaryDirectory

from nodes.storyboard_store import StoryboardStore


class StoryboardStoreCollectionsTest(unittest.TestCase):
    def create_store(self):
        tempdir = TemporaryDirectory()
        self.addCleanup(tempdir.cleanup)
        return StoryboardStore(tempdir.name)

    def test_save_and_load_normalizes_collection_membership(self):
        store = self.create_store()
        board_id = "collection-board"

        store.save_board({
            "board_id": board_id,
            "items": [
                {"id": "item_a", "type": "note", "x": 0, "y": 0, "w": 120, "h": 80, "content": "A"},
                {"id": "item_b", "type": "note", "x": 10, "y": 90, "w": 120, "h": 80, "content": "B"},
            ],
            "selection": ["item_a", "missing_id"],
            "groups": [
                {
                    "id": "group_1",
                    "name": "  Hero Beats  ",
                    "color": "#abc",
                    "item_ids": ["item_a", "missing_id", "item_a"],
                },
                {
                    "id": "group_1",
                    "name": "",
                    "color": "not-a-color",
                    "item_ids": ["item_b"],
                },
            ],
        }, notify=False)

        board = store.get_board(board_id)

        self.assertEqual(board["selection"], ["item_a"])
        self.assertEqual(len(board["groups"]), 2)

        first_group = board["groups"][0]
        second_group = board["groups"][1]

        self.assertEqual(first_group["id"], "group_1")
        self.assertEqual(first_group["name"], "Hero Beats")
        self.assertEqual(first_group["color"], "#aabbcc")
        self.assertEqual(first_group["item_ids"], ["item_a"])

        self.assertNotEqual(second_group["id"], "group_1")
        self.assertEqual(second_group["name"], "Collection 2")
        self.assertEqual(second_group["item_ids"], ["item_b"])
        self.assertTrue(second_group["color"].startswith("#"))

    def test_collections_survive_item_deletions_as_empty_groups(self):
        store = self.create_store()
        board_id = "collection-empty-board"

        store.save_board({
            "board_id": board_id,
            "items": [{"id": "item_a", "type": "note", "x": 0, "y": 0, "w": 100, "h": 60, "content": "A"}],
            "selection": ["item_a"],
            "groups": [{"id": "group_1", "name": "Solo", "item_ids": ["item_a"]}],
        }, notify=False)

        store.save_board({
            "board_id": board_id,
            "items": [],
            "selection": ["item_a"],
            "groups": [{"id": "group_1", "name": "Solo", "item_ids": ["item_a"]}],
        }, notify=False)

        board = store.get_board(board_id)
        self.assertEqual(board["selection"], [])
        self.assertEqual(len(board["groups"]), 1)
        self.assertEqual(board["groups"][0]["item_ids"], [])

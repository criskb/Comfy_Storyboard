import unittest
from tempfile import TemporaryDirectory

from nodes.storyboard_nodes import Storyboard
from nodes.storyboard_store import StoryboardStore
import nodes.storyboard_nodes as storyboard_nodes_module


class StoryboardNodeOutputsTest(unittest.TestCase):
    def setUp(self):
        self.tempdir = TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.original_store = storyboard_nodes_module.store
        storyboard_nodes_module.store = StoryboardStore(self.tempdir.name)
        self.addCleanup(self.restore_store)

    def restore_store(self):
        storyboard_nodes_module.store = self.original_store

    def test_process_returns_prompt_text_alongside_conditioning(self):
        board_id = "prompt-board"
        storyboard_nodes_module.store.save_board({
            "board_id": board_id,
            "items": [],
            "selection": [],
        }, notify=False)

        result = Storyboard().process(board_id=board_id, prompt="test prompt", clip=None)

        self.assertEqual(len(result), len(Storyboard.RETURN_TYPES))
        self.assertEqual(result[7], "test prompt")
        self.assertIsNone(result[6])


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
            from server import PromptServer
            PromptServer.instance.send_sync("storyboard/update", {"board_id": board_id})
        
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

# Global instance
STORYBOARD_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "storyboards")
store = StoryboardStore(STORYBOARD_DATA_PATH)

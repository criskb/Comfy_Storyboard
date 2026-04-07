import os
import sys

# Add the current directory to sys.path so we can import from 'nodes'
sys.path.append(os.path.dirname(__file__))

from nodes.storyboard_nodes import Storyboard, StoryboardSend, StoryboardRead, StoryboardSlot
import nodes.storyboard_api # Register API routes

NODE_CLASS_MAPPINGS = {
    "Storyboard": Storyboard,
    "StoryboardSend": StoryboardSend,
    "StoryboardRead": StoryboardRead,
    "StoryboardSlot": StoryboardSlot
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Storyboard": "🎨 Storyboard Workspace",
    "StoryboardSend": "🎨 Storyboard Send",
    "StoryboardRead": "🎨 Storyboard Read",
    "StoryboardSlot": "🎨 Storyboard Slot"
}

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

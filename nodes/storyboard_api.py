import os
import json
import uuid
import aiohttp
from aiohttp import web
from PIL import Image
from server import PromptServer
from .storyboard_store import store

class StoryboardAPI:
    @staticmethod
    def register_routes():
        server = PromptServer.instance
        
        @server.routes.get("/mkr/storyboard/{board_id}")
        async def get_board(request):
            board_id = request.match_info["board_id"]
            board_data = store.get_board(board_id)
            return web.json_response(board_data)

        @server.routes.post("/mkr/storyboard/{board_id}/items")
        async def post_items(request):
            board_id = request.match_info["board_id"]
            data = await request.json()
            notify = data.pop("notify", True)
            store.save_board(data, notify=notify)
            return web.json_response({"status": "ok"})

        @server.routes.post("/mkr/storyboard/{board_id}/fill")
        async def fill_placeholder(request):
            board_id = request.match_info["board_id"]
            data = await request.json()
            # Logic to fill a placeholder with an image/data
            return web.json_response({"status": "ok"})

        @server.routes.post("/mkr/storyboard/{board_id}/select")
        async def select_items(request):
            board_id = request.match_info["board_id"]
            data = await request.json()
            # Logic to update selection state
            return web.json_response({"status": "ok"})

        @server.routes.get("/mkr/storyboard/{board_id}/export")
        async def export_board(request):
            board_id = request.match_info["board_id"]
            # Logic to export the board as a single image or manifest
            return web.json_response({"status": "ok"})

        @server.routes.get("/mkr/storyboard/{board_id}/selected")
        async def get_selected(request):
            board_id = request.match_info["board_id"]
            # Logic to get currently selected items/data
            return web.json_response({"items": []})

        @server.routes.post("/mkr/storyboard/{board_id}/upload")
        async def upload_asset(request):
            board_id = request.match_info["board_id"]
            post = await request.post()
            image = post.get("image")
            
            if image:
                filename = store.add_asset(board_id, Image.open(image.file))
                return web.json_response({"filename": filename})
            
            return web.Response(status=400)

        @server.routes.get("/mkr/storyboard/asset/{board_id}/{filename}")
        async def get_asset(request):
            board_id = request.match_info["board_id"]
            filename = request.match_info["filename"]
            
            assets_path = store._get_assets_path(board_id)
            full_path = os.path.join(assets_path, filename)
            
            if os.path.exists(full_path):
                return web.FileResponse(full_path)
            else:
                return web.Response(status=404)

# Automatically register routes when imported
StoryboardAPI.register_routes()

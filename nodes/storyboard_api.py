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
        
        @server.routes.get("/mkr/storyboard/list")
        async def list_boards(request):
            boards = store.list_boards()
            return web.json_response({"boards": boards})

        @server.routes.delete("/mkr/storyboard/{board_id}")
        async def delete_board(request):
            board_id = request.match_info["board_id"]
            success = store.delete_board(board_id)
            return web.json_response({"status": "ok" if success else "error"})

        @server.routes.post("/mkr/storyboard/{old_id}/rename/{new_id}")
        async def rename_board(request):
            old_id = request.match_info["old_id"]
            new_id = request.match_info["new_id"]
            success = store.rename_board(old_id, new_id)
            return web.json_response({"status": "ok" if success else "error"})

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

        @server.routes.post("/mkr/storyboard/{board_id}/flatten/{frame_id}")
        async def flatten_frame(request):
            board_id = request.match_info["board_id"]
            frame_id = request.match_info["frame_id"]
            filename = store.flatten_frame(board_id, frame_id)
            if filename:
                return web.json_response({"status": "ok", "filename": filename})
            return web.json_response({"status": "error"}, status=400)

        @server.routes.get("/mkr/storyboard/{board_id}/palette/{frame_id}")
        async def get_frame_palette(request):
            board_id = request.match_info["board_id"]
            frame_id = request.match_info["frame_id"]
            num_colors = int(request.query.get("num_colors", 8))
            num_colors = max(4, min(16, num_colors))
            colors = store.get_frame_palette(board_id, frame_id, num_colors=num_colors)
            return web.json_response({"colors": colors})

        @server.routes.get("/mkr/storyboard/{board_id}/palette/image/{item_id}")
        async def get_image_palette(request):
            board_id = request.match_info["board_id"]
            item_id = request.match_info["item_id"]
            num_colors = int(request.query.get("num_colors", 8))
            num_colors = max(4, min(16, num_colors))
            result = store.get_image_palette(board_id, item_id, num_colors=num_colors)
            return web.json_response(result)

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
            asset = post.get("asset")
            
            if image:
                pil_image = Image.open(image.file)
                width, height = pil_image.size
                filename = store.add_asset(board_id, pil_image)
                return web.json_response({"filename": filename, "width": width, "height": height, "kind": "image"})
            if asset and getattr(asset, "file", None):
                content_type = (getattr(asset, "content_type", "") or "").lower()
                if content_type.startswith("image/"):
                    pil_image = Image.open(asset.file)
                    width, height = pil_image.size
                    filename = store.add_asset(board_id, pil_image)
                    return web.json_response({"filename": filename, "width": width, "height": height, "kind": "image"})
                if content_type.startswith("video/"):
                    ext = os.path.splitext(getattr(asset, "filename", "") or "")[1].lower() or ".mp4"
                    filename = store.add_video_asset(board_id, asset.file.name, filename=f"{uuid.uuid4()}{ext}")
                    return web.json_response({"filename": filename, "kind": "video"})
            
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

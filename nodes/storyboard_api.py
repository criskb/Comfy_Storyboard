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

        @server.routes.post("/mkr/storyboard/{board_id}/duplicate/{new_id}")
        async def duplicate_board(request):
            board_id = request.match_info["board_id"]
            new_id = request.match_info["new_id"]
            success = store.duplicate_board(board_id, new_id)
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
            board_data = store.get_board(board_id)
            requested_selection = data.get("selection") or data.get("item_ids") or []
            valid_ids = {
                item.get("id")
                for item in board_data.get("items", [])
                if isinstance(item, dict) and item.get("id")
            }
            board_data["selection"] = [
                item_id
                for item_id in requested_selection
                if item_id in valid_ids
            ]
            store.save_board(board_data, notify=bool(data.get("notify", False)))
            return web.json_response({"status": "ok", "selection": board_data["selection"]})

        @server.routes.get("/mkr/storyboard/{board_id}/export")
        async def export_board(request):
            board_id = request.match_info["board_id"]
            selection_only = str(request.query.get("selection_only", "")).lower() in {"1", "true", "yes"}
            item_ids = None
            if selection_only:
                item_ids = store.get_board(board_id).get("selection", [])
            package = store.export_board_package(board_id, item_ids=item_ids)
            return web.json_response(package)

        @server.routes.get("/mkr/storyboard/{board_id}/selected")
        async def get_selected(request):
            board_id = request.match_info["board_id"]
            items = store.get_selected_items(board_id)
            return web.json_response({
                "board_id": board_id,
                "selection": [item.get("id") for item in items if item.get("id")],
                "items": items,
            })

        @server.routes.post("/mkr/storyboard/import")
        async def import_board(request):
            payload = await request.json()
            package_data = payload.get("package") if isinstance(payload, dict) and "package" in payload else payload
            board_id = payload.get("board_id") if isinstance(payload, dict) else None
            try:
                result = store.import_board_package(package_data, board_id=board_id)
            except ValueError as exc:
                return web.json_response({"status": "error", "error": str(exc)}, status=400)
            return web.json_response({"status": "ok", **result})

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

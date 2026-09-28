"""Handle the authenticated websocket endpoint and basic JSON messages.

Edit this file when websocket auth, message types, or connection flow changes.
Copy the route pattern here when you add another websocket endpoint.
"""

from __future__ import annotations

import json
import logging

from aiohttp import WSMsgType, web

from backend.auth.access import require_user
from backend.http.middleware import require_allowed_origin

LOGGER = logging.getLogger("backend.ws")


async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
    require_allowed_origin(request)
    user = require_user(request)
    ws = web.WebSocketResponse(heartbeat=30.0)
    await ws.prepare(request)

    hub = request.app["ws_hub"]
    hub.add(user["id"], ws)
    LOGGER.info("WebSocket connected user=%s connections=%s", user["id"], hub.count_for_user(user["id"]))
    await ws.send_json({"type": "ws.ready", "user_id": user["id"], "connections": hub.count_for_user(user["id"])})

    try:
        async for message in ws:
            if message.type != WSMsgType.TEXT:
                continue
            try:
                data = json.loads(message.data)
            except json.JSONDecodeError:
                LOGGER.info("WebSocket bad JSON user=%s", user["id"])
                await ws.send_json({"type": "error", "code": "bad_request", "message": "WebSocket message must be valid JSON."})
                continue
            if not isinstance(data, dict):
                LOGGER.info("WebSocket bad message shape user=%s", user["id"])
                await ws.send_json({"type": "error", "code": "bad_request", "message": "WebSocket message must be an object."})
                continue
            message_type = data.get("type")
            if message_type == "ping":
                await ws.send_json({"type": "pong"})
    finally:
        hub.remove(user["id"], ws)
        LOGGER.info("WebSocket disconnected user=%s connections=%s", user["id"], hub.count_for_user(user["id"]))

    return ws


def setup_ws_routes(app: web.Application) -> None:
    app.router.add_get("/ws", websocket_handler)

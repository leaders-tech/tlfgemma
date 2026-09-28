"""Stream private chat events over WebSocket. Edit for socket behavior; copy for new socket endpoints."""

import asyncio
from datetime import datetime
from aiohttp import web, WSMsgType
from backend.auth.access import require_user
from backend.db.store import now
from backend.http.middleware import require_allowed_origin


async def websocket_handler(request):
    require_allowed_origin(request)
    user = await require_user(request)
    token = request.cookies[request.app["settings"].session_cookie_name]
    ws = web.WebSocketResponse(heartbeat=30, max_msg_size=4096)
    await ws.prepare(request)
    hub = request.app["ws_hub"]
    hub.add(user["id"], token, ws)
    # Recheck after registration so logout cannot race the handshake.
    if not await request.app["store"].session(token):
        hub.remove(ws)
        await ws.close(code=1008)
        return ws

    async def expire():
        await asyncio.sleep(max(0, (datetime.fromisoformat(user["expires_at"]) - now()).total_seconds()))
        await ws.close(code=1008, message=b"Session expired")

    timer = asyncio.create_task(expire())
    try:
        await ws.send_json({"type": "ws.ready"})
        async for message in ws:
            if message.type == WSMsgType.TEXT:
                await ws.send_json({"type": "pong"})
    finally:
        timer.cancel()
        await asyncio.gather(timer, return_exceptions=True)
        hub.remove(ws)
    return ws


def setup_ws_routes(app):
    app.router.add_get("/ws", websocket_handler)

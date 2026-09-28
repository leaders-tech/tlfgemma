"""Test private streaming and socket lifecycle. Edit for socket changes; copy for more realtime scenarios."""

import asyncio
from uuid import uuid4
import pytest
from aiohttp import WSServerHandshakeError, WSMsgType


async def test_websocket_requires_login(client):
    with pytest.raises(WSServerHandshakeError) as error:
        await client.ws_connect("/ws")
    assert error.value.status == 401


async def test_websocket_rejects_wrong_origin(client, identity):
    _, headers = await identity()
    with pytest.raises(WSServerHandshakeError) as error:
        await client.ws_connect("/ws", headers={**headers, "Origin": "https://evil.example"})
    assert error.value.status == 403


async def test_stream_reconnect_and_logout(client, identity, app):
    user, headers = await identity()
    ws = await client.ws_connect("/ws", headers=headers)
    assert (await ws.receive_json())["type"] == "ws.ready"
    await client.post("/api/chat/send", headers=headers, json={"text": "slow", "request_id": str(uuid4())})
    event = await ws.receive_json()
    assert event["type"] == "chat.updated" and event["message"]["answer"]
    await ws.close()
    await asyncio.gather(*list(app["generations"].values()))
    ws = await client.ws_connect("/ws", headers=headers)
    assert (await ws.receive_json())["type"] == "ws.ready"
    history = await client.post("/api/chat/history", headers=headers, json={})
    assert (await history.json())["data"]["messages"][-1]["status"] == "complete"
    await client.post("/api/auth/logout", headers=headers, json={})
    assert (await ws.receive()).type in {WSMsgType.CLOSE, WSMsgType.CLOSED}


async def test_events_are_private(client, identity, app):
    student, sh = await identity()
    other, oh = await identity("other@example.org")
    ws = await client.ws_connect("/ws", headers=oh)
    await ws.receive_json()
    await client.post("/api/chat/send", headers=sh, json={"text": "hello", "request_id": str(uuid4())})
    await asyncio.gather(*list(app["generations"].values()))
    await ws.send_str('{"type":"ping"}')
    assert (await ws.receive_json()) == {"type": "pong"}
    await ws.close()

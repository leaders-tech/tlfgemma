"""Test shared model selection and immutable per-request models. Edit for model behavior; copy for other admin settings."""

import asyncio
from uuid import uuid4
import pytest
from backend.db.model_settings import DEFAULT_MODEL
from backend.db.connection import open_db
from backend.db.store import Store

OTHER_MODEL = "google/gemma-4-31b-it"


async def test_default_and_access(client, identity):
    assert (await client.post("/api/chat/model", json={})).status == 401
    for roles in [[], ["teacher"]]:
        _, headers = await identity("user" + str(roles) + "@example.org", roles)
        response = await client.post("/api/chat/model", json={}, headers=headers)
        assert (await response.json())["data"] == {"model": DEFAULT_MODEL, "default_model": DEFAULT_MODEL}
        assert (await client.post("/api/admin/model", json={"model": OTHER_MODEL}, headers=headers)).status == 403


@pytest.mark.parametrize("model", ["", " ", "bad model", "no-provider", "/model", "provider/", None, 42, "x/" + "y" * 200])
async def test_rejects_invalid_selection(client, identity, app, model):
    _, headers = await identity("admin@example.org", ["admin"])
    response = await client.post("/api/admin/model", json={"model": model}, headers=headers)
    assert response.status == 400
    assert await app["store"].model() == DEFAULT_MODEL


async def test_saved_model_survives_new_connection_and_history_reset(client, identity, app):
    _, headers = await identity("admin@example.org", ["admin"])
    response = await client.post("/api/admin/model", json={"model": " " + OTHER_MODEL + " "}, headers=headers)
    assert response.status == 200
    db = await open_db(app["settings"].db_path)
    try:
        assert await Store(db).model() == OTHER_MODEL
    finally:
        await db.close()
    await client.post("/api/admin/clear", json={"confirm": "CLEAR ALL HISTORY"}, headers=headers)
    assert await app["store"].model() == OTHER_MODEL
    await client.post("/api/admin/model", json={"model": DEFAULT_MODEL}, headers=headers)
    assert await app["store"].model() == DEFAULT_MODEL


async def test_switch_keeps_active_and_idempotent_requests_on_original_model(client, identity, app, provider):
    user, student = await identity()
    _, admin = await identity("admin@example.org", ["admin"])
    request_id = str(uuid4())
    response = await client.post("/api/chat/send", headers=student, json={"text": "slow", "request_id": request_id, "model": OTHER_MODEL})
    original = (await response.json())["data"]["message"]
    assert original["model"] == DEFAULT_MODEL
    await client.post("/api/admin/model", headers=admin, json={"model": OTHER_MODEL})
    await asyncio.gather(*list(app["generations"].values()))
    assert provider.requests[0]["model"] == DEFAULT_MODEL
    replay = await client.post("/api/chat/send", headers=student, json={"text": "slow", "request_id": request_id})
    assert (await replay.json())["data"]["message"]["model"] == DEFAULT_MODEL
    assert len(provider.requests) == 1
    await client.post("/api/chat/send", headers=student, json={"text": "hello", "request_id": str(uuid4())})
    await asyncio.gather(*list(app["generations"].values()))
    assert provider.requests[-1]["model"] == OTHER_MODEL
    assert all(item["reasoning"] == {"enabled": False} for item in provider.requests)
    assert [row["model"] for row in (await app["store"].history(user["id"]))["messages"]] == [DEFAULT_MODEL, OTHER_MODEL]


async def test_model_changes_broadcast_to_signed_in_users(client, identity):
    _, student = await identity()
    _, admin = await identity("admin@example.org", ["admin"])
    ws = await client.ws_connect("/ws", headers=student)
    await ws.receive_json()
    await client.post("/api/admin/model", headers=admin, json={"model": OTHER_MODEL})
    assert await ws.receive_json() == {"type": "model.changed", "model": OTHER_MODEL}
    await ws.close()

"""Test the chat behavior replacing template notes. Edit for chat rules; copy cases for new API behavior."""

import asyncio
from datetime import timedelta
from uuid import uuid4
import pytest
from backend.db.store import now
from backend.http.json_api import AppError


async def send(client, headers, text="hello", request_id=None):
    return await client.post("/api/chat/send", headers=headers, json={"text": text, "request_id": request_id or str(uuid4())})


async def finish(app):
    await asyncio.gather(*list(app["generations"].values()))


async def test_independent_prompts_and_history(client, identity, app, provider):
    user, headers = await identity()
    for prompt in ["hello", "second"]:
        assert (await send(client, headers, prompt)).status == 202
        await finish(app)
    assert len(provider.requests) == 2
    assert provider.requests[-1]["messages"] == [{"role": "user", "content": "second"}]
    assert provider.requests[-1]["model"] == "google/gemma-4-26b-a4b-it"
    assert provider.requests[-1]["reasoning"] == {"enabled": False}
    rows = (await app["store"].history(user["id"]))["messages"]
    assert len(rows) == 2 and all(r["status"] == "complete" for r in rows)
    assert (await app["store"].quota(user["id"]))["remaining"] == 58


@pytest.mark.parametrize("text", ["", " ", "x" * 1001, "🦊" * 1001, None, 42])
async def test_invalid_input(client, identity, text):
    _, headers = await identity()
    assert (await send(client, headers, text)).status == 400


async def test_unicode_boundaries_and_truncation(client, identity, app):
    user, headers = await identity()
    assert (await send(client, headers, "🦊" * 1000)).status == 202
    await finish(app)
    assert (await send(client, headers, "long")).status == 202
    await finish(app)
    last = (await app["store"].history(user["id"]))["messages"][-1]
    assert last["answer"] == "🦊" * 1000 and last["truncated"] == 1


async def test_errors_refund_only_empty_answers(client, identity, app):
    user, headers = await identity()
    for text, remaining in [("fail", 60), ("partial", 59)]:
        await send(client, headers, text)
        await finish(app)
        assert (await app["store"].quota(user["id"]))["remaining"] == remaining
        assert (await app["store"].history(user["id"]))["messages"][-1]["status"] == "error"


async def test_idempotency_and_concurrency(client, identity, app, provider):
    user, headers = await identity()
    request_id = str(uuid4())
    responses = await asyncio.gather(send(client, headers, "slow", request_id), send(client, headers, "slow", request_id), send(client, headers, "different"))
    assert sorted(r.status for r in responses) == [200, 202, 409]
    assert (await send(client, headers, "changed", request_id)).status == 409
    await finish(app)
    assert (await send(client, headers, "slow", request_id)).status == 200
    assert len(provider.requests) == 1


async def test_rolling_quota_and_exact_boundary(client, identity, app, monkeypatch):
    user, _ = await identity()
    at = now()
    monkeypatch.setattr("backend.db.store.now", lambda: at)
    store = app["store"]
    for i in range(60):
        row, _ = await store.reserve(user["id"], str(uuid4()), "hello")
        await store.update(row["id"], "ok", "complete")
    with pytest.raises(AppError) as error:
        await store.reserve(user["id"], str(uuid4()), "hello")
    assert error.value.status == 429
    monkeypatch.setattr("backend.db.store.now", lambda: at + timedelta(hours=1))
    assert (await store.quota(user["id"]))["remaining"] == 60
    assert (await store.history(user["id"]))["before"] is not None
    first = await store.history(user["id"])
    older = await store.history(user["id"], first["before"])
    assert len(first["messages"]) + len(older["messages"]) == 60


async def test_access_review_and_clear(client, identity, app):
    student, sh = await identity()
    other, oh = await identity("other@example.org")
    teacher, th = await identity("teacher@example.org", ["teacher"])
    admin, ah = await identity("admin@example.org", ["admin"])
    await send(client, sh, "slow")
    await asyncio.sleep(0.15)
    assert (await client.post("/api/chat/history", json={"user_id": student["id"]}, headers=oh)).status == 403
    assert (await client.post("/api/chat/history", json={"user_id": student["id"]}, headers=th)).status == 200
    assert (await client.post("/api/review/users", json={}, headers=sh)).status == 403
    assert (await client.post("/api/admin/clear", json={"confirm": "CLEAR ALL HISTORY"}, headers=th)).status == 403
    assert (await client.post("/api/admin/clear", json={}, headers=ah)).status == 400
    assert (await client.post("/api/admin/clear", json={"confirm": "CLEAR ALL HISTORY"}, headers=ah)).status == 200
    await asyncio.sleep(0.1)
    assert not app["generations"]
    assert (await app["store"].history(student["id"]))["messages"] == []
    assert (await app["store"].quota(student["id"]))["remaining"] == 60
    assert (await client.post("/api/auth/me", json={}, headers=sh)).status == 200


async def test_recovery_preserves_partial_and_refunds_empty(client, identity, app):
    user, _ = await identity()
    store = app["store"]
    row, _ = await store.reserve(user["id"], str(uuid4()), "hello")
    await store.recover()
    assert (await store.quota(user["id"]))["remaining"] == 60
    row, _ = await store.reserve(user["id"], str(uuid4()), "hello")
    await store.update(row["id"], "partial", "streaming")
    await store.recover()
    assert (await store.quota(user["id"]))["remaining"] == 59
    assert (await store.history(user["id"]))["messages"][-1]["status"] == "interrupted"

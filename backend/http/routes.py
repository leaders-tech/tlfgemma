"""Expose chat, review and reset endpoints. Edit for API behavior; copy route patterns for new features."""

import asyncio
from uuid import UUID
from backend.auth.access import require_user, require_reviewer, require_admin, can_review
from backend.chat import generate, stop_generations
from backend.http.json_api import AppError, ok, read_json


async def health(request):
    return ok({"status": "ok"})


async def send(request):
    user = await require_user(request)
    data = await read_json(request)
    prompt, request_id = data.get("text"), data.get("request_id")
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 1000:
        raise AppError(400, "invalid_message", "Write a message between 1 and 1000 characters.")
    try:
        request_id = str(UUID(request_id))
    except ValueError, TypeError, AttributeError:
        raise AppError(400, "invalid_request_id", "A valid request ID is required.") from None
    if not request.app["settings"].openrouter_api_key:
        raise AppError(503, "model_not_configured", "The model is not configured yet.")
    async with request.app["operations"]:
        row, created = await request.app["store"].reserve(user["id"], request_id, prompt, integer(data, "conversation_id"))
        if created:
            task = asyncio.create_task(generate(request.app, row))
            request.app["generations"][row["id"]] = task

            def finished(done):
                request.app["generations"].pop(row["id"], None)
                if not done.cancelled():
                    done.exception()

            task.add_done_callback(finished)
        quota = await request.app["store"].quota(user["id"])
    return ok({"message": row, "quota": quota}, 202 if created else 200)


def integer(data, key, default=None):
    value = data.get(key, default)
    if value is not None and (type(value) is not int or value < 1):
        raise AppError(400, "invalid_cursor", "Invalid user or page ID.")
    return value


async def history(request):
    user = await require_user(request)
    data = await read_json(request)
    target = integer(data, "user_id", user["id"])
    if target != user["id"] and not can_review(user):
        raise AppError(403, "not_allowed", "You can only read your own chat.")
    return ok(await request.app["store"].history(target, integer(data, "before"), integer(data, "conversation_id")))


async def quota(request):
    user = await require_user(request)
    return ok(await request.app["store"].quota(user["id"]))


async def users(request):
    await require_reviewer(request)
    data = await read_json(request)
    search = data.get("search", "")
    if not isinstance(search, str) or len(search) > 320:
        raise AppError(400, "bad_request", "Invalid email search.")
    return ok(await request.app["store"].users(search, integer(data, "after") or 0))


async def clear(request):
    await require_admin(request)
    data = await read_json(request)
    if data.get("confirm") != "CLEAR ALL HISTORY":
        raise AppError(400, "confirmation_required", "Confirm clearing all history.")
    async with request.app["operations"]:
        await stop_generations(request.app)
        await request.app["store"].clear()
        await request.app["ws_hub"].broadcast({"type": "history.cleared"})
    return ok({"cleared": True})


def setup_api_routes(app):
    app.router.add_get("/api/health", health)
    for path, handler in [("/chat/send", send), ("/chat/history", history), ("/chat/quota", quota), ("/review/users", users), ("/admin/clear", clear)]:
        app.router.add_post("/api" + path, handler)

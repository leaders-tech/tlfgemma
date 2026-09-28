"""Expose the current model and admin changes. Edit for model-setting API behavior; copy for another settings route."""

import re
from backend.auth.access import require_user, require_admin
from backend.db.model_settings import DEFAULT_MODEL
from backend.http.json_api import AppError, ok, read_json


async def current_model(request):
    await require_user(request)
    return ok({"model": await request.app["store"].model(), "default_model": DEFAULT_MODEL})


async def change_model(request):
    await require_admin(request)
    payload = await read_json(request)
    model = payload.get("model")
    if not isinstance(model, str):
        raise AppError(400, "invalid_model", "Enter an OpenRouter model ID, such as google/gemma-4-26b-a4b-it.")
    model = model.strip()
    if len(model) > 200 or not re.fullmatch(r"[a-zA-Z0-9_-]+/[a-zA-Z0-9][a-zA-Z0-9._:/-]*", model):
        raise AppError(400, "invalid_model", "Enter a valid OpenRouter model ID (provider/model).")
    async with request.app["operations"]:
        await request.app["store"].set_model(model)
        await request.app["ws_hub"].broadcast({"type": "model.changed", "model": model})
    return ok({"model": model, "default_model": DEFAULT_MODEL})


def setup_model_routes(app):
    app.router.add_post("/api/chat/model", current_model)
    app.router.add_post("/api/admin/model", change_model)

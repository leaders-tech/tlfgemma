"""Expose owned conversations and staff read access. Edit for conversation endpoints; copy route patterns."""
from backend.auth.access import require_user, can_review
from backend.http.json_api import AppError, ok, read_json
from backend.http.routes import integer


async def listing(request):
    user = await require_user(request)
    data = await read_json(request)
    target = integer(data, "user_id", user["id"])
    if target != user["id"] and not can_review(user):
        raise AppError(403, "not_allowed", "You can only read your own chats.")
    return ok({"conversations": await request.app["store"].conversations(target)})


async def change(request):
    user = await require_user(request)
    data = await read_json(request)
    async with request.app["operations"]:
        if request.path.endswith("/create"):
            row = await request.app["store"].create_conversation(user["id"])
        else:
            conversation_id = integer(data, "conversation_id")
            if conversation_id is None or type(data.get("archived")) is not bool:
                raise AppError(400, "invalid_conversation", "Choose a conversation and archive state.")
            await request.app["store"].archive_conversation(user["id"], conversation_id, data["archived"])
            row = None
        await request.app["ws_hub"].send_to_user(user["id"], {"type": "conversations.changed"})
    return ok({"conversation": row})


def setup_conversation_routes(app):
    app.router.add_post("/api/conversations/list", listing)
    app.router.add_post("/api/conversations/create", change)
    app.router.add_post("/api/conversations/archive", change)

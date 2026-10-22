"""Persist conversation lists and archives. Edit for conversation rules; copy for similar owned resources."""
from backend.http.json_api import AppError


async def require_conversation(store, user_id, conversation_id):
    row = await store.one("SELECT * FROM conversations WHERE id=? AND user_id=?", (conversation_id, user_id))
    if not row:
        raise AppError(404, "not_found", "Conversation not found.")
    return dict(row)


async def create(store, user_id, timestamp):
    cursor = await store.db.execute("INSERT INTO conversations(user_id,created_at) VALUES (?,?)", (user_id, timestamp))
    return await require_conversation(store, user_id, cursor.lastrowid)


async def listing(store, user_id):
    async with store.db.execute("SELECT * FROM conversations WHERE user_id=? ORDER BY id DESC", (user_id,)) as cursor:
        return [dict(row) for row in await cursor.fetchall()]


async def archive(store, user_id, conversation_id, archived):
    await require_conversation(store, user_id, conversation_id)
    await store.db.execute("UPDATE conversations SET archived=? WHERE id=?", (int(archived), conversation_id))

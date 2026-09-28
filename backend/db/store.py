"""Store identities, sessions and chat history. Edit for persistence rules; copy query patterns for new features."""

import asyncio
import hashlib
import json
from datetime import UTC, datetime, timedelta
from backend.http.json_api import AppError
from backend.db.model_settings import read_model, save_model


def now():
    return datetime.now(UTC)


def stamp(value=None):
    return (value or now()).isoformat(timespec="microseconds")


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def user_dict(row):
    return {"id": row["id"], "email": row["email"], "roles": json.loads(row["roles"])}


class Store:
    def __init__(self, db):
        self.db = db
        self.lock = asyncio.Lock()

    async def one(self, sql, params=()):
        async with self.db.execute(sql, params) as cursor:
            return await cursor.fetchone()

    async def identity(self, subject, email, roles):
        async with self.lock:
            await self.db.execute(
                "INSERT INTO users(subject,email,roles,created_at) VALUES (?,?,?,?) ON CONFLICT(subject) DO UPDATE SET email=excluded.email,roles=excluded.roles",
                (subject, email, json.dumps(roles), stamp()),
            )
            await self.db.commit()
            return user_dict(await self.one("SELECT * FROM users WHERE subject=?", (subject,)))

    async def create_session(self, token, user_id):
        async with self.lock:
            await self.db.execute("DELETE FROM sessions WHERE expires_at<=?", (stamp(),))
            await self.db.execute("INSERT INTO sessions VALUES (?,?,?)", (digest(token), user_id, stamp(now() + timedelta(hours=12))))
            await self.db.commit()

    async def session(self, token):
        async with self.lock:
            row = await self.one(
                "SELECT users.*,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?",
                (digest(token), stamp()),
            )
            return {**user_dict(row), "expires_at": row["expires_at"]} if row else None

    async def logout(self, token):
        async with self.lock:
            await self.db.execute("DELETE FROM sessions WHERE token_hash=?", (digest(token),))
            await self.db.commit()

    async def save_state(self, state, binding, nonce):
        async with self.lock:
            await self.db.execute("DELETE FROM oauth_states WHERE expires_at<=?", (stamp(),))
            await self.db.execute("INSERT INTO oauth_states VALUES (?,?,?,?)", (state, digest(binding), nonce, stamp(now() + timedelta(minutes=10))))
            await self.db.commit()

    async def take_state(self, state, binding):
        async with self.lock:
            row = await self.one("SELECT * FROM oauth_states WHERE state=? AND binding_hash=? AND expires_at>?", (state, digest(binding), stamp()))
            if row:
                await self.db.execute("DELETE FROM oauth_states WHERE state=?", (state,))
                await self.db.commit()
            return dict(row) if row else None

    async def _quota(self, user_id, at):
        row = await self.one(
            "SELECT count(*) AS used,min(created_at) AS oldest FROM exchanges WHERE user_id=? AND counted=1 AND created_at>?",
            (user_id, stamp(at - timedelta(hours=1))),
        )
        return {
            "remaining": max(0, 60 - row["used"]),
            "next_available_at": stamp(datetime.fromisoformat(row["oldest"]) + timedelta(hours=1)) if row["oldest"] else None,
            "server_time": stamp(at),
        }

    async def quota(self, user_id):
        async with self.lock:
            return await self._quota(user_id, now())

    async def model(self):
        async with self.lock:
            return await read_model(self.db)

    async def set_model(self, model):
        async with self.lock:
            await save_model(self.db, model)

    async def reserve(self, user_id, request_id, prompt):
        async with self.lock:
            await self.db.execute("BEGIN IMMEDIATE")
            try:
                existing = await self.one("SELECT * FROM exchanges WHERE user_id=? AND request_id=?", (user_id, request_id))
                if existing:
                    if existing["prompt"] != prompt:
                        raise AppError(409, "request_conflict", "This request ID already has a different message.")
                    await self.db.commit()
                    return dict(existing), False
                if await self.one("SELECT id FROM exchanges WHERE user_id=? AND status='streaming'", (user_id,)):
                    raise AppError(409, "busy", "Please wait for your current answer.")
                at = now()
                if (await self._quota(user_id, at))["remaining"] == 0:
                    raise AppError(429, "rate_limit", "You have used all 60 messages. Please wait.")
                cursor = await self.db.execute(
                    "INSERT INTO exchanges(user_id,request_id,prompt,status,created_at,updated_at,model) VALUES (?,?,?,'streaming',?,?,?)",
                    (user_id, request_id, prompt, stamp(at), stamp(at), await read_model(self.db)),
                )
                row = await self.one("SELECT * FROM exchanges WHERE id=?", (cursor.lastrowid,))
                await self.db.commit()
                return dict(row), True
            except BaseException:
                await self.db.rollback()
                raise

    async def update(self, exchange_id, answer, status, truncated=False, error=None):
        async with self.lock:
            counted = int(bool(answer) or status in {"streaming", "complete"})
            await self.db.execute(
                "UPDATE exchanges SET answer=?,status=?,truncated=?,error=?,counted=?,version=version+1,updated_at=? WHERE id=?",
                (answer, status, int(truncated), error, counted, stamp(), exchange_id),
            )
            await self.db.commit()
            row = await self.one("SELECT * FROM exchanges WHERE id=?", (exchange_id,))
            return dict(row) if row else None

    async def recover(self):
        async with self.lock:
            await self.db.execute(
                "UPDATE exchanges SET status='interrupted',error='Server restarted before the answer finished.',counted=CASE WHEN answer='' THEN 0 ELSE 1 END,version=version+1,updated_at=? WHERE status='streaming'",
                (stamp(),),
            )
            await self.db.commit()

    async def history(self, user_id, before=None):
        async with self.lock:
            async with self.db.execute(
                "SELECT * FROM exchanges WHERE user_id=? AND (? IS NULL OR id<?) ORDER BY id DESC LIMIT 51", (user_id, before, before)
            ) as cursor:
                rows = [dict(row) for row in await cursor.fetchall()]
            return {"messages": list(reversed(rows[:50])), "before": rows[49]["id"] if len(rows) > 50 else None}

    async def users(self, search, before=0):
        async with self.lock:
            async with self.db.execute("SELECT * FROM users WHERE instr(lower(email),lower(?))>0 AND id>? ORDER BY id LIMIT 51", (search, before)) as cursor:
                rows = await cursor.fetchall()
            return {"users": [user_dict(r) for r in rows[:50]], "after": rows[49]["id"] if len(rows) > 50 else None}

    async def clear(self):
        async with self.lock:
            await self.db.execute("DELETE FROM exchanges")
            await self.db.commit()

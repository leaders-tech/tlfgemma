"""Create Gemma tables. Edit before first deployment; copy for later schema migrations."""

from yoyo import step

steps = [
    step("""
CREATE TABLE users (
 id INTEGER PRIMARY KEY, subject TEXT NOT NULL UNIQUE, email TEXT NOT NULL,
 roles TEXT NOT NULL, created_at TEXT NOT NULL
) STRICT;
"""),
    step("""
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL
) STRICT;
"""),
    step("""
CREATE TABLE oauth_states (
 state TEXT PRIMARY KEY, binding_hash TEXT NOT NULL, nonce TEXT NOT NULL, expires_at TEXT NOT NULL
) STRICT;
"""),
    step("""
CREATE TABLE exchanges (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
 request_id TEXT NOT NULL, prompt TEXT NOT NULL, answer TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('streaming','complete','error','interrupted')),
 error TEXT, truncated INTEGER NOT NULL DEFAULT 0 CHECK(truncated IN (0,1)),
 counted INTEGER NOT NULL DEFAULT 1 CHECK(counted IN (0,1)), version INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id, request_id)
) STRICT;
"""),
    step("CREATE INDEX exchanges_quota ON exchanges(user_id, counted, created_at)"),
    step("CREATE UNIQUE INDEX one_active ON exchanges(user_id) WHERE status='streaming'"),
]

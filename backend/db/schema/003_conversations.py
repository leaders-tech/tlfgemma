"""Group existing and future messages into conversations. Copy for later migrations; never edit after deployment."""
from yoyo import step

__depends__ = {"002_model_settings"}
steps = [
    step("CREATE TABLE conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL DEFAULT 'New chat', archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL) STRICT"),
    step("INSERT INTO conversations(user_id,title,created_at) SELECT user_id,'Previous chat',min(created_at) FROM exchanges GROUP BY user_id"),
    step("ALTER TABLE exchanges ADD COLUMN conversation_id INTEGER REFERENCES conversations(id)"),
    step("UPDATE exchanges SET conversation_id=(SELECT id FROM conversations WHERE conversations.user_id=exchanges.user_id)"),
    step("CREATE INDEX exchanges_conversation ON exchanges(conversation_id,id)"),
]

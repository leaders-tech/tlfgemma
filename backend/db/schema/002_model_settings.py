"""Add model selection and record the model used for each exchange. Copy for later migrations; never edit after deployment."""

from yoyo import step

__depends__ = {"001_gemma"}
steps = [
    step("CREATE TABLE model_settings (id INTEGER PRIMARY KEY CHECK(id=1), model TEXT NOT NULL) STRICT"),
    # All existing exchanges were made with the former fixed model.
    step("ALTER TABLE exchanges ADD COLUMN model TEXT NOT NULL DEFAULT 'google/gemma-4-31b-it'"),
]

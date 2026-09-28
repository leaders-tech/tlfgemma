"""Read and save the shared model selection. Edit for model defaults; copy for another small app setting."""

DEFAULT_MODEL = "google/gemma-4-26b-a4b-it"


async def read_model(db):
    async with db.execute("SELECT model FROM model_settings WHERE id=1") as cursor:
        row = await cursor.fetchone()
    return row["model"] if row else DEFAULT_MODEL


async def save_model(db, model):
    await db.execute("INSERT INTO model_settings(id,model) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET model=excluded.model", (model,))
    await db.commit()

"""Create a safe agent-only SQLite snapshot from the normal local database.

Edit this file when agent DB copy rules or agent runtime paths change.
Copy this helper pattern when you add another small local data snapshot tool.
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent.parent


def resolve_path(raw_path: str) -> Path:
    path = Path(raw_path).expanduser()
    if not path.is_absolute():
        path = ROOT_DIR / path
    return path


def cleanup_sqlite_sidecars(db_path: Path) -> None:
    for suffix in ("-shm", "-wal"):
        sidecar = Path(f"{db_path}{suffix}")
        if sidecar.exists():
            sidecar.unlink()


def snapshot_database(source_path: Path, target_path: Path) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    if target_path.exists():
        target_path.unlink()
    cleanup_sqlite_sidecars(target_path)

    with sqlite3.connect(source_path) as source_db, sqlite3.connect(target_path) as target_db:
        source_db.backup(target_db)

    cleanup_sqlite_sidecars(target_path)


def reset_target(target_path: Path) -> None:
    if target_path.exists():
        target_path.unlink()
    cleanup_sqlite_sidecars(target_path)
    target_path.parent.mkdir(parents=True, exist_ok=True)


def main() -> int:
    load_dotenv(ROOT_DIR / ".env")
    load_dotenv(ROOT_DIR / ".agent.env")

    source_raw = os.getenv("DB_PATH", "./dev.sqlite3")
    target_raw = os.getenv("AGENT_DB_PATH", ".agent/agent.sqlite3")

    source_path = resolve_path(source_raw)
    target_path = resolve_path(target_raw)

    if source_path.exists():
        snapshot_database(source_path, target_path)
        print(target_path)
        return 0

    reset_target(target_path)
    print(target_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

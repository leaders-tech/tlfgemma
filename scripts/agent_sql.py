"""Run a read-only SQL query against the hidden agent database copy.

Edit this file when agent DB helper behavior or output shape changes.
Copy this helper pattern when you add another tiny read-only local DB tool.
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent.parent
READ_ONLY_PREFIXES = ("select", "with", "pragma", "explain")


def resolve_path(raw_path: str) -> Path:
    path = Path(raw_path).expanduser()
    if not path.is_absolute():
        path = ROOT_DIR / path
    return path


def main() -> int:
    if len(sys.argv) != 2:
        print('Usage: python3 scripts/agent_sql.py "select ..."', file=sys.stderr)
        return 1

    sql = sys.argv[1].strip()
    if not sql.lower().startswith(READ_ONLY_PREFIXES):
        print("Only read-only SQL is allowed here. Use SELECT, WITH, PRAGMA, or EXPLAIN.", file=sys.stderr)
        return 1

    load_dotenv(ROOT_DIR / ".agent.env")
    db_path = resolve_path(os.getenv("AGENT_DB_PATH", ".agent/agent.sqlite3"))
    if not db_path.exists():
        print(f"Agent DB does not exist yet: {db_path}", file=sys.stderr)
        return 1

    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as db:
        db.row_factory = sqlite3.Row
        rows = db.execute(sql).fetchall()

    print(json.dumps([dict(row) for row in rows], indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

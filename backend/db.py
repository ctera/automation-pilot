from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

from backend.models import IntentStatus, Priority, TERMINAL_STATUSES

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS intents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('normal', 'high')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'preparing', 'triggering', 'running',
        'completed', 'failed', 'preempted', 'queued',
        'cancelled', 'stopped'
    )),
    jenkins_build_number INTEGER,
    parameters TEXT,
    source TEXT NOT NULL DEFAULT 'webhook',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intent_id INTEGER REFERENCES intents(id),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    infra_snapshot TEXT,
    outcome TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS infra_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data TEXT NOT NULL
);
"""


def _db_path() -> str:
    return os.environ.get("AUTOPILOT_DB_PATH", "data/autopilot.db")


def get_db() -> sqlite3.Connection:
    path = _db_path()
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = get_db()
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()


def insert_intent(
    conn: sqlite3.Connection,
    *,
    job_id: str,
    priority: Priority,
    parameters: Optional[dict] = None,
    source: str = "webhook",
) -> int:
    cursor = conn.execute(
        """INSERT INTO intents (job_id, priority, parameters, source)
           VALUES (?, ?, ?, ?)""",
        (job_id, priority.value, json.dumps(parameters) if parameters else None, source),
    )
    conn.commit()
    return cursor.lastrowid


def get_intent(conn: sqlite3.Connection, intent_id: int) -> Optional[sqlite3.Row]:
    cursor = conn.execute("SELECT * FROM intents WHERE id = ?", (intent_id,))
    return cursor.fetchone()


def list_intents(
    conn: sqlite3.Connection,
    *,
    exclude_terminal: bool = False,
) -> list[sqlite3.Row]:
    if exclude_terminal:
        placeholders = ",".join("?" for _ in TERMINAL_STATUSES)
        terminal_values = [s.value for s in TERMINAL_STATUSES]
        cursor = conn.execute(
            f"SELECT * FROM intents WHERE status NOT IN ({placeholders}) ORDER BY created_at DESC",
            terminal_values,
        )
    else:
        cursor = conn.execute("SELECT * FROM intents ORDER BY created_at DESC")
    return cursor.fetchall()


def update_intent_status(
    conn: sqlite3.Connection,
    intent_id: int,
    status: IntentStatus,
    *,
    jenkins_build_number: Optional[int] = None,
    notes: Optional[str] = None,
) -> None:
    now = datetime.utcnow().isoformat()
    updates = ["status = ?"]
    values: list = [status.value]

    if status == IntentStatus.RUNNING:
        updates.append("started_at = ?")
        values.append(now)
    if status in TERMINAL_STATUSES:
        updates.append("completed_at = ?")
        values.append(now)
    if jenkins_build_number is not None:
        updates.append("jenkins_build_number = ?")
        values.append(jenkins_build_number)
    if notes is not None:
        updates.append("notes = ?")
        values.append(notes)

    values.append(intent_id)
    conn.execute(
        f"UPDATE intents SET {', '.join(updates)} WHERE id = ?",
        values,
    )
    conn.commit()


def insert_decision(
    conn: sqlite3.Connection,
    *,
    intent_id: int,
    action: str,
    reasoning: str,
    infra_snapshot: Optional[dict] = None,
    outcome: Optional[str] = None,
) -> int:
    cursor = conn.execute(
        """INSERT INTO decisions (intent_id, action, reasoning, infra_snapshot, outcome)
           VALUES (?, ?, ?, ?, ?)""",
        (intent_id, action, reasoning, json.dumps(infra_snapshot) if infra_snapshot else None, outcome),
    )
    conn.commit()
    return cursor.lastrowid


def list_decisions(
    conn: sqlite3.Connection,
    *,
    intent_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[sqlite3.Row]:
    if intent_id is not None:
        cursor = conn.execute(
            "SELECT * FROM decisions WHERE intent_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
            (intent_id, limit, offset),
        )
    else:
        cursor = conn.execute(
            "SELECT * FROM decisions ORDER BY timestamp DESC LIMIT ? OFFSET ?",
            (limit, offset),
        )
    return cursor.fetchall()


def get_setting(conn: sqlite3.Connection, key: str) -> Optional[str]:
    cursor = conn.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    return row["value"] if row else None


def set_setting(conn: sqlite3.Connection, key: str, value) -> None:
    json_value = json.dumps(value) if not isinstance(value, str) else value
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        (key, json_value),
    )
    conn.commit()


def save_infra_snapshot(conn: sqlite3.Connection, data: dict) -> int:
    cursor = conn.execute(
        "INSERT INTO infra_snapshots (data) VALUES (?)",
        (json.dumps(data),),
    )
    conn.commit()
    return cursor.lastrowid

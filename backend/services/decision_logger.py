from __future__ import annotations

import sqlite3
from typing import Optional

from backend.db import insert_decision, list_decisions
from backend.models import DecisionAction


class DecisionLogger:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def log(
        self,
        *,
        intent_id: int,
        action: DecisionAction,
        reasoning: str,
        infra_snapshot: Optional[dict] = None,
        outcome: Optional[str] = None,
    ) -> int:
        return insert_decision(
            self._conn,
            intent_id=intent_id,
            action=action.value,
            reasoning=reasoning,
            infra_snapshot=infra_snapshot,
            outcome=outcome,
        )

    def get_recent(self, limit: int = 5) -> list[sqlite3.Row]:
        return list_decisions(self._conn, limit=limit)

    def get_for_intent(self, intent_id: int) -> list[sqlite3.Row]:
        return list_decisions(self._conn, intent_id=intent_id, limit=100)

    def get_all(self, *, limit: int = 50, offset: int = 0) -> list[sqlite3.Row]:
        return list_decisions(self._conn, limit=limit, offset=offset)

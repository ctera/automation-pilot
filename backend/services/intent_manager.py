from __future__ import annotations

import json
import sqlite3
from typing import Optional

from backend.db import (
    get_intent,
    insert_intent,
    list_intents,
    update_intent_status,
)
from backend.models import (
    CANCELLABLE_STATUSES,
    REPRIORITIZABLE_STATUSES,
    STOPPABLE_STATUSES,
    TERMINAL_STATUSES,
    IntentStatus,
    Priority,
    WebhookPayload,
)


class InvalidTransitionError(Exception):
    pass


class IntentManager:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def create_from_webhook(self, payload: WebhookPayload) -> sqlite3.Row:
        intent_id = insert_intent(
            self._conn,
            job_id=payload.job_type,
            priority=payload.priority,
            parameters={"build_number": payload.build_number, **(payload.parameters or {})},
            source="webhook",
        )
        return get_intent(self._conn, intent_id)

    def get(self, intent_id: int) -> Optional[sqlite3.Row]:
        return get_intent(self._conn, intent_id)

    def list_active(self) -> list[sqlite3.Row]:
        return list_intents(self._conn, exclude_terminal=True)

    def list_all(self) -> list[sqlite3.Row]:
        return list_intents(self._conn, exclude_terminal=False)

    def get_by_status(self, status: IntentStatus) -> list[sqlite3.Row]:
        cursor = self._conn.execute(
            "SELECT * FROM intents WHERE status = ? ORDER BY created_at DESC",
            (status.value,),
        )
        return cursor.fetchall()

    def update_status(
        self,
        intent_id: int,
        status: IntentStatus,
        *,
        jenkins_build_number: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> None:
        update_intent_status(
            self._conn,
            intent_id,
            status,
            jenkins_build_number=jenkins_build_number,
            notes=notes,
        )

    def cancel(self, intent_id: int) -> None:
        intent = get_intent(self._conn, intent_id)
        if intent is None:
            raise ValueError(f"Intent {intent_id} not found")
        current = IntentStatus(intent["status"])
        if current not in CANCELLABLE_STATUSES:
            raise InvalidTransitionError(
                f"Cannot cancel intent in '{current.value}' state. Cancellable states: {[s.value for s in CANCELLABLE_STATUSES]}"
            )
        update_intent_status(self._conn, intent_id, IntentStatus.CANCELLED)

    def stop(self, intent_id: int) -> None:
        intent = get_intent(self._conn, intent_id)
        if intent is None:
            raise ValueError(f"Intent {intent_id} not found")
        current = IntentStatus(intent["status"])
        if current not in STOPPABLE_STATUSES:
            raise InvalidTransitionError(
                f"Cannot stop intent in '{current.value}' state. Stoppable states: {[s.value for s in STOPPABLE_STATUSES]}"
            )
        update_intent_status(self._conn, intent_id, IntentStatus.STOPPED)

    def reprioritize(self, intent_id: int, new_priority: Priority) -> None:
        intent = get_intent(self._conn, intent_id)
        if intent is None:
            raise ValueError(f"Intent {intent_id} not found")
        current = IntentStatus(intent["status"])
        if current not in REPRIORITIZABLE_STATUSES:
            raise InvalidTransitionError(
                f"Cannot reprioritize intent in '{current.value}' state. Allowed states: {[s.value for s in REPRIORITIZABLE_STATUSES]}"
            )
        self._conn.execute(
            "UPDATE intents SET priority = ? WHERE id = ?",
            (new_priority.value, intent_id),
        )
        self._conn.commit()

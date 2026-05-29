from backend.db import init_db, get_db, insert_intent, get_intent, list_intents, update_intent_status
from backend.models import Priority, IntentStatus


def test_init_creates_tables(db):
    cursor = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    tables = {row["name"] for row in cursor.fetchall()}
    assert "intents" in tables
    assert "decisions" in tables
    assert "settings" in tables
    assert "infra_snapshots" in tables


def test_insert_and_get_intent(db):
    intent_id = insert_intent(
        db, job_id="dev-nightly", priority=Priority.NORMAL, parameters={"branch": "main"}
    )
    intent = get_intent(db, intent_id)
    assert intent is not None
    assert intent["job_id"] == "dev-nightly"
    assert intent["priority"] == "normal"
    assert intent["status"] == "pending"


def test_list_intents_excludes_terminal(db):
    id1 = insert_intent(db, job_id="job-a", priority=Priority.NORMAL)
    id2 = insert_intent(db, job_id="job-b", priority=Priority.HIGH)
    update_intent_status(db, id1, IntentStatus.COMPLETED)

    active = list_intents(db, exclude_terminal=True)
    assert len(active) == 1
    assert active[0]["id"] == id2


def test_update_intent_status(db):
    intent_id = insert_intent(db, job_id="job-x", priority=Priority.NORMAL)
    update_intent_status(db, intent_id, IntentStatus.QUEUED)
    intent = get_intent(db, intent_id)
    assert intent["status"] == "queued"

import pytest

from backend.services.intent_manager import IntentManager, InvalidTransitionError
from backend.models import Priority, IntentStatus, WebhookPayload


def test_create_from_webhook(db):
    mgr = IntentManager(db)
    payload = WebhookPayload(job_type="dev-nightly", build_number=5240, priority=Priority.NORMAL)
    intent = mgr.create_from_webhook(payload)
    assert intent["status"] == "pending"
    assert intent["job_id"] == "dev-nightly"
    assert intent["priority"] == "normal"


def test_list_active_excludes_completed(db):
    mgr = IntentManager(db)
    mgr.create_from_webhook(WebhookPayload(job_type="job-a", build_number=1))
    intent_b = mgr.create_from_webhook(WebhookPayload(job_type="job-b", build_number=2))
    mgr.update_status(intent_b["id"], IntentStatus.COMPLETED)

    active = mgr.list_active()
    assert len(active) == 1
    assert active[0]["job_id"] == "job-a"


def test_cancel_pending_intent(db):
    mgr = IntentManager(db)
    intent = mgr.create_from_webhook(WebhookPayload(job_type="job-a", build_number=1))
    mgr.cancel(intent["id"])
    updated = mgr.get(intent["id"])
    assert updated["status"] == "cancelled"


def test_cancel_running_raises(db):
    mgr = IntentManager(db)
    intent = mgr.create_from_webhook(WebhookPayload(job_type="job-a", build_number=1))
    mgr.update_status(intent["id"], IntentStatus.RUNNING)

    with pytest.raises(InvalidTransitionError, match="Cannot cancel"):
        mgr.cancel(intent["id"])


def test_stop_running_intent(db):
    mgr = IntentManager(db)
    intent = mgr.create_from_webhook(WebhookPayload(job_type="job-a", build_number=1))
    mgr.update_status(intent["id"], IntentStatus.RUNNING)
    mgr.stop(intent["id"])
    updated = mgr.get(intent["id"])
    assert updated["status"] == "stopped"


def test_stop_pending_raises(db):
    mgr = IntentManager(db)
    intent = mgr.create_from_webhook(WebhookPayload(job_type="job-a", build_number=1))

    with pytest.raises(InvalidTransitionError, match="Cannot stop"):
        mgr.stop(intent["id"])


def test_reprioritize_queued_intent(db):
    mgr = IntentManager(db)
    intent = mgr.create_from_webhook(WebhookPayload(job_type="job-a", build_number=1))
    mgr.update_status(intent["id"], IntentStatus.QUEUED)
    mgr.reprioritize(intent["id"], Priority.HIGH)
    updated = mgr.get(intent["id"])
    assert updated["priority"] == "high"


def test_reprioritize_completed_raises(db):
    mgr = IntentManager(db)
    intent = mgr.create_from_webhook(WebhookPayload(job_type="job-a", build_number=1))
    mgr.update_status(intent["id"], IntentStatus.COMPLETED)

    with pytest.raises(InvalidTransitionError, match="Cannot reprioritize"):
        mgr.reprioritize(intent["id"], Priority.HIGH)


def test_get_running_intents(db):
    mgr = IntentManager(db)
    i1 = mgr.create_from_webhook(WebhookPayload(job_type="job-a", build_number=1))
    i2 = mgr.create_from_webhook(WebhookPayload(job_type="job-b", build_number=2, priority=Priority.HIGH))
    mgr.update_status(i1["id"], IntentStatus.RUNNING)
    mgr.update_status(i2["id"], IntentStatus.RUNNING)

    running = mgr.get_by_status(IntentStatus.RUNNING)
    assert len(running) == 2

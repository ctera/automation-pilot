from backend.services.decision_logger import DecisionLogger
from backend.models import DecisionAction, Priority
from backend.db import insert_intent


def test_log_decision(db):
    intent_id = insert_intent(db, job_id="dev-nightly", priority=Priority.NORMAL)
    logger = DecisionLogger(db)

    decision_id = logger.log(
        intent_id=intent_id,
        action=DecisionAction.QUEUE,
        reasoning="Storage at 87% (Saturated). Normal priority does not preempt.",
        infra_snapshot={"cluster_usage_percent": 87.0, "state": "saturated"},
        outcome="QUEUED",
    )
    assert decision_id > 0


def test_get_recent_decisions(db):
    intent_id = insert_intent(db, job_id="dev-nightly", priority=Priority.NORMAL)
    logger = DecisionLogger(db)

    logger.log(intent_id=intent_id, action=DecisionAction.QUEUE, reasoning="First")
    logger.log(intent_id=intent_id, action=DecisionAction.TRIGGER, reasoning="Second")

    recent = logger.get_recent(limit=5)
    assert len(recent) == 2
    assert recent[0]["reasoning"] == "Second"


def test_get_decisions_for_intent(db):
    id1 = insert_intent(db, job_id="job-a", priority=Priority.NORMAL)
    id2 = insert_intent(db, job_id="job-b", priority=Priority.HIGH)
    logger = DecisionLogger(db)

    logger.log(intent_id=id1, action=DecisionAction.QUEUE, reasoning="Queued A")
    logger.log(intent_id=id2, action=DecisionAction.TRIGGER, reasoning="Triggered B")
    logger.log(intent_id=id1, action=DecisionAction.TRIGGER, reasoning="Now triggering A")

    decisions = logger.get_for_intent(id1)
    assert len(decisions) == 2
    assert all(d["intent_id"] == id1 for d in decisions)

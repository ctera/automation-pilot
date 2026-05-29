from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from backend.models import (
    DecisionAction,
    InfraSnapshot,
    InfraState,
    IntentStatus,
    Priority,
    DatastoreStatus,
    HostStatus,
    FolderVmCount,
)
from backend.services.orchestrator import Orchestrator


def _make_snapshot(state: InfraState = InfraState.READY, cluster_pct: float = 50.0) -> InfraSnapshot:
    return InfraSnapshot(
        state=state,
        datastores=[DatastoreStatus(name="ds-1", usage_percent=int(cluster_pct))],
        cluster_usage_percent=cluster_pct,
        hosts=[HostStatus(ip="10.0.0.1", cpu_percent=40, memory_percent=50)],
        vm_counts=[FolderVmCount(folder="/QA/Test", count=3)],
    )


def _make_intent_row(
    id: int, status: str, priority: str, job_id: str = "test-job", started_at=None
):
    """Create a dict that mimics a sqlite3.Row for intent data."""
    return {
        "id": id,
        "job_id": job_id,
        "status": status,
        "priority": priority,
        "started_at": started_at,
        "jenkins_build_number": None,
        "parameters": None,
    }


@pytest.fixture()
def deps():
    return {
        "infra_monitor": MagicMock(),
        "jenkins_client": MagicMock(),
        "intent_manager": MagicMock(),
        "decision_logger": MagicMock(),
    }


@pytest.fixture()
def orchestrator(deps):
    orch = Orchestrator(
        infra_monitor=deps["infra_monitor"],
        jenkins_client=deps["jenkins_client"],
        intent_manager=deps["intent_manager"],
        decision_logger=deps["decision_logger"],
        thresholds={
            "storage": {"ready_below": 70, "constrained_below": 85},
            "cpu": {"ready_below": 75, "constrained_below": 85},
        },
        job_definitions=[],
        deployment_window_minutes=30,
    )
    return orch


class TestResourceProjection:
    def test_no_recent_intents_returns_actual(self, orchestrator):
        projected = orchestrator.calculate_projected_usage(
            actual_storage=50.0, actual_cpu=40, running_intents=[], now=datetime.utcnow()
        )
        assert projected["storage"] == 50.0
        assert projected["cpu"] == 40

    def test_recent_intent_adds_footprint(self, orchestrator):
        orchestrator._job_definitions = [
            {"id": "dev-nightly", "expected_storage_percent": 10.0, "expected_cpu_percent": 15.0, "deployment_window_minutes": 30}
        ]
        recent = _make_intent_row(
            1, "running", "normal", job_id="dev-nightly",
            started_at=(datetime.utcnow() - timedelta(minutes=5)).isoformat(),
        )
        projected = orchestrator.calculate_projected_usage(
            actual_storage=50.0, actual_cpu=40, running_intents=[recent], now=datetime.utcnow()
        )
        assert projected["storage"] == 60.0
        assert projected["cpu"] == 55

    def test_old_intent_does_not_add_footprint(self, orchestrator):
        orchestrator._job_definitions = [
            {"id": "dev-nightly", "expected_storage_percent": 10.0, "expected_cpu_percent": 15.0, "deployment_window_minutes": 30}
        ]
        old = _make_intent_row(
            1, "running", "normal", job_id="dev-nightly",
            started_at=(datetime.utcnow() - timedelta(minutes=60)).isoformat(),
        )
        projected = orchestrator.calculate_projected_usage(
            actual_storage=50.0, actual_cpu=40, running_intents=[old], now=datetime.utcnow()
        )
        assert projected["storage"] == 50.0
        assert projected["cpu"] == 40


class TestDecisionFlow:
    def test_trigger_when_resources_available(self, orchestrator, deps):
        snapshot = _make_snapshot(InfraState.READY, 50.0)
        deps["infra_monitor"].fetch_full_snapshot.return_value = snapshot
        deps["intent_manager"].get_by_status.return_value = []

        intent = _make_intent_row(1, "pending", "normal")
        action = orchestrator.evaluate(intent)
        assert action == DecisionAction.TRIGGER

    def test_queue_normal_when_saturated(self, orchestrator, deps):
        snapshot = _make_snapshot(InfraState.SATURATED, 90.0)
        deps["infra_monitor"].fetch_full_snapshot.return_value = snapshot
        deps["intent_manager"].get_by_status.return_value = []

        intent = _make_intent_row(1, "pending", "normal")
        action = orchestrator.evaluate(intent)
        assert action == DecisionAction.QUEUE

    def test_preempt_when_high_and_normal_running(self, orchestrator, deps):
        snapshot = _make_snapshot(InfraState.SATURATED, 90.0)
        deps["infra_monitor"].fetch_full_snapshot.return_value = snapshot
        running_normal = _make_intent_row(
            2, "running", "normal",
            started_at=(datetime.utcnow() - timedelta(minutes=45)).isoformat(),
        )
        deps["intent_manager"].get_by_status.return_value = [running_normal]

        intent = _make_intent_row(1, "pending", "high")
        action = orchestrator.evaluate(intent)
        assert action == DecisionAction.PREEMPT

    def test_queue_high_when_only_high_running(self, orchestrator, deps):
        snapshot = _make_snapshot(InfraState.SATURATED, 90.0)
        deps["infra_monitor"].fetch_full_snapshot.return_value = snapshot
        running_high = _make_intent_row(
            2, "running", "high",
            started_at=(datetime.utcnow() - timedelta(minutes=45)).isoformat(),
        )
        deps["intent_manager"].get_by_status.return_value = [running_high]

        intent = _make_intent_row(1, "pending", "high")
        action = orchestrator.evaluate(intent)
        assert action == DecisionAction.QUEUE

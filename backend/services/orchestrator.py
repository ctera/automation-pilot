from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Optional

from backend.models import (
    DecisionAction,
    InfraSnapshot,
    InfraState,
    IntentStatus,
    Priority,
)

logger = logging.getLogger(__name__)


class Orchestrator:
    def __init__(
        self,
        *,
        infra_monitor,
        jenkins_client,
        intent_manager,
        decision_logger,
        thresholds: dict,
        job_definitions: list[dict],
        deployment_window_minutes: int = 30,
        infra_fetch_kwargs: Optional[dict] = None,
    ):
        self._infra = infra_monitor
        self._jenkins = jenkins_client
        self._intents = intent_manager
        self._decisions = decision_logger
        self._thresholds = thresholds
        self._job_definitions = job_definitions
        self._deploy_window = deployment_window_minutes
        self._infra_kwargs = infra_fetch_kwargs or {}

    def _get_job_footprint(self, job_id: str) -> dict:
        for jd in self._job_definitions:
            if jd["id"] == job_id:
                return {
                    "storage": jd.get("expected_storage_percent", 0.0),
                    "cpu": jd.get("expected_cpu_percent", 0.0),
                    "window": jd.get("deployment_window_minutes", self._deploy_window),
                }
        return {"storage": 0.0, "cpu": 0.0, "window": self._deploy_window}

    def calculate_projected_usage(
        self,
        *,
        actual_storage: float,
        actual_cpu: int,
        running_intents: list,
        now: datetime,
    ) -> dict[str, float]:
        extra_storage = 0.0
        extra_cpu = 0.0

        for intent in running_intents:
            started_str = intent["started_at"] if isinstance(intent, dict) else intent.get("started_at")
            if not started_str:
                continue
            if isinstance(started_str, str):
                started = datetime.fromisoformat(started_str)
            else:
                started = started_str

            footprint = self._get_job_footprint(
                intent["job_id"] if isinstance(intent, dict) else intent.get("job_id", "")
            )
            if (now - started) < timedelta(minutes=footprint["window"]):
                extra_storage += footprint["storage"]
                extra_cpu += footprint["cpu"]

        return {
            "storage": actual_storage + extra_storage,
            "cpu": actual_cpu + extra_cpu,
        }

    def _has_enough_resources(self, projected: dict[str, float]) -> bool:
        storage_threshold = self._thresholds["storage"]["constrained_below"]
        cpu_threshold = self._thresholds["cpu"]["constrained_below"]
        return projected["storage"] < storage_threshold and projected["cpu"] < cpu_threshold

    def evaluate(self, intent: dict) -> DecisionAction:
        snapshot = self._infra.fetch_full_snapshot(**self._infra_kwargs)

        running_statuses = [IntentStatus.RUNNING, IntentStatus.TRIGGERING]
        running_intents = []
        for status in running_statuses:
            running_intents.extend(self._intents.get_by_status(status))

        now = datetime.utcnow()
        max_cpu = max(
            (h.cpu_percent for h in snapshot.hosts if h.cpu_percent >= 0),
            default=0,
        )
        projected = self.calculate_projected_usage(
            actual_storage=snapshot.cluster_usage_percent,
            actual_cpu=max_cpu,
            running_intents=[dict(r) if not isinstance(r, dict) else r for r in running_intents],
            now=now,
        )

        if self._has_enough_resources(projected):
            self._decisions.log(
                intent_id=intent["id"],
                action=DecisionAction.TRIGGER,
                reasoning=f"Projected resources available (storage: {projected['storage']:.1f}%, CPU: {projected['cpu']:.0f}%)",
                infra_snapshot=snapshot.model_dump(mode="json"),
                outcome="TRIGGERING",
            )
            return DecisionAction.TRIGGER

        intent_priority = Priority(intent["priority"])
        if intent_priority == Priority.HIGH:
            normal_running = [
                r for r in running_intents
                if (r["priority"] if isinstance(r, dict) else r.get("priority")) == Priority.NORMAL.value
            ]
            if normal_running:
                self._decisions.log(
                    intent_id=intent["id"],
                    action=DecisionAction.PREEMPT,
                    reasoning=(
                        f"Resources insufficient (storage: {projected['storage']:.1f}%, CPU: {projected['cpu']:.0f}%). "
                        f"High-priority intent preempting {len(normal_running)} Normal job(s)."
                    ),
                    infra_snapshot=snapshot.model_dump(mode="json"),
                    outcome="PREEMPTING",
                )
                return DecisionAction.PREEMPT

        self._decisions.log(
            intent_id=intent["id"],
            action=DecisionAction.QUEUE,
            reasoning=(
                f"Resources insufficient (storage: {projected['storage']:.1f}%, CPU: {projected['cpu']:.0f}%). "
                f"{'High priority but only High jobs running — nothing to preempt.' if intent_priority == Priority.HIGH else 'Normal priority does not preempt.'}"
            ),
            infra_snapshot=snapshot.model_dump(mode="json"),
            outcome="QUEUED",
        )
        return DecisionAction.QUEUE

    def execute_decision(self, intent: dict, action: DecisionAction) -> None:
        intent_id = intent["id"]

        if action == DecisionAction.TRIGGER:
            self._trigger_intent(intent)
        elif action == DecisionAction.QUEUE:
            self._intents.update_status(intent_id, IntentStatus.QUEUED)
        elif action == DecisionAction.PREEMPT:
            self._execute_preemption(intent)

    def _trigger_intent(self, intent: dict) -> None:
        intent_id = intent["id"]
        self._intents.update_status(intent_id, IntentStatus.TRIGGERING)

        job_id = intent["job_id"]
        job_def = next((j for j in self._job_definitions if j["id"] == job_id), None)
        if not job_def:
            logger.warning("No job definition found for %s, cannot trigger", job_id)
            self._intents.update_status(intent_id, IntentStatus.FAILED, notes="No job definition")
            return

        try:
            params = {}
            if intent.get("parameters"):
                import json
                params = json.loads(intent["parameters"]) if isinstance(intent["parameters"], str) else intent["parameters"]

            self._jenkins.trigger_job(job_def["jenkins_job_name"], params)
            self._intents.update_status(intent_id, IntentStatus.RUNNING)
        except Exception as exc:
            logger.error("Failed to trigger Jenkins job: %s", exc)
            self._intents.update_status(
                intent_id, IntentStatus.FAILED, notes=f"Trigger failed: {exc}"
            )

    def _execute_preemption(self, intent: dict) -> None:
        running_normal = [
            r for r in self._intents.get_by_status(IntentStatus.RUNNING)
            if (r["priority"] if isinstance(r, dict) else r.get("priority")) == Priority.NORMAL.value
        ]

        for victim in running_normal:
            victim_id = victim["id"] if isinstance(victim, dict) else victim.get("id")
            self._intents.update_status(victim_id, IntentStatus.PREEMPTED, notes=f"Preempted by intent {intent['id']}")

            build_num = victim.get("jenkins_build_number") if isinstance(victim, dict) else None
            if build_num:
                job_def = next(
                    (j for j in self._job_definitions if j["id"] == victim.get("job_id", "")),
                    None,
                )
                if job_def:
                    try:
                        self._jenkins.stop_build(job_def["jenkins_job_name"], build_num)
                    except Exception as exc:
                        logger.warning("Failed to stop preempted build: %s", exc)

        self._trigger_intent(intent)

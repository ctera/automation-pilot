from __future__ import annotations

import json
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Priority(str, Enum):
    NORMAL = "normal"
    HIGH = "high"


class IntentStatus(str, Enum):
    PENDING = "pending"
    PREPARING = "preparing"
    TRIGGERING = "triggering"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PREEMPTED = "preempted"
    QUEUED = "queued"
    CANCELLED = "cancelled"
    STOPPED = "stopped"


TERMINAL_STATUSES = frozenset({
    IntentStatus.COMPLETED,
    IntentStatus.FAILED,
    IntentStatus.CANCELLED,
    IntentStatus.STOPPED,
})

CANCELLABLE_STATUSES = frozenset({
    IntentStatus.PENDING,
    IntentStatus.QUEUED,
    IntentStatus.PREPARING,
})

STOPPABLE_STATUSES = frozenset({
    IntentStatus.RUNNING,
})

REPRIORITIZABLE_STATUSES = frozenset({
    IntentStatus.QUEUED,
    IntentStatus.RUNNING,
})


class InfraState(str, Enum):
    READY = "ready"
    CONSTRAINED = "constrained"
    SATURATED = "saturated"


class DecisionAction(str, Enum):
    TRIGGER = "trigger"
    QUEUE = "queue"
    PREEMPT = "preempt"
    CLEANUP = "cleanup"
    BLOCK = "block"


class Intent(BaseModel):
    id: Optional[int] = None
    job_id: str
    priority: Priority
    status: IntentStatus = IntentStatus.PENDING
    jenkins_build_number: Optional[int] = None
    parameters: Optional[dict] = None
    source: str = "webhook"
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None


class Decision(BaseModel):
    id: Optional[int] = None
    intent_id: int
    timestamp: Optional[datetime] = None
    action: DecisionAction
    reasoning: str
    infra_snapshot: Optional[dict] = None
    outcome: Optional[str] = None


class DatastoreStatus(BaseModel):
    name: str
    usage_percent: int


class HostStatus(BaseModel):
    ip: str
    cpu_percent: int
    memory_percent: int


class FolderVmCount(BaseModel):
    folder: str
    count: int
    powered_on: int = 0


class InfraSnapshot(BaseModel):
    timestamp: Optional[datetime] = None
    state: InfraState
    datastores: list[DatastoreStatus]
    cluster_usage_percent: float
    hosts: list[HostStatus]
    vm_counts: list[FolderVmCount]


class Team(str, Enum):
    PORTAL = "Portal"
    CLOUDFS = "CloudFS"
    GATEWAY = "Gateway"


class MonitoredJob(BaseModel):
    name: str
    team: Team


class JobDefinition(BaseModel):
    id: str
    name: str
    jenkins_job_name: str
    expected_storage_percent: float = 0.0
    expected_cpu_percent: float = 0.0
    deployment_window_minutes: int = 30


class WebhookPayload(BaseModel):
    job_type: str
    build_number: int
    priority: Priority = Priority.NORMAL
    parameters: Optional[dict] = None


class StopRequest(BaseModel):
    delete_vms: bool = False


class ReprioritizeRequest(BaseModel):
    priority: Priority


class JenkinsBuildStatus(BaseModel):
    status: Optional[str] = None
    is_building: bool = False
    build_number: Optional[int] = None
    duration_seconds: Optional[float] = None
    estimated_duration_seconds: Optional[float] = None
    build_url: Optional[str] = None
    parameters: Optional[dict] = None


class PortalTriggerJob(BaseModel):
    job_name: str
    description: str
    job_url: str
    config_url: str
    enabled: bool
    cron_spec: Optional[str] = None
    last_run_message: Optional[str] = None
    next_run_message: Optional[str] = None


class ScheduleUpdateRequest(BaseModel):
    spec: Optional[str] = None


class JenkinsJobStatus(BaseModel):
    job_name: str
    team: Optional[str] = None
    status: Optional[str] = None
    is_building: bool = False
    build_number: Optional[int] = None
    duration_seconds: Optional[float] = None
    estimated_duration_seconds: Optional[float] = None
    job_url: Optional[str] = None
    build_url: Optional[str] = None
    parameters: Optional[dict] = None
    running_builds: Optional[list[JenkinsBuildStatus]] = None
    error: Optional[str] = None

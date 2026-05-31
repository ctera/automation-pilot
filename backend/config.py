from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Optional

import yaml

from backend.db import get_setting, set_setting

_SEED_KEYS = ("hosts", "datastores", "datastore_host", "datacenter", "vm_folders", "thresholds", "jobs", "staleness", "deployment_window_minutes", "monitored_jenkins_jobs")


def load_config(path: Optional[str] = None) -> dict[str, Any]:
    if path is None:
        path = os.environ.get("AUTOPILOT_CONFIG", "backend/config.yaml")
    with open(path) as f:
        return yaml.safe_load(f)


def seed_settings(conn: sqlite3.Connection, cfg: dict[str, Any]) -> None:
    for key in _SEED_KEYS:
        if key in cfg and get_setting(conn, key) is None:
            set_setting(conn, key, cfg[key])

    # Jenkins endpoint is not editable via Settings UI, so keep it synced
    # from config file on each startup to avoid stale DB values.
    if "jenkins" in cfg:
        set_setting(conn, "jenkins", cfg["jenkins"])

    if "vmtools" in cfg:
        set_setting(conn, "vmtools", cfg["vmtools"])


def _get_json_setting(conn: sqlite3.Connection, key: str) -> Any:
    raw = get_setting(conn, key)
    if raw is None:
        return None
    return json.loads(raw)


def get_hosts(conn: sqlite3.Connection) -> list[str]:
    return _get_json_setting(conn, "hosts") or []


def get_datastores(conn: sqlite3.Connection) -> list[str]:
    return _get_json_setting(conn, "datastores") or []


def get_datastore_host(conn: sqlite3.Connection) -> str:
    return _get_json_setting(conn, "datastore_host") or ""


def get_datacenter(conn: sqlite3.Connection) -> str:
    return _get_json_setting(conn, "datacenter") or "CTERA"


def get_vm_folders(conn: sqlite3.Connection) -> list[str]:
    return _get_json_setting(conn, "vm_folders") or []


def get_thresholds(conn: sqlite3.Connection) -> dict:
    return _get_json_setting(conn, "thresholds") or {
        "storage": {"ready_below": 70, "constrained_below": 85},
        "cpu": {"ready_below": 75, "constrained_below": 85},
    }


def get_vmtools_config(conn: sqlite3.Connection) -> dict:
    return _get_json_setting(conn, "vmtools") or {
        "jar_path": "/opt/automation-pilot/VmTools.jar",
        "java_cmd": "java",
        "timeout_seconds": 120,
    }


def get_jenkins_config(conn: sqlite3.Connection) -> dict:
    return _get_json_setting(conn, "jenkins") or {
        "url": "https://jenkins.ctera.dev",
        "cleanup_job_name": "TBD_CLEANUP_JOB",
    }


def get_job_definitions(conn: sqlite3.Connection) -> list[dict]:
    return _get_json_setting(conn, "jobs") or []


def get_staleness_config(conn: sqlite3.Connection) -> dict:
    return _get_json_setting(conn, "staleness") or {"warning_minutes": 5}


def get_deployment_window(conn: sqlite3.Connection) -> int:
    val = _get_json_setting(conn, "deployment_window_minutes")
    return val if val is not None else 30


def get_monitored_jenkins_jobs(conn: sqlite3.Connection) -> list[dict]:
    raw = _get_json_setting(conn, "monitored_jenkins_jobs") or []
    normalized = []
    for item in raw:
        if isinstance(item, str):
            normalized.append({"name": item, "team": "Portal"})
        elif isinstance(item, dict) and "name" in item:
            normalized.append(item)
    return normalized

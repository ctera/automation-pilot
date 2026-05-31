from __future__ import annotations

import json
import sqlite3

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.config import (
    get_hosts, get_datastores, get_datastore_host, get_datacenter,
    get_vm_folders, get_thresholds, get_job_definitions,
    get_staleness_config, get_deployment_window, get_monitored_jenkins_jobs,
)
from backend.db import set_setting

router = APIRouter(prefix="/api", tags=["settings"])

_db: sqlite3.Connection = None

ALLOWED_KEYS = {
    "hosts", "datastores", "datastore_host", "datacenter",
    "vm_folders", "thresholds", "jobs", "staleness", "deployment_window_minutes",
    "monitored_jenkins_jobs",
}


def init_settings(db):
    global _db
    _db = db


class SettingUpdate(BaseModel):
    value: object


@router.get("/settings")
async def get_all_settings():
    if _db is None:
        raise HTTPException(503, "Service not initialized")
    return {
        "hosts": get_hosts(_db),
        "datastores": get_datastores(_db),
        "datastore_host": get_datastore_host(_db),
        "datacenter": get_datacenter(_db),
        "vm_folders": get_vm_folders(_db),
        "thresholds": get_thresholds(_db),
        "jobs": get_job_definitions(_db),
        "staleness": get_staleness_config(_db),
        "deployment_window_minutes": get_deployment_window(_db),
        "monitored_jenkins_jobs": get_monitored_jenkins_jobs(_db),
    }


@router.put("/settings/{key}")
async def update_setting(key: str, body: SettingUpdate):
    if _db is None:
        raise HTTPException(503, "Service not initialized")
    if key not in ALLOWED_KEYS:
        raise HTTPException(400, f"Unknown setting: {key}. Allowed: {sorted(ALLOWED_KEYS)}")
    value = body.value
    if key == "vm_folders" and isinstance(value, list):
        value = [v.strip().lstrip("/") for v in value if isinstance(v, str)]
    set_setting(_db, key, value)
    return {"key": key, "value": value}

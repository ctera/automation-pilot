from __future__ import annotations

import asyncio
import json
import sqlite3

from fastapi import APIRouter, HTTPException

from backend.config import get_datastores, get_datastore_host, get_hosts, get_vm_folders, get_datacenter, get_thresholds
from backend.db import save_infra_snapshot

router = APIRouter(prefix="/api", tags=["infrastructure"])

_infra_monitor = None
_db: sqlite3.Connection = None


def init_infrastructure(infra_monitor, db):
    global _infra_monitor, _db
    _infra_monitor = infra_monitor
    _db = db


@router.post("/infrastructure/refresh")
async def refresh_infrastructure():
    if _infra_monitor is None or _db is None:
        raise HTTPException(503, "Service not initialized")

    datastores = get_datastores(_db)
    ds_host = get_datastore_host(_db)
    hosts = get_hosts(_db)
    folders = get_vm_folders(_db)
    dc = get_datacenter(_db)
    thresholds = get_thresholds(_db)

    snapshot = await asyncio.to_thread(
        _infra_monitor.fetch_full_snapshot,
        datastores=datastores,
        datastore_host=ds_host,
        hosts=hosts,
        vm_folders=folders,
        datacenter=dc,
        thresholds=thresholds,
    )

    save_infra_snapshot(_db, snapshot.model_dump(mode="json"))
    return snapshot.model_dump(mode="json")


@router.get("/infrastructure/status")
async def get_infra_status():
    if _db is None:
        raise HTTPException(503, "Service not initialized")
    cursor = _db.execute(
        "SELECT * FROM infra_snapshots ORDER BY timestamp DESC LIMIT 1"
    )
    row = cursor.fetchone()
    if row is None:
        return {"state": "unknown", "message": "No data yet — click Refresh"}
    return json.loads(row["data"])

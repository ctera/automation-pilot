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


def _ensure_initialized():
    if _infra_monitor is None or _db is None:
        raise HTTPException(503, "Service not initialized")


@router.post("/infrastructure/refresh")
async def refresh_infrastructure():
    _ensure_initialized()

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


@router.post("/infrastructure/refresh/datastores")
async def refresh_datastores():
    _ensure_initialized()

    datastores = get_datastores(_db)
    ds_host = get_datastore_host(_db)

    ds_statuses = await asyncio.to_thread(
        _infra_monitor.get_all_datastores, datastores, ds_host
    )

    cluster_usage = _infra_monitor.calculate_cluster_usage(ds_statuses)

    return {
        "datastores": [ds.model_dump(mode="json") for ds in ds_statuses],
        "cluster_usage_percent": round(cluster_usage, 1),
    }


@router.post("/infrastructure/refresh/hosts")
async def refresh_hosts():
    _ensure_initialized()

    hosts = get_hosts(_db)
    host_statuses = await asyncio.to_thread(_infra_monitor.get_all_hosts, hosts)

    return {
        "hosts": [h.model_dump(mode="json") for h in host_statuses],
    }


@router.post("/infrastructure/refresh/vm-folders")
async def refresh_vm_folders():
    _ensure_initialized()

    folders = get_vm_folders(_db)
    dc = get_datacenter(_db)

    vm_counts = await asyncio.to_thread(
        _infra_monitor.get_all_vm_counts, folders, dc
    )

    return {
        "vm_counts": [vc.model_dump(mode="json") for vc in vm_counts],
    }


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

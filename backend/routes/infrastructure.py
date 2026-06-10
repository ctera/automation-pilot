from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query

from backend.db import get_infra_snapshots_since, get_snapshot_count
from backend.services.refresh_service import (
    RefreshCooldownError,
    RefreshInProgressError,
    RefreshService,
)

router = APIRouter(prefix="/api", tags=["infrastructure"])

_refresh_service: RefreshService = None


def init_infrastructure(refresh_service: RefreshService):
    global _refresh_service
    _refresh_service = refresh_service


def _ensure_initialized():
    if _refresh_service is None:
        raise HTTPException(503, "Service not initialized")


@router.post("/infrastructure/refresh")
async def refresh_infrastructure():
    _ensure_initialized()
    try:
        snapshot = await _refresh_service.refresh(source="manual")
        return {**snapshot, "from_cache": False}
    except RefreshInProgressError:
        cached = _refresh_service.get_cached_data()
        status = _refresh_service.get_status()
        return {**(cached or {}), "from_cache": True, "last_refreshed_at": status["last_refreshed_at"]}
    except RefreshCooldownError:
        cached = _refresh_service.get_cached_data()
        status = _refresh_service.get_status()
        return {**(cached or {}), "from_cache": True, "last_refreshed_at": status["last_refreshed_at"]}


@router.get("/infrastructure/status")
async def get_infra_status():
    _ensure_initialized()
    cached = _refresh_service.get_cached_data()
    status = _refresh_service.get_status()
    return {
        "data": cached,
        "is_refreshing": status["is_refreshing"],
        "last_refreshed_at": status["last_refreshed_at"],
        "source": status["source"],
    }


@router.get("/infrastructure/history")
async def get_infra_history(
    hours: int = Query(default=24, ge=1, le=168),
):
    """Return time-series data from infra_snapshots for charting."""
    _ensure_initialized()
    db = _refresh_service._db
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    total = get_snapshot_count(db, since)
    if total == 0:
        return {"points": [], "range_hours": hours, "point_count": 0}

    max_points = 150
    fetch_limit = 1000
    snapshots = get_infra_snapshots_since(db, since, limit=fetch_limit)

    if len(snapshots) > max_points:
        step = len(snapshots) / max_points
        snapshots = [snapshots[int(i * step)] for i in range(max_points)]

    points = []
    for snap in snapshots:
        point = {
            "timestamp": snap.get("timestamp"),
            "cluster_usage_percent": snap.get("cluster_usage_percent"),
            "hosts": [
                {"ip": h.get("ip"), "cpu_percent": h.get("cpu_percent"), "memory_percent": h.get("memory_percent")}
                for h in (snap.get("hosts") or [])
            ],
            "vm_powered_on": sum(
                v.get("powered_on", 0) for v in (snap.get("vm_counts") or [])
            ),
        }
        points.append(point)

    return {"points": points, "range_hours": hours, "point_count": len(points)}


@router.get("/infrastructure/trends")
async def get_infra_trends(
    hours: int = Query(default=72, ge=1, le=168),
):
    """Analyze trends using daily floor (minimum) comparison to filter out
    cyclical spikes from automation jobs. Only alerts when the baseline
    (post-cleanup floor) is genuinely rising."""
    _ensure_initialized()
    db = _refresh_service._db
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    snapshots = get_infra_snapshots_since(db, since, limit=1000)
    if len(snapshots) < 2:
        return {
            "storage_delta_percent": 0,
            "cpu_delta_percent": 0,
            "saturation_streaks": [],
            "alerts": [],
        }

    # Group snapshots by calendar day
    daily_buckets: dict[str, list[dict]] = {}
    for snap in snapshots:
        ts = snap.get("timestamp", "")
        day = ts[:10] if len(ts) >= 10 else "unknown"
        daily_buckets.setdefault(day, []).append(snap)

    # Compute daily floor (minimum) for storage and CPU
    daily_floors = []
    for day in sorted(daily_buckets.keys()):
        bucket = daily_buckets[day]
        storage_vals = [
            s.get("cluster_usage_percent", 0)
            for s in bucket
            if s.get("cluster_usage_percent") is not None
        ]
        cpu_vals = []
        for s in bucket:
            hosts = s.get("hosts") or []
            cpus = [h.get("cpu_percent", 0) for h in hosts if h.get("cpu_percent", 0) >= 0]
            if cpus:
                cpu_vals.append(max(cpus))

        daily_floors.append({
            "day": day,
            "storage_min": min(storage_vals) if storage_vals else 0,
            "cpu_min": min(cpu_vals) if cpu_vals else 0,
        })

    # Compare oldest day's floor to newest day's floor
    if len(daily_floors) >= 2:
        storage_delta = round(daily_floors[-1]["storage_min"] - daily_floors[0]["storage_min"], 1)
        cpu_delta = round(daily_floors[-1]["cpu_min"] - daily_floors[0]["cpu_min"], 1)
    else:
        storage_delta = 0.0
        cpu_delta = 0.0

    # Detect saturation streaks per host (CPU > 85% for consecutive snapshots)
    host_streaks: dict[str, dict] = {}
    for snap in snapshots:
        hosts = snap.get("hosts") or []
        for h in hosts:
            ip = h.get("ip", "unknown")
            cpu = h.get("cpu_percent", 0)
            if cpu >= 85:
                if ip not in host_streaks:
                    host_streaks[ip] = {"count": 0, "since": snap.get("timestamp")}
                host_streaks[ip]["count"] += 1
            else:
                if ip in host_streaks and host_streaks[ip]["count"] < 5:
                    del host_streaks[ip]

    saturation_streaks = [
        {"host": ip, "metric": "cpu", "consecutive_snapshots": info["count"], "since": info["since"]}
        for ip, info in host_streaks.items()
        if info["count"] >= 5
    ]

    alerts = []
    for streak in saturation_streaks:
        since_ts = streak.get("since", "")
        since_label = ""
        duration_label = ""
        if since_ts:
            try:
                since_dt = datetime.fromisoformat(since_ts.replace("Z", "+00:00"))
                if since_dt.tzinfo is None:
                    since_dt = since_dt.replace(tzinfo=timezone.utc)
                since_label = since_dt.strftime("%b %d, %H:%M")
                elapsed = datetime.now(timezone.utc) - since_dt
                hours_elapsed = elapsed.total_seconds() / 3600
                duration_label = f"~{hours_elapsed:.1f}h"
            except (ValueError, TypeError):
                pass
        msg = f"Host {streak['host']} \u2014 CPU above 85%"
        if since_label:
            msg += f" since {since_label}"
        if duration_label:
            msg += f" ({duration_label})"
        alerts.append({
            "severity": "warning",
            "message": msg,
        })

    return {
        "storage_delta_percent": storage_delta,
        "cpu_delta_percent": cpu_delta,
        "daily_floors": daily_floors,
        "saturation_streaks": saturation_streaks,
        "alerts": alerts,
    }

from __future__ import annotations

import asyncio
import json
import logging
import sqlite3
import time
from datetime import datetime, timezone
from typing import Any, Optional

from backend.config import (
    get_datacenter,
    get_datastore_host,
    get_datastores,
    get_hosts,
    get_monitored_jenkins_jobs,
    get_thresholds,
    get_vm_folders,
)
from backend.db import prune_old_snapshots, save_infra_snapshot
from backend.services.infra_monitor import InfraMonitor
from backend.services.jenkins_client import JenkinsClient

logger = logging.getLogger(__name__)

COOLDOWN_SECONDS = 60


class RefreshCooldownError(Exception):
    def __init__(self, retry_after: float):
        self.retry_after = retry_after
        super().__init__(f"Refresh cooldown active, retry after {retry_after:.0f}s")


class RefreshInProgressError(Exception):
    pass


class RefreshService:
    def __init__(
        self,
        *,
        infra_monitor: InfraMonitor,
        jenkins_client: JenkinsClient,
        db: sqlite3.Connection,
        ws_broadcast=None,
    ):
        self._infra_monitor = infra_monitor
        self._jenkins_client = jenkins_client
        self._db = db
        self._ws_broadcast = ws_broadcast
        self._lock = asyncio.Lock()
        self._is_refreshing = False
        self._last_refresh_at: Optional[datetime] = self._load_last_refresh_time()
        self._last_source: Optional[str] = None

    def _load_last_refresh_time(self) -> Optional[datetime]:
        cursor = self._db.execute(
            "SELECT timestamp FROM infra_snapshots ORDER BY timestamp DESC LIMIT 1"
        )
        row = cursor.fetchone()
        if row and row["timestamp"]:
            return datetime.fromisoformat(row["timestamp"]).replace(tzinfo=timezone.utc)
        return None

    @property
    def is_refreshing(self) -> bool:
        return self._is_refreshing

    @property
    def last_refresh_at(self) -> Optional[datetime]:
        return self._last_refresh_at

    def get_status(self) -> dict[str, Any]:
        return {
            "is_refreshing": self._is_refreshing,
            "last_refreshed_at": self._last_refresh_at.isoformat() if self._last_refresh_at else None,
            "source": self._last_source,
        }

    def get_cached_data(self) -> Optional[dict]:
        cursor = self._db.execute(
            "SELECT * FROM infra_snapshots ORDER BY timestamp DESC LIMIT 1"
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return json.loads(row["data"])

    async def refresh(self, source: str = "manual") -> dict:
        if self._is_refreshing:
            raise RefreshInProgressError()

        now = time.time()
        if self._last_refresh_at is not None:
            elapsed = now - self._last_refresh_at.timestamp()
            if elapsed < COOLDOWN_SECONDS:
                raise RefreshCooldownError(retry_after=COOLDOWN_SECONDS - elapsed)

        async with self._lock:
            if self._is_refreshing:
                raise RefreshInProgressError()

            self._is_refreshing = True
            try:
                snapshot_data = await self._do_refresh()
                self._last_refresh_at = datetime.now(timezone.utc)
                self._last_source = source
                logger.info("Refresh completed (source=%s)", source)

                if self._ws_broadcast:
                    await self._ws_broadcast({
                        "type": "infra_refreshed",
                        "last_refreshed_at": self._last_refresh_at.isoformat(),
                        "source": source,
                    })

                return snapshot_data
            finally:
                self._is_refreshing = False

    async def _broadcast_progress(self, done: int, total: int, stage: str):
        if self._ws_broadcast:
            await self._ws_broadcast({
                "type": "infra_refresh_progress",
                "done": done,
                "total": total,
                "stage": stage,
            })

    async def _do_refresh(self) -> dict:
        total_stages = 4
        datastores_cfg = get_datastores(self._db)
        ds_host = get_datastore_host(self._db)
        hosts_cfg = get_hosts(self._db)
        folders = get_vm_folders(self._db)
        folder_paths = [f["path"] for f in folders]
        group_map = {f["path"]: f.get("group", "") for f in folders}
        dc = get_datacenter(self._db)
        thresholds = get_thresholds(self._db)

        await self._broadcast_progress(0, total_stages, "datastores")

        ds_statuses = await asyncio.to_thread(
            self._infra_monitor.get_all_datastores, datastores_cfg, ds_host
        )
        await self._broadcast_progress(1, total_stages, "hosts")

        host_statuses = await asyncio.to_thread(
            self._infra_monitor.get_all_hosts, hosts_cfg
        )
        await self._broadcast_progress(2, total_stages, "vm_folders")

        vm_counts = await asyncio.to_thread(
            self._infra_monitor.get_all_vm_counts, folder_paths, dc
        )
        for vc in vm_counts:
            vc.group = group_map.get(vc.folder, "")
        await self._broadcast_progress(3, total_stages, "jenkins")

        monitored_jobs = get_monitored_jenkins_jobs(self._db)
        jenkins_jobs = []
        if monitored_jobs:
            job_names = [j["name"] for j in monitored_jobs]
            team_map = {j["name"]: j.get("team") for j in monitored_jobs}
            raw_results = await asyncio.to_thread(
                self._jenkins_client.get_monitored_job_statuses, job_names
            )
            jenkins_jobs = [{**r, "team": team_map.get(r["job_name"])} for r in raw_results]

        await self._broadcast_progress(4, total_stages, "done")

        cluster_usage = self._infra_monitor.calculate_cluster_usage(ds_statuses)
        max_cpu = max((h.cpu_percent for h in host_statuses if h.cpu_percent >= 0), default=0)
        state = self._infra_monitor.calculate_infra_state(
            storage_percent=cluster_usage, max_cpu_percent=max_cpu, thresholds=thresholds,
        )

        from backend.models import InfraSnapshot
        snapshot = InfraSnapshot(
            state=state,
            datastores=ds_statuses,
            cluster_usage_percent=round(cluster_usage, 1),
            hosts=host_statuses,
            vm_counts=vm_counts,
        )

        snapshot_dict = snapshot.model_dump(mode="json")
        snapshot_dict["jenkins_jobs"] = jenkins_jobs

        save_infra_snapshot(self._db, snapshot_dict)
        prune_old_snapshots(self._db, keep_days=30)
        return snapshot_dict

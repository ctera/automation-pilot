from __future__ import annotations

import sqlite3

from fastapi import APIRouter, HTTPException

from backend.config import get_monitored_jenkins_jobs
from backend.models import JenkinsJobStatus
from backend.services.jenkins_client import JenkinsClient

router = APIRouter(prefix="/api/jenkins", tags=["jenkins"])

_jenkins_client: JenkinsClient = None
_db: sqlite3.Connection = None


def init_jenkins_status(jenkins_client: JenkinsClient, db: sqlite3.Connection):
    global _jenkins_client, _db
    _jenkins_client = jenkins_client
    _db = db


@router.get("/job-statuses", response_model=list[JenkinsJobStatus])
async def get_job_statuses():
    if _jenkins_client is None or _db is None:
        raise HTTPException(503, "Service not initialized")
    monitored_jobs = get_monitored_jenkins_jobs(_db)
    if not monitored_jobs:
        return []
    job_names = [j["name"] for j in monitored_jobs]
    team_map = {j["name"]: j.get("team") for j in monitored_jobs}
    results = _jenkins_client.get_monitored_job_statuses(job_names)
    return [JenkinsJobStatus(**{**r, "team": team_map.get(r["job_name"])}) for r in results]

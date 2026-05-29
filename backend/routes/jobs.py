from __future__ import annotations

import json
import sqlite3

from fastapi import APIRouter, HTTPException

from backend.config import get_job_definitions
from backend.db import set_setting

router = APIRouter(prefix="/api", tags=["jobs"])

_db: sqlite3.Connection = None


def init_jobs(db):
    global _db
    _db = db


@router.get("/jobs")
async def list_jobs():
    if _db is None:
        raise HTTPException(503, "Service not initialized")
    return get_job_definitions(_db)

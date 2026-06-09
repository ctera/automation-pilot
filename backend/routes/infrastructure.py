from __future__ import annotations

from fastapi import APIRouter, HTTPException

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

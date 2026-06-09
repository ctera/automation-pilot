from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

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
        return snapshot
    except RefreshInProgressError:
        return JSONResponse(
            status_code=409,
            content={"detail": "Refresh already in progress", "retry_after_seconds": 0},
        )
    except RefreshCooldownError as exc:
        return JSONResponse(
            status_code=409,
            content={
                "detail": "Refresh cooldown active",
                "retry_after_seconds": round(exc.retry_after),
            },
        )


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

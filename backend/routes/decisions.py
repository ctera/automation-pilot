from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api", tags=["decisions"])

_decision_logger = None


def init_decisions(decision_logger):
    global _decision_logger
    _decision_logger = decision_logger


@router.get("/decisions")
async def list_decisions(
    intent_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    if _decision_logger is None:
        raise HTTPException(503, "Service not initialized")

    if intent_id is not None:
        results = await asyncio.to_thread(_decision_logger.get_for_intent, intent_id)
    else:
        results = await asyncio.to_thread(_decision_logger.get_all, limit=limit, offset=offset)
    return [dict(r) for r in results]

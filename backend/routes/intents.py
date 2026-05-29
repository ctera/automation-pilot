from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException

from backend.models import ReprioritizeRequest, StopRequest
from backend.services.intent_manager import InvalidTransitionError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["intents"])

_intent_manager = None
_jenkins_client = None


def init_intents(intent_manager, jenkins_client):
    global _intent_manager, _jenkins_client
    _intent_manager = intent_manager
    _jenkins_client = jenkins_client


@router.get("/intents")
async def list_intents():
    if _intent_manager is None:
        raise HTTPException(503, "Service not initialized")
    results = await asyncio.to_thread(_intent_manager.list_all)
    return [dict(r) for r in results]


@router.post("/intents/{intent_id}/cancel")
async def cancel_intent(intent_id: int):
    if _intent_manager is None:
        raise HTTPException(503, "Service not initialized")
    try:
        await asyncio.to_thread(_intent_manager.cancel, intent_id)
    except InvalidTransitionError as exc:
        raise HTTPException(400, str(exc))
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    intent = await asyncio.to_thread(_intent_manager.get, intent_id)
    return dict(intent)


@router.post("/intents/{intent_id}/stop")
async def stop_intent(intent_id: int, req: StopRequest = StopRequest()):
    if _intent_manager is None:
        raise HTTPException(503, "Service not initialized")
    try:
        intent = await asyncio.to_thread(_intent_manager.get, intent_id)
        if intent is None:
            raise HTTPException(404, f"Intent {intent_id} not found")

        if intent["jenkins_build_number"] and _jenkins_client:
            job_id = intent["job_id"]
            build_num = intent["jenkins_build_number"]
            try:
                await asyncio.to_thread(_jenkins_client.stop_build, job_id, build_num)
            except Exception as exc:
                logger.warning("Failed to stop Jenkins build %s #%d: %s", job_id, build_num, exc)

        await asyncio.to_thread(_intent_manager.stop, intent_id)
    except InvalidTransitionError as exc:
        raise HTTPException(400, str(exc))
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    intent = await asyncio.to_thread(_intent_manager.get, intent_id)
    return dict(intent)


@router.post("/intents/{intent_id}/reprioritize")
async def reprioritize_intent(intent_id: int, req: ReprioritizeRequest):
    if _intent_manager is None:
        raise HTTPException(503, "Service not initialized")
    try:
        await asyncio.to_thread(_intent_manager.reprioritize, intent_id, req.priority)
    except InvalidTransitionError as exc:
        raise HTTPException(400, str(exc))
    except ValueError as exc:
        raise HTTPException(404, str(exc))
    intent = await asyncio.to_thread(_intent_manager.get, intent_id)
    return dict(intent)

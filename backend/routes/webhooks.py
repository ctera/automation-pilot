from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException

from backend.models import WebhookPayload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["webhooks"])

_intent_manager = None
_orchestrator = None


def init_webhooks(intent_manager, orchestrator):
    global _intent_manager, _orchestrator
    _intent_manager = intent_manager
    _orchestrator = orchestrator


@router.post("/webhooks", status_code=201)
async def receive_webhook(payload: WebhookPayload):
    if _intent_manager is None:
        raise HTTPException(503, "Service not initialized")

    intent = await asyncio.to_thread(_intent_manager.create_from_webhook, payload)
    logger.info("Intent created: %s (job=%s, priority=%s)", intent["id"], payload.job_type, payload.priority.value)
    return dict(intent)

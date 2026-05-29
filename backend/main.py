from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import (
    get_datastores,
    get_datastore_host,
    get_datacenter,
    get_deployment_window,
    get_hosts,
    get_jenkins_config,
    get_job_definitions,
    get_thresholds,
    get_vm_folders,
    get_vmtools_config,
    load_config,
    seed_settings,
)
from backend.db import get_db, init_db
from backend.routes import decisions, infrastructure, intents, jobs, settings, webhooks
from backend.services.decision_logger import DecisionLogger
from backend.services.infra_monitor import InfraMonitor
from backend.services.intent_manager import IntentManager
from backend.services.jenkins_client import JenkinsClient
from backend.services.orchestrator import Orchestrator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("autopilot")

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend" / "build"


class ConnectionManager:
    """Manage active WebSocket connections for broadcasting updates."""

    def __init__(self):
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket):
        self._connections.remove(ws)

    async def broadcast(self, message: dict):
        data = json.dumps(message)
        for ws in list(self._connections):
            try:
                await ws.send_text(data)
            except Exception:
                self._connections.remove(ws)


ws_manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    config_path = os.environ.get("AUTOPILOT_CONFIG", "backend/config.yaml")
    cfg = load_config(config_path)

    port = cfg.get("server", {}).get("port", 8080)

    init_db()
    db = get_db()

    seed_settings(db, cfg)

    vmtools_cfg = get_vmtools_config(db)
    infra_monitor = InfraMonitor(
        java_cmd=vmtools_cfg.get("java_cmd", "java"),
        jar_path=vmtools_cfg.get("jar_path", "VmTools.jar"),
        timeout=vmtools_cfg.get("timeout_seconds", 120),
    )

    jenkins_cfg = get_jenkins_config(db)
    jenkins_client = JenkinsClient(
        base_url=jenkins_cfg.get("url", ""),
        user=os.environ.get("JENKINS_USER", ""),
        token=os.environ.get("JENKINS_TOKEN", ""),
    )

    intent_manager = IntentManager(db)
    decision_logger = DecisionLogger(db)

    orchestrator = Orchestrator(
        infra_monitor=infra_monitor,
        jenkins_client=jenkins_client,
        intent_manager=intent_manager,
        decision_logger=decision_logger,
        thresholds=get_thresholds(db),
        job_definitions=get_job_definitions(db),
        deployment_window_minutes=get_deployment_window(db),
        infra_fetch_kwargs={
            "datastores": get_datastores(db),
            "datastore_host": get_datastore_host(db),
            "hosts": get_hosts(db),
            "vm_folders": get_vm_folders(db),
            "datacenter": get_datacenter(db),
            "thresholds": get_thresholds(db),
        },
    )

    webhooks.init_webhooks(intent_manager, orchestrator)
    intents.init_intents(intent_manager, jenkins_client)
    infrastructure.init_infrastructure(infra_monitor, db)
    decisions.init_decisions(decision_logger)
    settings.init_settings(db)
    jobs.init_jobs(db)

    app.state.ws_manager = ws_manager

    logger.info("automation-pilot ready on port %d", port)
    yield

    db.close()
    logger.info("automation-pilot shut down")


app = FastAPI(
    title="automation-pilot",
    description="Automation execution orchestrator",
    lifespan=lifespan,
)

app.include_router(webhooks.router)
app.include_router(intents.router)
app.include_router(infrastructure.router)
app.include_router(decisions.router)
app.include_router(settings.router)
app.include_router(jobs.router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))

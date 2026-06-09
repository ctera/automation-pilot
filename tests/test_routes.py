import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def app_client(db):
    """Create a FastAPI TestClient with a test database."""
    from backend.config import load_config, seed_settings
    import os
    import tempfile
    import yaml

    config = {
        "server": {"port": 8080, "host": "0.0.0.0"},
        "vmtools": {"jar_path": "/fake/VmTools.jar", "java_cmd": "java", "timeout_seconds": 60},
        "jenkins": {"url": "https://jenkins.test", "cleanup_job_name": "cleanup"},
        "thresholds": {
            "storage": {"ready_below": 70, "constrained_below": 85},
            "cpu": {"ready_below": 75, "constrained_below": 85},
        },
        "staleness": {"warning_minutes": 5},
        "deployment_window_minutes": 30,
        "hosts": ["10.0.0.1"],
        "datastores": ["ds-1"],
        "datastore_host": "10.0.0.1",
        "datacenter": "TestDC",
        "vm_folders": ["/QA/Test"],
        "jobs": [],
    }
    seed_settings(db, config)

    from backend.routes import webhooks, intents, infrastructure, decisions, settings, jobs
    from backend.services.intent_manager import IntentManager
    from backend.services.decision_logger import DecisionLogger

    intent_mgr = IntentManager(db)
    decision_lgr = DecisionLogger(db)

    webhooks._intent_manager = intent_mgr
    webhooks._orchestrator = MagicMock()
    intents._intent_manager = intent_mgr
    intents._jenkins_client = MagicMock()
    infrastructure._refresh_service = MagicMock()
    decisions._decision_logger = decision_lgr
    settings._db = db
    jobs._db = db

    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(webhooks.router)
    app.include_router(intents.router)
    app.include_router(infrastructure.router)
    app.include_router(decisions.router)
    app.include_router(settings.router)
    app.include_router(jobs.router)

    with TestClient(app) as client:
        yield client


def test_webhook_creates_intent(app_client):
    resp = app_client.post("/api/webhooks", json={
        "job_type": "dev-nightly",
        "build_number": 5240,
        "priority": "normal",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["job_id"] == "dev-nightly"
    assert data["status"] == "pending"


def test_list_intents(app_client):
    app_client.post("/api/webhooks", json={"job_type": "job-a", "build_number": 1})
    app_client.post("/api/webhooks", json={"job_type": "job-b", "build_number": 2})

    resp = app_client.get("/api/intents")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_cancel_intent(app_client):
    create_resp = app_client.post("/api/webhooks", json={"job_type": "job-a", "build_number": 1})
    intent_id = create_resp.json()["id"]

    resp = app_client.post(f"/api/intents/{intent_id}/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_get_decisions(app_client):
    resp = app_client.get("/api/decisions")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_settings(app_client):
    resp = app_client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "hosts" in data
    assert "thresholds" in data


def test_update_setting(app_client):
    resp = app_client.put("/api/settings/hosts", json={"value": ["10.0.0.99"]})
    assert resp.status_code == 200

    get_resp = app_client.get("/api/settings")
    assert "10.0.0.99" in get_resp.json()["hosts"]

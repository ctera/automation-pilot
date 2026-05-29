import os
import tempfile
from pathlib import Path

import pytest
import yaml

from backend.config import load_config, seed_settings, get_hosts, get_datastores, get_thresholds


@pytest.fixture()
def config_file(tmp_path):
    config = {
        "server": {"port": 9090, "host": "0.0.0.0"},
        "vmtools": {"jar_path": "/tmp/VmTools.jar", "java_cmd": "java", "timeout_seconds": 60},
        "jenkins": {"url": "https://jenkins.test", "cleanup_job_name": "cleanup"},
        "thresholds": {
            "storage": {"ready_below": 70, "constrained_below": 85},
            "cpu": {"ready_below": 75, "constrained_below": 85},
        },
        "staleness": {"warning_minutes": 5},
        "deployment_window_minutes": 30,
        "hosts": ["10.0.0.1", "10.0.0.2"],
        "datastores": ["ds-1", "ds-2"],
        "datastore_host": "10.0.0.1",
        "datacenter": "TestDC",
        "vm_folders": ["/Test/Folder1"],
        "jobs": [],
    }
    path = tmp_path / "config.yaml"
    path.write_text(yaml.dump(config))
    return path


def test_load_config_reads_yaml(config_file):
    cfg = load_config(str(config_file))
    assert cfg["server"]["port"] == 9090
    assert cfg["hosts"] == ["10.0.0.1", "10.0.0.2"]
    assert cfg["thresholds"]["storage"]["ready_below"] == 70


def test_seed_settings_populates_db(config_file, db):
    cfg = load_config(str(config_file))
    seed_settings(db, cfg)
    hosts = get_hosts(db)
    assert hosts == ["10.0.0.1", "10.0.0.2"]


def test_seed_settings_does_not_overwrite(config_file, db):
    cfg = load_config(str(config_file))
    seed_settings(db, cfg)
    from backend.db import set_setting
    import json
    set_setting(db, "hosts", ["10.0.0.99"])
    seed_settings(db, cfg)
    hosts = get_hosts(db)
    assert hosts == ["10.0.0.99"]


def test_get_thresholds_returns_defaults(config_file, db):
    cfg = load_config(str(config_file))
    seed_settings(db, cfg)
    thresholds = get_thresholds(db)
    assert thresholds["storage"]["ready_below"] == 70
    assert thresholds["cpu"]["constrained_below"] == 85

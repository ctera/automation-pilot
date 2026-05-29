import subprocess
from unittest.mock import patch, MagicMock

import pytest

from backend.services.infra_monitor import InfraMonitor
from backend.models import InfraState, DatastoreStatus, HostStatus


@pytest.fixture()
def monitor():
    return InfraMonitor(
        java_cmd="java",
        jar_path="/fake/VmTools.jar",
        timeout=60,
    )


class TestGetDatastoreUsage:
    @patch("subprocess.run")
    def test_parses_stdout_integer(self, mock_run, monitor):
        mock_run.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="73\n", stderr="some log output"
        )
        result = monitor.get_datastore_usage("Hitachi-BS26-Automation-1", "192.168.81.155")
        assert result == DatastoreStatus(name="Hitachi-BS26-Automation-1", usage_percent=73)

    @patch("subprocess.run")
    def test_handles_error_exit(self, mock_run, monitor):
        mock_run.return_value = subprocess.CompletedProcess(
            args=[], returncode=1, stdout="", stderr="No matching datastore"
        )
        with pytest.raises(RuntimeError, match="VmTools.*failed"):
            monitor.get_datastore_usage("nonexistent", "192.168.81.155")


class TestGetHostInfo:
    @patch("subprocess.run")
    def test_parses_cpu_and_memory_from_stderr(self, mock_run, monitor):
        mock_run.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="",
            stderr=(
                "Used memory: 98304\n"
                "Used CPU: 15000\n"
                "CPU threads: 48\n"
                "Total CPU: 86400\n"
                "Total memory: 196608\n"
                "Memory - 50%\n"
                "CPU - 17%\n"
            ),
        )
        result = monitor.get_host_info("192.168.81.155")
        assert result == HostStatus(ip="192.168.81.155", cpu_percent=17, memory_percent=50)

    @patch("subprocess.run")
    def test_handles_missing_percent_lines(self, mock_run, monitor):
        mock_run.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="", stderr="Some unexpected output\n"
        )
        with pytest.raises(RuntimeError, match="parse.*host info"):
            monitor.get_host_info("192.168.81.155")


class TestCountVmsInFolder:
    @patch("subprocess.run")
    def test_counts_vm_lines(self, mock_run, monitor):
        mock_run.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="",
            stderr=(
                "vm=Portal-Daily-5240|folder=Portal-Daily\n"
                "vm=Portal-Daily-5240-GW|folder=Portal-Daily\n"
                "vm=Portal-Daily-5240-Agent|folder=Portal-Daily\n"
            ),
        )
        count = monitor.count_vms_in_folder("/DevProd/QA/Portal-Daily", "CTERA")
        assert count == 3

    @patch("subprocess.run")
    def test_empty_folder_returns_zero(self, mock_run, monitor):
        mock_run.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="", stderr=""
        )
        count = monitor.count_vms_in_folder("/DevProd/QA/Empty", "CTERA")
        assert count == 0


class TestCalculateInfraState:
    def test_ready_when_all_below_thresholds(self, monitor):
        thresholds = {
            "storage": {"ready_below": 70, "constrained_below": 85},
            "cpu": {"ready_below": 75, "constrained_below": 85},
        }
        state = monitor.calculate_infra_state(
            storage_percent=50.0, max_cpu_percent=60, thresholds=thresholds
        )
        assert state == InfraState.READY

    def test_constrained_when_storage_in_band(self, monitor):
        thresholds = {
            "storage": {"ready_below": 70, "constrained_below": 85},
            "cpu": {"ready_below": 75, "constrained_below": 85},
        }
        state = monitor.calculate_infra_state(
            storage_percent=75.0, max_cpu_percent=60, thresholds=thresholds
        )
        assert state == InfraState.CONSTRAINED

    def test_saturated_when_storage_above_threshold(self, monitor):
        thresholds = {
            "storage": {"ready_below": 70, "constrained_below": 85},
            "cpu": {"ready_below": 75, "constrained_below": 85},
        }
        state = monitor.calculate_infra_state(
            storage_percent=90.0, max_cpu_percent=60, thresholds=thresholds
        )
        assert state == InfraState.SATURATED

    def test_saturated_wins_over_constrained(self, monitor):
        thresholds = {
            "storage": {"ready_below": 70, "constrained_below": 85},
            "cpu": {"ready_below": 75, "constrained_below": 85},
        }
        state = monitor.calculate_infra_state(
            storage_percent=50.0, max_cpu_percent=90, thresholds=thresholds
        )
        assert state == InfraState.SATURATED

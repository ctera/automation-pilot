import os
from unittest.mock import patch, MagicMock

import pytest

from backend.services.jenkins_client import JenkinsClient


@pytest.fixture()
def client():
    return JenkinsClient(
        base_url="https://jenkins.test",
        user="admin",
        token="fake-token",
    )


class TestTriggerJob:
    @patch("requests.post")
    def test_trigger_returns_queue_url(self, mock_post, client):
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.headers = {"Location": "https://jenkins.test/queue/item/123/"}
        mock_post.return_value = mock_response

        queue_url = client.trigger_job("deploy_and_run", {"Branch": "main"})
        assert queue_url == "https://jenkins.test/queue/item/123/"
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert "deploy_and_run/buildWithParameters" in call_args[0][0]

    @patch("requests.post")
    def test_trigger_raises_on_failure(self, mock_post, client):
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = "Forbidden"
        mock_response.raise_for_status.side_effect = Exception("403 Forbidden")
        mock_post.return_value = mock_response

        with pytest.raises(RuntimeError, match="trigger.*failed"):
            client.trigger_job("some-job", {})


class TestStopBuild:
    @patch("requests.post")
    def test_stop_build_sends_post(self, mock_post, client):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        client.stop_build("deploy_and_run", 42)
        call_url = mock_post.call_args[0][0]
        assert "deploy_and_run/42/stop" in call_url


class TestGetBuildStatus:
    @patch("requests.get")
    def test_returns_build_info(self, mock_get, client):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "building": True,
            "result": None,
            "duration": 0,
            "timestamp": 1716940000000,
        }
        mock_get.return_value = mock_response

        info = client.get_build_status("deploy_and_run", 42)
        assert info["building"] is True
        assert "deploy_and_run/42/api/json" in mock_get.call_args[0][0]

    @patch("requests.get")
    def test_returns_none_on_404(self, mock_get, client):
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response

        info = client.get_build_status("deploy_and_run", 999)
        assert info is None


class TestGetRunningBuilds:
    @patch("requests.get")
    def test_filters_building_executors(self, mock_get, client):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "computer": [
                {
                    "displayName": "agent-1",
                    "executors": [
                        {
                            "currentExecutable": {
                                "url": "https://jenkins.test/job/deploy_and_run/42/",
                                "fullDisplayName": "deploy_and_run #42",
                            }
                        },
                        {"currentExecutable": None},
                    ],
                }
            ]
        }
        mock_get.return_value = mock_response

        builds = client.get_running_builds()
        assert len(builds) == 1
        assert builds[0]["fullDisplayName"] == "deploy_and_run #42"


class TestGetJobStatus:
    @patch("requests.get")
    def test_returns_completed_build_status_and_details(self, mock_get, client):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "name": "deploy_and_run",
            "builds": [{
                "number": 42,
                "building": False,
                "timestamp": 1716940000000,
                "duration": 125000,
                "estimatedDuration": 130000,
                "result": "FAILURE",
                "url": "https://jenkins.test/job/deploy_and_run/42/",
                "actions": [{
                    "parameters": [
                        {"name": "PortalImageVersion", "value": "8.5.0"},
                        {"name": "Run_with_toggles", "value": "true"},
                    ]
                }],
            }],
        }
        mock_get.return_value = mock_response

        status = client.get_job_status("deploy_and_run")

        assert status["status"] == "failure"
        assert status["build_number"] == 42
        assert status["duration_seconds"] == 125.0
        assert status["parameters"]["PortalImageVersion"] == "8.5.0"
        assert status["parameters"]["Run_with_toggles"] == "true"
        assert "running_builds" not in status

    @patch("requests.get")
    def test_returns_never_built_when_no_builds(self, mock_get, client):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "name": "new_job",
            "builds": [],
        }
        mock_get.return_value = mock_response

        status = client.get_job_status("new_job")

        assert status["status"] == "never_built"
        assert status["build_number"] is None
        assert status["duration_seconds"] is None

    @patch("backend.services.jenkins_client.time.time", return_value=1716940600.0)
    @patch("requests.get")
    def test_includes_running_builds(self, mock_get, _mock_time, client):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "name": "deploy_and_run",
            "builds": [
                {
                    "number": 102,
                    "building": True,
                    "timestamp": 1716940300000,
                    "estimatedDuration": 240000,
                    "result": None,
                    "url": "https://jenkins.test/job/deploy_and_run/102/",
                    "actions": [{"parameters": [{"name": "PortalImageVersion", "value": "8.5.2"}]}],
                },
                {
                    "number": 101,
                    "building": True,
                    "timestamp": 1716940000000,
                    "estimatedDuration": 300000,
                    "result": None,
                    "url": "https://jenkins.test/job/deploy_and_run/101/",
                    "actions": [{"parameters": [{"name": "PortalImageVersion", "value": "8.5.1"}]}],
                },
                {
                    "number": 100,
                    "building": False,
                    "timestamp": 1716939000000,
                    "duration": 90000,
                    "estimatedDuration": 100000,
                    "result": "SUCCESS",
                    "url": "https://jenkins.test/job/deploy_and_run/100/",
                    "actions": [],
                },
            ],
        }
        mock_get.return_value = mock_response

        status = client.get_job_status("deploy_and_run")

        assert status["is_building"] is True
        assert status["build_number"] == 102
        running_builds = status["running_builds"]
        assert len(running_builds) == 2
        assert [b["build_number"] for b in running_builds] == [102, 101]
        assert running_builds[0]["duration_seconds"] == 300.0
        assert running_builds[1]["duration_seconds"] == 600.0
        assert running_builds[1]["parameters"]["PortalImageVersion"] == "8.5.1"


class TestGetMonitoredJobStatuses:
    def test_collects_statuses_for_all_jobs(self, client):
        job_a = {
            "job_name": "deploy_and_run",
            "status": "success",
            "is_building": False,
            "build_number": 42,
            "duration_seconds": 90.0,
            "estimated_duration_seconds": 120.0,
            "job_url": "https://jenkins.test/job/deploy_and_run/",
            "build_url": "https://jenkins.test/job/deploy_and_run/42/",
            "parameters": None,
        }
        job_b = {
            "job_name": "PIM_sanity",
            "status": "running",
            "is_building": True,
            "build_number": 10,
            "duration_seconds": 60.0,
            "estimated_duration_seconds": 180.0,
            "job_url": "https://jenkins.test/job/PIM_sanity/",
            "build_url": "https://jenkins.test/job/PIM_sanity/10/",
            "parameters": {"IMG_TEMPLATE_NAME": "portal-8.5"},
            "running_builds": [{"build_number": 10, "status": "running", "is_building": True,
                                "duration_seconds": 60.0, "estimated_duration_seconds": 180.0,
                                "build_url": "https://jenkins.test/job/PIM_sanity/10/",
                                "parameters": {"IMG_TEMPLATE_NAME": "portal-8.5"}}],
        }

        with patch.object(client, "get_job_status", side_effect=[job_a, job_b]):
            statuses = client.get_monitored_job_statuses(["deploy_and_run", "PIM_sanity"])

        assert len(statuses) == 2
        assert statuses[0]["job_name"] == "deploy_and_run"
        assert statuses[1]["job_name"] == "PIM_sanity"
        assert statuses[1]["running_builds"][0]["build_number"] == 10

    def test_returns_error_status_on_exception(self, client):
        with patch.object(client, "get_job_status", side_effect=Exception("connection refused")):
            statuses = client.get_monitored_job_statuses(["broken_job"])

        assert len(statuses) == 1
        assert statuses[0]["status"] == "error"
        assert "connection refused" in statuses[0]["error"]
        assert statuses[0]["job_name"] == "broken_job"

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

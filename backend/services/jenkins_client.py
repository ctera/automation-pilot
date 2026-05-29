from __future__ import annotations

import logging
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)


class JenkinsClient:
    def __init__(self, *, base_url: str, user: str, token: str):
        self._base = base_url.rstrip("/")
        self._auth = (user, token)

    def _url(self, path: str) -> str:
        return f"{self._base}/{path.lstrip('/')}"

    def trigger_job(self, job_name: str, parameters: dict[str, Any]) -> str:
        url = self._url(f"job/{job_name}/buildWithParameters")
        try:
            resp = requests.post(url, auth=self._auth, params=parameters, timeout=30)
            resp.raise_for_status()
        except Exception as exc:
            raise RuntimeError(f"Jenkins trigger for {job_name} failed: {exc}") from exc
        return resp.headers.get("Location", "")

    def stop_build(self, job_name: str, build_number: int) -> None:
        url = self._url(f"job/{job_name}/{build_number}/stop")
        try:
            resp = requests.post(url, auth=self._auth, timeout=30)
            resp.raise_for_status()
        except Exception as exc:
            logger.warning("Failed to stop %s #%d: %s", job_name, build_number, exc)

    def get_build_status(self, job_name: str, build_number: int) -> Optional[dict]:
        url = self._url(f"job/{job_name}/{build_number}/api/json")
        resp = requests.get(url, auth=self._auth, timeout=30)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()

    def get_running_builds(self) -> list[dict]:
        url = self._url("computer/api/json?depth=2")
        resp = requests.get(url, auth=self._auth, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        builds = []
        for computer in data.get("computer", []):
            for executor in computer.get("executors", []):
                exe = executor.get("currentExecutable")
                if exe:
                    builds.append(exe)
        return builds

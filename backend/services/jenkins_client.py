from __future__ import annotations

import logging
import time
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)

_EXTRACT_PARAMS = {"IMG_TEMPLATE_NAME", "PortalImageVersion", "Run_with_toggles", "Upgrade_List"}


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

    def get_job_status(self, job_name: str) -> dict:
        """Fetch current build status for a single job."""
        url = self._url(f"job/{job_name}/api/json")
        params = {
            "tree": "name,displayName,lastBuild[number,building,timestamp,duration,"
                    "estimatedDuration,result,url,actions[parameters[name,value]]]"
        }
        resp = requests.get(url, auth=self._auth, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        last_build = data.get("lastBuild")
        if not last_build:
            return {
                "job_name": job_name,
                "is_building": False,
                "build_number": None,
                "duration_seconds": None,
                "estimated_duration_seconds": None,
                "build_url": None,
                "parameters": None,
            }

        is_building = last_build.get("building", False)

        if is_building:
            elapsed_ms = time.time() * 1000 - last_build.get("timestamp", 0)
            duration_seconds = round(elapsed_ms / 1000, 1)
        else:
            duration_seconds = round(last_build.get("duration", 0) / 1000, 1)

        estimated_ms = last_build.get("estimatedDuration")
        estimated_seconds = round(estimated_ms / 1000, 1) if estimated_ms else None

        extracted_params = {}
        for action in last_build.get("actions", []):
            if not isinstance(action, dict):
                continue
            for param in action.get("parameters", []):
                name = param.get("name", "")
                value = param.get("value")
                if name in _EXTRACT_PARAMS and value not in (None, ""):
                    extracted_params[name] = value

        return {
            "job_name": job_name,
            "is_building": is_building,
            "build_number": last_build.get("number"),
            "duration_seconds": duration_seconds,
            "estimated_duration_seconds": estimated_seconds,
            "build_url": last_build.get("url"),
            "parameters": extracted_params or None,
        }

    def get_monitored_job_statuses(self, job_names: list[str]) -> list[dict]:
        """Fetch status for all monitored jobs."""
        results = []
        for name in job_names:
            try:
                results.append(self.get_job_status(name))
            except Exception as exc:
                results.append({
                    "job_name": name,
                    "is_building": False,
                    "build_number": None,
                    "duration_seconds": None,
                    "estimated_duration_seconds": None,
                    "build_url": None,
                    "parameters": None,
                    "error": str(exc),
                })
        return results

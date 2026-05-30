from __future__ import annotations

import logging
import re
import time
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)

_EXTRACT_PARAMS = {"IMG_TEMPLATE_NAME", "PortalImageVersion", "Run_with_toggles", "Upgrade_List"}
_FULL_DISPLAY_RE = re.compile(r"^(?P<job>.+?)\s+#(?P<number>\d+)$")


def _normalize_build_result(result: Any) -> str:
    if not result:
        return "unknown"
    normalized = str(result).strip().lower().replace(" ", "_")
    if normalized in {"failed", "failure"}:
        return "failure"
    return normalized


def _extract_params(actions: list[Any]) -> Optional[dict[str, Any]]:
    extracted_params: dict[str, Any] = {}
    for action in actions:
        if not isinstance(action, dict):
            continue
        for param in action.get("parameters", []):
            name = param.get("name", "")
            value = param.get("value")
            if name in _EXTRACT_PARAMS and value not in (None, ""):
                extracted_params[name] = value
    return extracted_params or None


def _parse_running_executable(executable: dict[str, Any]) -> tuple[Optional[str], Optional[int]]:
    url = str(executable.get("url") or "").strip()
    if url:
        path_parts = [part for part in url.split("?")[0].split("/") if part]
        job_parts: list[str] = []
        for idx, part in enumerate(path_parts):
            if part == "job" and idx + 1 < len(path_parts):
                job_parts.append(path_parts[idx + 1])
        build_number = next((int(part) for part in reversed(path_parts) if part.isdigit()), None)
        if job_parts and build_number is not None:
            return "/".join(job_parts), build_number

    full_display = str(executable.get("fullDisplayName") or "").strip()
    match = _FULL_DISPLAY_RE.match(full_display)
    if not match:
        return None, None

    return match.group("job"), int(match.group("number"))


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

    def _build_status_payload(self, build_data: dict) -> dict:
        is_building = bool(build_data.get("building", False))
        status = "running" if is_building else _normalize_build_result(build_data.get("result"))

        if is_building:
            timestamp_ms = build_data.get("timestamp")
            if isinstance(timestamp_ms, (int, float)):
                elapsed_ms = max((time.time() * 1000) - timestamp_ms, 0)
                duration_seconds = round(elapsed_ms / 1000, 1)
            else:
                duration_seconds = None
        else:
            duration_ms = build_data.get("duration")
            duration_seconds = round(duration_ms / 1000, 1) if isinstance(duration_ms, (int, float)) else None

        estimated_ms = build_data.get("estimatedDuration")
        estimated_seconds = round(estimated_ms / 1000, 1) if isinstance(estimated_ms, (int, float)) else None

        return {
            "status": status,
            "is_building": is_building,
            "build_number": build_data.get("number"),
            "duration_seconds": duration_seconds,
            "estimated_duration_seconds": estimated_seconds,
            "build_url": build_data.get("url"),
            "parameters": _extract_params(build_data.get("actions", [])),
        }

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

        job_url = f"{self._base}/job/{job_name}/"

        last_build = data.get("lastBuild")
        if not last_build:
            return {
                "job_name": job_name,
                "status": "never_built",
                "is_building": False,
                "build_number": None,
                "duration_seconds": None,
                "estimated_duration_seconds": None,
                "job_url": job_url,
                "build_url": None,
                "parameters": None,
            }

        return {
            "job_name": job_name,
            "job_url": job_url,
            **self._build_status_payload(last_build),
        }

    def _running_build_numbers_by_job(self, job_names: list[str]) -> dict[str, list[int]]:
        monitored = set(job_names)
        numbers_by_job: dict[str, set[int]] = {name: set() for name in monitored}

        for executable in self.get_running_builds():
            running_job, running_number = _parse_running_executable(executable)
            if not running_job or running_number is None or running_job not in monitored:
                continue
            numbers_by_job[running_job].add(running_number)

        return {
            name: sorted(numbers, reverse=True)
            for name, numbers in numbers_by_job.items()
            if numbers
        }

    def get_monitored_job_statuses(self, job_names: list[str]) -> list[dict]:
        """Fetch status for all monitored jobs."""
        try:
            running_by_job = self._running_build_numbers_by_job(job_names)
        except Exception as exc:
            logger.warning("Failed collecting running build list: %s", exc)
            running_by_job = {}

        results = []
        for name in job_names:
            try:
                job_status = self.get_job_status(name)

                running_builds = []
                for build_number in running_by_job.get(name, []):
                    try:
                        build_data = self.get_build_status(name, build_number)
                    except Exception as exc:
                        logger.warning("Failed to fetch %s #%d details: %s", name, build_number, exc)
                        continue
                    if not build_data or not build_data.get("building", False):
                        continue
                    running_builds.append(self._build_status_payload(build_data))

                if running_builds:
                    job_status["running_builds"] = running_builds

                results.append(job_status)
            except Exception as exc:
                results.append({
                    "job_name": name,
                    "status": "error",
                    "is_building": False,
                    "build_number": None,
                    "duration_seconds": None,
                    "estimated_duration_seconds": None,
                    "job_url": f"{self._base}/job/{name}/",
                    "build_url": None,
                    "parameters": None,
                    "running_builds": None,
                    "error": str(exc),
                })
        return results

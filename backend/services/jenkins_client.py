from __future__ import annotations

import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
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
        self._session = requests.Session()
        self._session.auth = self._auth
        self._crumb_header: Optional[tuple[str, str]] = None

    def _url(self, path: str) -> str:
        return f"{self._base}/{path.lstrip('/')}"

    def _ensure_crumb(self) -> None:
        if self._crumb_header is not None:
            return
        try:
            resp = self._session.get(
                self._url("crumbIssuer/api/json"), timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                self._crumb_header = (data["crumbRequestField"], data["crumb"])
        except Exception:
            pass

    def _post(self, url: str, **kwargs) -> requests.Response:
        """POST with crumb header and session cookies."""
        self._ensure_crumb()
        headers = kwargs.pop("headers", {})
        if self._crumb_header:
            headers[self._crumb_header[0]] = self._crumb_header[1]
        resp = self._session.post(url, headers=headers, **kwargs)
        if resp.status_code == 403 and "crumb" in resp.text.lower():
            self._crumb_header = None
            self._ensure_crumb()
            if self._crumb_header:
                headers[self._crumb_header[0]] = self._crumb_header[1]
                resp = self._session.post(url, headers=headers, **kwargs)
        return resp

    def trigger_job(self, job_name: str, parameters: dict[str, Any]) -> str:
        url = self._url(f"job/{job_name}/buildWithParameters")
        try:
            resp = self._post(url, params=parameters, timeout=30)
            resp.raise_for_status()
        except Exception as exc:
            raise RuntimeError(f"Jenkins trigger for {job_name} failed: {exc}") from exc
        return resp.headers.get("Location", "")

    def stop_build(self, job_name: str, build_number: int) -> None:
        url = self._url(f"job/{job_name}/{build_number}/stop")
        try:
            resp = self._post(url, timeout=30)
            resp.raise_for_status()
        except Exception as exc:
            logger.warning("Failed to stop %s #%d: %s", job_name, build_number, exc)

    def get_build_status(self, job_name: str, build_number: int) -> Optional[dict]:
        url = self._url(f"job/{job_name}/{build_number}/api/json")
        resp = self._session.get(url, timeout=30)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()

    def get_running_builds(self) -> list[dict]:
        url = self._url("computer/api/json?depth=2")
        resp = self._session.get(url, timeout=30)
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
        """Fetch current build status for a single job including all running builds."""
        url = self._url(f"job/{job_name}/api/json")
        params = {
            "tree": "name,displayName,builds[number,building,timestamp,duration,"
                    "estimatedDuration,result,url,actions[parameters[name,value]]]{0,10}"
        }
        resp = self._session.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        job_url = f"{self._base}/job/{job_name}/"

        builds = data.get("builds") or []
        if not builds:
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
                "running_builds": None,
            }

        last_build = builds[0]
        running_builds = [
            self._build_status_payload(b) for b in builds if b.get("building", False)
        ]

        result = {
            "job_name": job_name,
            "job_url": job_url,
            **self._build_status_payload(last_build),
        }
        if running_builds:
            result["running_builds"] = running_builds
        return result

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

    def enable_job(self, job_name: str) -> None:
        url = self._url(f"job/{job_name}/enable")
        resp = self._post(url, timeout=30, allow_redirects=False)
        if resp.status_code not in (200, 302):
            resp.raise_for_status()

    def disable_job(self, job_name: str) -> None:
        url = self._url(f"job/{job_name}/disable")
        resp = self._post(url, timeout=30, allow_redirects=False)
        if resp.status_code not in (200, 302):
            resp.raise_for_status()

    def get_job_config_xml(self, job_name: str) -> str:
        url = self._url(f"job/{job_name}/config.xml")
        resp = self._session.get(url, timeout=30, headers={"Cache-Control": "no-cache"})
        resp.raise_for_status()
        return resp.text

    def update_job_config_xml(self, job_name: str, config_xml: str) -> None:
        url = self._url(f"job/{job_name}/config.xml")
        resp = self._post(
            url, data=config_xml.encode("utf-8"),
            headers={"Content-Type": "text/xml"}, timeout=30,
            allow_redirects=False,
        )
        logger.info("config.xml POST %s -> %d", job_name, resp.status_code)
        if resp.status_code not in (200, 302):
            logger.error("config.xml POST failed: %s", resp.text[:500])
            resp.raise_for_status()

    def get_job_info(self, job_name: str) -> dict:
        url = self._url(f"job/{job_name}/api/json")
        params = {"tree": "name,buildable,description"}
        resp = self._session.get(url, params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def get_monitored_job_statuses(self, job_names: list[str]) -> list[dict]:
        """Fetch status for all monitored jobs in parallel."""
        def _safe_get(name: str) -> dict:
            try:
                return self.get_job_status(name)
            except Exception as exc:
                return {
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
                }

        with ThreadPoolExecutor(max_workers=len(job_names) or 1) as pool:
            futures = {pool.submit(_safe_get, name): idx for idx, name in enumerate(job_names)}
            results = [None] * len(job_names)
            for future in as_completed(futures):
                results[futures[future]] = future.result()
        return results

from __future__ import annotations

import asyncio
import logging
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Optional

import pytz
from croniter import croniter
from fastapi import APIRouter, HTTPException

from backend.models import PortalTriggerJob, ScheduleUpdateRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["portal-triggers"])

_jenkins_client = None

TZ = pytz.timezone("Asia/Jerusalem")

TRIGGER_JOBS: list[dict[str, str]] = [
    {
        "job_name": "Genesis9_Portal_Trigger_Image_Build_If_Dev_Repo_Changed",
        "description": "Portal dev image build trigger (starts daily at 22:00)",
    },
    {
        "job_name": "TriggerPortalTestsWithToggles-pipeline",
        "description": "Portal dev toggles automation trigger",
    },
    {
        "job_name": "TriggerAllPortalTestSuites",
        "description": "Trigger job for running portal regression automation cycle",
    },
]


def init_portal_triggers(jenkins_client) -> None:
    global _jenkins_client
    _jenkins_client = jenkins_client


def _extract_cron_spec(config_xml: str) -> Optional[str]:
    try:
        root = ET.fromstring(config_xml)
        spec_el = root.find(".//triggers/hudson.triggers.TimerTrigger/spec")
        if spec_el is not None and spec_el.text:
            return spec_el.text.strip()
    except ET.ParseError:
        logger.warning("Failed to parse config.xml for cron spec")
    return None


def _update_cron_spec(config_xml: str, new_spec: Optional[str]) -> str:
    root = ET.fromstring(config_xml)

    # Find the existing TimerTrigger directly — avoids ambiguity when multiple
    # <triggers> elements exist (pipeline jobs have one inside
    # PipelineTriggersJobProperty and an empty vestigial one at root level).
    timer = root.find(".//triggers/hudson.triggers.TimerTrigger")

    if new_spec is None:
        if timer is not None:
            for triggers_el in root.iter("triggers"):
                if timer in list(triggers_el):
                    triggers_el.remove(timer)
                    break
    else:
        if timer is not None:
            spec_el = timer.find("spec")
            if spec_el is None:
                spec_el = ET.SubElement(timer, "spec")
            spec_el.text = new_spec
        else:
            triggers_el = root.find(".//triggers")
            if triggers_el is None:
                triggers_el = ET.SubElement(root, "triggers")
            timer = ET.SubElement(triggers_el, "hudson.triggers.TimerTrigger")
            spec_el = ET.SubElement(timer, "spec")
            spec_el.text = new_spec

    return ET.tostring(root, encoding="unicode", xml_declaration=True)


def _cron_messages(spec: str) -> tuple[Optional[str], Optional[str]]:
    """Compute human-readable last/next run messages from a cron spec.

    Handles multi-line specs (one cron expression per line) by picking
    the most recent previous run and the soonest next run across all lines.
    """
    lines = [l.strip().replace("H", "0") for l in spec.splitlines() if l.strip()]
    if not lines:
        return None, None

    now = datetime.now(TZ)
    prev_candidates: list[datetime] = []
    next_candidates: list[datetime] = []

    for line in lines:
        try:
            cron_next = croniter(line, now)
            next_candidates.append(cron_next.get_next(datetime).astimezone(TZ))
            cron_prev = croniter(line, now)
            prev_candidates.append(cron_prev.get_prev(datetime).astimezone(TZ))
        except (ValueError, KeyError):
            continue

    if not next_candidates:
        return None, None

    fmt = "%a %b %d, %I:%M %p %Z"
    prev_dt = max(prev_candidates) if prev_candidates else None
    next_dt = min(next_candidates)

    last_msg = f"Last: {prev_dt.strftime(fmt)}" if prev_dt else None
    next_msg = f"Next: {next_dt.strftime(fmt)}"
    return last_msg, next_msg


def _fetch_single_trigger(job_def: dict[str, str]) -> PortalTriggerJob:
    name = job_def["job_name"]
    base = _jenkins_client._base

    try:
        info = _jenkins_client.get_job_info(name)
        enabled = info.get("buildable", True)
    except Exception as exc:
        logger.warning("Failed to get job info for %s: %s", name, exc)
        enabled = True

    cron_spec = None
    try:
        config_xml = _jenkins_client.get_job_config_xml(name)
        cron_spec = _extract_cron_spec(config_xml)
    except Exception as exc:
        logger.warning("Failed to get config.xml for %s: %s", name, exc)

    last_msg, next_msg = (None, None)
    if cron_spec:
        last_msg, next_msg = _cron_messages(cron_spec)

    return PortalTriggerJob(
        job_name=name,
        description=job_def["description"],
        job_url=f"{base}/job/{name}/",
        config_url=f"{base}/job/{name}/configure",
        enabled=enabled,
        cron_spec=cron_spec,
        last_run_message=last_msg,
        next_run_message=next_msg,
    )


@router.get("/portal-triggers")
async def list_portal_triggers():
    if _jenkins_client is None:
        raise HTTPException(503, "Service not initialized")

    def _fetch_all():
        with ThreadPoolExecutor(max_workers=len(TRIGGER_JOBS)) as pool:
            futures = {
                pool.submit(_fetch_single_trigger, job_def): idx
                for idx, job_def in enumerate(TRIGGER_JOBS)
            }
            results: list[Optional[PortalTriggerJob]] = [None] * len(TRIGGER_JOBS)
            for future in as_completed(futures):
                idx = futures[future]
                try:
                    results[idx] = future.result()
                except Exception as exc:
                    job_def = TRIGGER_JOBS[idx]
                    logger.error("Error fetching trigger %s: %s", job_def["job_name"], exc)
                    results[idx] = PortalTriggerJob(
                        job_name=job_def["job_name"],
                        description=job_def["description"],
                        job_url=f"{_jenkins_client._base}/job/{job_def['job_name']}/",
                        config_url=f"{_jenkins_client._base}/job/{job_def['job_name']}/configure",
                        enabled=True,
                    )
            return results

    results = await asyncio.to_thread(_fetch_all)
    return [r.model_dump() for r in results]


@router.post("/portal-triggers/{job_name}/enable")
async def enable_trigger(job_name: str):
    if _jenkins_client is None:
        raise HTTPException(503, "Service not initialized")
    try:
        await asyncio.to_thread(_jenkins_client.enable_job, job_name)
    except Exception as exc:
        raise HTTPException(502, f"Failed to enable {job_name}: {exc}")
    return {"status": "ok", "job_name": job_name, "enabled": True}


@router.post("/portal-triggers/{job_name}/disable")
async def disable_trigger(job_name: str):
    if _jenkins_client is None:
        raise HTTPException(503, "Service not initialized")
    try:
        await asyncio.to_thread(_jenkins_client.disable_job, job_name)
    except Exception as exc:
        raise HTTPException(502, f"Failed to disable {job_name}: {exc}")
    return {"status": "ok", "job_name": job_name, "enabled": False}


@router.put("/portal-triggers/{job_name}/schedule")
async def update_schedule(job_name: str, req: ScheduleUpdateRequest):
    if _jenkins_client is None:
        raise HTTPException(503, "Service not initialized")

    def _do_update():
        config_xml = _jenkins_client.get_job_config_xml(job_name)
        old_spec = _extract_cron_spec(config_xml)
        logger.info("Schedule update %s: %r -> %r", job_name, old_spec, req.spec)
        updated_xml = _update_cron_spec(config_xml, req.spec)
        _jenkins_client.update_job_config_xml(job_name, updated_xml)
        verify_xml = _jenkins_client.get_job_config_xml(job_name)
        verify_spec = _extract_cron_spec(verify_xml)
        logger.info("Schedule verify %s: Jenkins now has %r", job_name, verify_spec)
        return _fetch_single_trigger(
            next(j for j in TRIGGER_JOBS if j["job_name"] == job_name)
        )

    try:
        result = await asyncio.to_thread(_do_update)
    except StopIteration:
        raise HTTPException(404, f"Job {job_name} not in trigger list")
    except Exception as exc:
        raise HTTPException(502, f"Failed to update schedule for {job_name}: {exc}")
    return result.model_dump()

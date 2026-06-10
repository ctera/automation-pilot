---
name: DB-First Refresh Strategy
overview: Change the refresh system to serve cached data from DB by default, only hitting vSphere/Jenkins when data is actually stale. This eliminates the 409 error UX and reduces vSphere load.
todos:
  - id: backend-return-cached
    content: Change POST /refresh to return cached data (200 + from_cache flag) instead of 409
    status: completed
  - id: seed-last-refresh
    content: Seed _last_refresh_at from DB timestamp on RefreshService init
    status: completed
  - id: smart-auto-schedule
    content: Rewrite _auto_refresh_loop to schedule relative to last refresh time
    status: completed
  - id: frontend-force-param
    content: Add force parameter to refresh(), skip call if data is fresh and force=false
    status: completed
  - id: remove-cooldown-toast
    content: Remove Snackbar/cooldown toast, show subtle cached indicator instead
    status: completed
isProject: false
---

# DB-First Refresh Strategy

## Core Principle

Never show an error when the user asks for data. If a live refresh cannot run (cooldown or in-progress), return the cached DB snapshot transparently. Only hit vSphere when data is genuinely stale.

## Changes

### 1. Backend: Return cached data instead of 409 on cooldown

**File:** [`backend/routes/infrastructure.py`](backend/routes/infrastructure.py)

Currently the `POST /infrastructure/refresh` endpoint returns 409 when cooldown is active. Change it to return the cached snapshot with a `"from_cache": true` flag:

```python
@router.post("/infrastructure/refresh")
async def refresh_infrastructure():
    _ensure_initialized()
    try:
        snapshot = await _refresh_service.refresh(source="manual")
        return {**snapshot, "from_cache": False}
    except RefreshInProgressError:
        cached = _refresh_service.get_cached_data()
        status = _refresh_service.get_status()
        return {**(cached or {}), "from_cache": True, "last_refreshed_at": status["last_refreshed_at"]}
    except RefreshCooldownError:
        cached = _refresh_service.get_cached_data()
        status = _refresh_service.get_status()
        return {**(cached or {}), "from_cache": True, "last_refreshed_at": status["last_refreshed_at"]}
```

This means:
- The endpoint always returns 200 with data
- `from_cache: false` = live refresh happened
- `from_cache: true` = data came from DB (still fresh)
- No more 409 responses, no more toast errors

### 2. Frontend: Skip refresh call if data is recent enough

**File:** [`frontend/src/context/InfraContext.jsx`](frontend/src/context/InfraContext.jsx)

Add a staleness check before calling the backend. If `lastRefreshedAt` is less than 2 minutes old and the trigger is automatic (page open, settings-changed nav), skip the HTTP call entirely:

- Add a `refresh(force)` parameter: `force=true` (manual button) always calls the backend; `force=false` (automatic triggers) skips if data is < 2 min old.
- Dashboard's settings-changed trigger and `loadCached` on mount already provide data without hitting vSphere. The explicit `refresh()` from the button would pass `force=true`.
- Remove the cooldown toast entirely (no longer needed since the backend never returns 409).
- When `from_cache: true` is in the response, show a subtle "Updated (cached)" label instead of the progress bar.

**File:** [`frontend/src/pages/Dashboard.jsx`](frontend/src/pages/Dashboard.jsx)

The settings-changed trigger calls `refresh(false)` — which will skip if data is fresh.

### 3. Backend: Smart auto-refresh scheduling

**File:** [`backend/main.py`](backend/main.py) (the `_auto_refresh_loop` function)

Currently sleeps a fixed 600s regardless of when the last refresh happened. Change to:

```python
async def _auto_refresh_loop(refresh_service: RefreshService):
    while True:
        last = refresh_service.last_refresh_at
        if last is not None:
            elapsed = (datetime.now(timezone.utc) - last).total_seconds()
            wait = max(AUTO_REFRESH_INTERVAL_SECONDS - elapsed, 10)
        else:
            wait = 10  # first refresh soon after startup
        await asyncio.sleep(wait)
        try:
            await refresh_service.refresh(source="auto")
        except (RefreshCooldownError, RefreshInProgressError):
            pass
        except Exception:
            logger.exception("Auto-refresh failed")
```

This way:
- If a user manually refreshed 8 minutes in, the next auto-refresh fires 2 minutes later (not 10 minutes later)
- Refreshes are evenly spaced at exactly 10 min apart, regardless of source
- On startup with no cached data, the first auto-refresh fires after 10 seconds (fast startup)

### 5. Backend: Defer first auto-refresh if DB has recent data

In the same `_auto_refresh_loop` logic above, the `last` check handles this naturally:

- On startup, `refresh_service.last_refresh_at` is `None` (in-memory state is empty)
- But we should **seed** it from the DB snapshot timestamp on init so the loop knows data already exists

**File:** [`backend/services/refresh_service.py`](backend/services/refresh_service.py)

In `__init__`, read the latest snapshot timestamp from DB and set `_last_refresh_at` if it exists:

```python
def __init__(self, ...):
    ...
    self._last_refresh_at = self._load_last_refresh_time()

def _load_last_refresh_time(self) -> Optional[datetime]:
    cursor = self._db.execute(
        "SELECT timestamp FROM infra_snapshots ORDER BY timestamp DESC LIMIT 1"
    )
    row = cursor.fetchone()
    if row and row["timestamp"]:
        return datetime.fromisoformat(row["timestamp"]).replace(tzinfo=timezone.utc)
    return None
```

This means:
- If the service restarts and the last snapshot is 3 minutes old, the auto-refresh waits 7 more minutes
- If the last snapshot is 15 minutes old (stale), the first auto-refresh fires after 10 seconds
- UI renders instantly from DB cache on startup without waiting for vSphere

## UX Changes Summary

| Scenario | Before | After |
|----------|--------|-------|
| Click Refresh within 60s | Toast error "wait 60s" | Returns cached data, shows "Updated (cached)" |
| Page open (data < 2 min old) | No refresh (already working) | Same, no change |
| Settings saved, navigate to Dashboard | Calls refresh, may get 409 | Calls refresh; if cooldown, gets cached data silently |
| Service restart, data 3 min old | First auto-refresh in 10 min | First auto-refresh in 7 min; UI shows cached immediately |
| Service restart, data 20 min old | First auto-refresh in 10 min | First auto-refresh in ~10 seconds |

## Files Modified

- [`backend/services/refresh_service.py`](backend/services/refresh_service.py) — seed `_last_refresh_at` from DB on init
- [`backend/routes/infrastructure.py`](backend/routes/infrastructure.py) — return cached data instead of 409
- [`backend/main.py`](backend/main.py) — smart auto-refresh timing relative to last refresh
- [`frontend/src/context/InfraContext.jsx`](frontend/src/context/InfraContext.jsx) — add `force` parameter, remove cooldown toast, handle `from_cache` flag
- [`frontend/src/pages/Dashboard.jsx`](frontend/src/pages/Dashboard.jsx) — pass `force=false` to settings-changed refresh
- [`frontend/src/components/widgets/InfraStatusBar.jsx`](frontend/src/components/widgets/InfraStatusBar.jsx) — remove Snackbar, show "(cached)" label when appropriate

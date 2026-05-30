#!/usr/bin/env bash
# autopilot-update.sh — Fetch repo changes from GitHub, pull if needed,
# conditionally rebuild frontend / reinstall deps, and restart the service.
#
# Designed to run every 5 minutes via cron. The fetch+compare phase exits in
# ~1 second when there are no remote changes, making frequent runs cheap.
#
# Usage:
#   autopilot-update.sh              # normal mode
#   autopilot-update.sh --dry-run    # report what would happen, skip restart

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
APP_DIR="/opt/automation-pilot"
BRANCH="main"
SERVICE_NAME="automation-pilot"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/update.log"
VENV="$APP_DIR/.venv"
TAG="autopilot-update"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
fi

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
mkdir -p "$LOG_DIR"

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo "$msg"
    logger -t "$TAG" "$*"
}

exec > >(tee -a "$LOG_FILE") 2>&1

# ---------------------------------------------------------------------------
# Phase 0: Safety checks
# ---------------------------------------------------------------------------
log "=== autopilot-update started ==="

if [[ "$(id -u)" -eq 0 ]]; then
    log "ERROR: must NOT run as root (service user is 'autopilot'). Exiting."
    exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
    log "ERROR: $APP_DIR is not a git repository. Exiting."
    exit 1
fi

cd "$APP_DIR"

# Detect ownership issues in .git/objects
BAD_OWNER_COUNT=$(find "$APP_DIR/.git/objects" -not -user "$(whoami)" 2>/dev/null | wc -l)
if [[ "$BAD_OWNER_COUNT" -gt 0 ]]; then
    log "WARNING: Found $BAD_OWNER_COUNT files in .git/objects not owned by $(whoami)."
    if sudo -n chown -R "$(whoami):$(id -gn)" "$APP_DIR/.git/objects/" 2>/dev/null; then
        log "FIXED: Corrected .git/objects ownership via sudo."
    else
        log "ERROR: Cannot fix .git/objects ownership. Run: sudo chown -R autopilot:autopilot $APP_DIR/.git/objects/"
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# Phase 1: Fetch and compare
# ---------------------------------------------------------------------------
LOCAL=$(git rev-parse HEAD)
git fetch origin --quiet
REMOTE=$(git rev-parse "origin/$BRANCH")

if [[ "$LOCAL" == "$REMOTE" ]]; then
    log "No remote changes. Exiting."
    exit 0
fi

log "Remote has new commits: ${LOCAL:0:8} -> ${REMOTE:0:8}"

# ---------------------------------------------------------------------------
# Phase 2: Pull (fast-forward only)
# ---------------------------------------------------------------------------
if ! git diff --quiet HEAD 2>/dev/null; then
    log "WARNING: Working tree has local modifications. Resetting to HEAD before pull."
    git checkout HEAD -- . 2>/dev/null || true
fi

BEFORE="$LOCAL"

if ! git merge --ff-only "origin/$BRANCH" 2>&1; then
    log "ERROR: git merge --ff-only origin/$BRANCH failed. Manual intervention required."
    exit 1
fi

AFTER=$(git rev-parse HEAD)
log "Pulled: ${BEFORE:0:8} -> ${AFTER:0:8}"

# ---------------------------------------------------------------------------
# Phase 3: Conditional rebuild
# ---------------------------------------------------------------------------
NEEDS_RESTART=true
FRONTEND_CHANGED=$(git diff --name-only "$BEFORE" "$AFTER" -- frontend/ | head -1)
DEPS_CHANGED=$(git diff --name-only "$BEFORE" "$AFTER" -- backend/requirements.txt | head -1)

if [[ -n "$FRONTEND_CHANGED" ]]; then
    log "Frontend changes detected. Rebuilding..."
    if $DRY_RUN; then
        log "[DRY RUN] Would run: cd frontend && npm run build"
    else
        (cd frontend && npm run build) 2>&1 | tail -5
        log "Frontend build complete."
    fi
fi

if [[ -n "$DEPS_CHANGED" ]]; then
    log "Python dependencies changed. Installing..."
    if $DRY_RUN; then
        log "[DRY RUN] Would run: $VENV/bin/pip install -r backend/requirements.txt"
    else
        "$VENV/bin/pip" install -r backend/requirements.txt --quiet 2>&1
        log "Pip install complete."
    fi
fi

# ---------------------------------------------------------------------------
# Phase 4: Restart service
# ---------------------------------------------------------------------------
if $DRY_RUN; then
    log "[DRY RUN] Would restart $SERVICE_NAME. Exiting."
    exit 0
fi

log "Restarting $SERVICE_NAME..."
sudo systemctl restart "$SERVICE_NAME"

# ---------------------------------------------------------------------------
# Phase 5: Verify
# ---------------------------------------------------------------------------
sleep 3

if systemctl is-active --quiet "$SERVICE_NAME"; then
    log "VERIFIED: $SERVICE_NAME is running."
else
    log "ERROR: $SERVICE_NAME failed to start after update!"
    log "Check: journalctl -u $SERVICE_NAME --since '1 min ago'"
    exit 1
fi

log "=== autopilot-update completed ==="

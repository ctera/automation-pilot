#!/bin/bash
# Syncs VmTools.jar from the network share to the local installation.
# Intended to run as a daily cron job. No service restart required —
# VmTools.jar is invoked as a fresh subprocess on every call.

set -euo pipefail

SMB_SHARE="//vgwversions-gen.ctera.local/versions"
REMOTE_PATH="Automation/dev/VmTools.jar"
LOCAL_PATH="/opt/automation-pilot/VmTools.jar"
TMP_PATH="/tmp/VmTools.jar.new"
ENV_FILE="/opt/automation-pilot/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    logger -t sync-vmtools "ERROR: $ENV_FILE not found"
    exit 1
fi

source "$ENV_FILE"

if [[ -z "${VMTOOLS_USER:-}" || -z "${VMTOOLS_PASSWORD:-}" ]]; then
    logger -t sync-vmtools "ERROR: VMTOOLS_USER or VMTOOLS_PASSWORD not set in $ENV_FILE"
    exit 1
fi

SMB_USER="CTERA\\${VMTOOLS_USER%%@*}"
SMB_PASS="$VMTOOLS_PASSWORD"

smbclient "$SMB_SHARE" -U "$SMB_USER%$SMB_PASS" -c "get $REMOTE_PATH $TMP_PATH" 2>/dev/null

if [[ ! -f "$TMP_PATH" ]]; then
    logger -t sync-vmtools "ERROR: download failed — $TMP_PATH not created"
    exit 1
fi

if ! cmp -s "$TMP_PATH" "$LOCAL_PATH"; then
    mv "$TMP_PATH" "$LOCAL_PATH"
    chown autopilot:autopilot "$LOCAL_PATH"
    chmod 644 "$LOCAL_PATH"
    logger -t sync-vmtools "VmTools.jar updated"
else
    rm -f "$TMP_PATH"
    logger -t sync-vmtools "VmTools.jar unchanged"
fi

# automation-pilot

Orchestrates automation executions on Jenkins. Evaluates infrastructure
readiness (ESXi host CPU, storage cluster capacity, running VMs) and
decides whether to trigger immediately, queue, or preempt lower-priority
work.

## Quick Start

```bash
make install          # Create venv, install Python & JS deps
make dev-backend      # Start backend (port 8080)
make dev-frontend     # Start frontend (port 3000, proxies to 8080)
```

## Stack

| Layer     | Technology                    |
|-----------|-------------------------------|
| Backend   | Python 3.12, FastAPI, SQLite  |
| Frontend  | React 19, Vite, MUI v7       |
| Infra     | VmTools.jar (vSphere)         |
| CI/CD     | Jenkins REST API              |

## Environment Variables

| Variable           | Description                          |
|--------------------|--------------------------------------|
| AUTOPILOT_CONFIG   | Path to config.yaml                  |
| AUTOPILOT_DB_PATH  | Path to SQLite database file         |
| JENKINS_USER       | Jenkins API username                 |
| JENKINS_TOKEN      | Jenkins API token                    |
| VMTOOLS_USER       | vSphere credentials (DOMAIN\\user)   |
| VMTOOLS_PASSWORD   | vSphere password                     |

## Production Deployment

| Item | Details |
|------|---------|
| URL | `http://192.168.93.13:8080` |
| Install path | `/opt/automation-pilot` |
| DB path | `/var/lib/automation-pilot/autopilot.db` |
| Service user | `autopilot` (non-login) |
| systemd unit | `automation-pilot.service` (enabled, auto-starts on boot) |
| Python | 3.9 via `/opt/automation-pilot/.venv/bin/python` |
| Port | 8080 |
| VmTools.jar | Auto-synced daily at 03:00 from network share |

### First Deploy

```bash
# 1. Copy project files
make build
scp -r backend frontend/build run.py Makefile automation-pilot.service scripts root@192.168.93.13:/opt/automation-pilot/

# 2. Create .env from template and fill in real credentials
scp .env.example root@192.168.93.13:/opt/automation-pilot/.env
ssh root@192.168.93.13 "vi /opt/automation-pilot/.env"   # fill in secrets

# 3. Fetch VmTools.jar for the first time
ssh root@192.168.93.13 "chmod +x /opt/automation-pilot/scripts/sync-vmtools.sh && /opt/automation-pilot/scripts/sync-vmtools.sh"

# 4. Install cron for daily sync (03:00)
ssh root@192.168.93.13 'echo "0 3 * * * /opt/automation-pilot/scripts/sync-vmtools.sh" | crontab -'

# 5. Start the service
ssh root@192.168.93.13 "cd /opt/automation-pilot && .venv/bin/pip install -r backend/requirements.txt && systemctl enable --now automation-pilot"
```

### Subsequent Deploys

```bash
make build
scp -r backend frontend/build run.py Makefile scripts root@192.168.93.13:/opt/automation-pilot/
ssh root@192.168.93.13 "cd /opt/automation-pilot && .venv/bin/pip install -r backend/requirements.txt && systemctl restart automation-pilot"
```

> **Note:** `.env` is never overwritten — it lives on the server only.
> `VmTools.jar` is kept current by the daily cron job.

### Auto-Update (Cron)

The server polls GitHub every 5 minutes and auto-deploys new commits from `main`.
The script at `scripts/autopilot-update.sh` handles everything:

1. `git fetch` + compare — exits immediately if nothing changed (~1s)
2. `git pull --ff-only` — fails loudly on conflicts (never auto-merges)
3. Conditional rebuild — only runs `npm run build` if `frontend/` changed, only runs `pip install` if `requirements.txt` changed
4. `systemctl restart automation-pilot`
5. Verify the service came back up

**Setup (run as the `autopilot` user on the server):**

```bash
# Ensure the script is executable
chmod +x /opt/automation-pilot/scripts/autopilot-update.sh

# Install the cron job
make setup-cron

# Or manually:
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/automation-pilot/scripts/autopilot-update.sh >> /opt/automation-pilot/logs/cron-update.log 2>&1") | crontab -
```

**Prerequisites:**

- `autopilot` user can `git pull` from GitHub (SSH key or stored HTTPS credential)
- Passwordless sudo for service restart: add to `/etc/sudoers.d/autopilot`:
  ```
  autopilot ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart automation-pilot, /usr/bin/systemctl stop automation-pilot, /usr/bin/systemctl start automation-pilot
  ```
- Node.js/npm in PATH for frontend builds

**Logs:**

- Update log: `/opt/automation-pilot/logs/update.log`
- Cron output: `/opt/automation-pilot/logs/cron-update.log`
- Syslog: `journalctl -t autopilot-update`

**Test if new changes are available without restarting:**

```bash
sudo -u autopilot -H bash -lc '/opt/automation-pilot/scripts/autopilot-update.sh --dry-run'
```

**Fetch latest changes as user autopilot:**

```bash
chmod +x /opt/automation-pilot/scripts/*.sh
sudo -u autopilot -H bash -lc '/opt/automation-pilot/scripts/autopilot-update.sh'
```

### Useful Commands

```bash
systemctl status automation-pilot    # check status
systemctl restart automation-pilot   # restart after redeploy
journalctl -u automation-pilot -f    # tail logs
/opt/automation-pilot/scripts/sync-vmtools.sh  # manually sync VmTools.jar
```

## Testing

```bash
make test             # Run all Python tests
```

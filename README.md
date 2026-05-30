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

### Deploy Steps

```bash
make build                          # Build frontend assets
scp -r backend data frontend/build run.py Makefile automation-pilot.service root@192.168.93.13:/opt/automation-pilot/
ssh root@192.168.93.13 "cd /opt/automation-pilot && .venv/bin/pip install -r backend/requirements.txt && systemctl restart automation-pilot"
```

### Useful Commands

```bash
systemctl status automation-pilot    # check status
systemctl restart automation-pilot   # restart after redeploy
journalctl -u automation-pilot -f    # tail logs
```

## Testing

```bash
make test             # Run all Python tests
```

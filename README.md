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

Target: 192.168.93.13

```bash
make build deploy
sudo cp automation-pilot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now automation-pilot
```

## Testing

```bash
make test             # Run all Python tests
```

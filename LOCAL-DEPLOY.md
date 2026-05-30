# Local Deployment

Deploy automation-pilot on a local Windows/Linux/Mac machine.

## Prerequisites

- Python 3.12+ (3.14 works — pydantic pin is `>=` to avoid wheel build issues)
- Node.js 18+ / npm
- Java 17+ (for VmTools.jar)
- Network access to `vc.ctera.local` (vSphere) and `jenkins.ctera.dev`

## Steps

```bash
# 1. Create venv and install backend deps
python -m venv .venv
.venv/Scripts/pip install -r backend/requirements.txt   # Windows
# .venv/bin/pip install -r backend/requirements.txt     # Linux/Mac

# 2. Install frontend deps and build
cd frontend && npm install && npm run build && cd ..

# 3. Create .env with your credentials
cp .env.example .env
# Edit .env — fill in VMTOOLS_USER, VMTOOLS_PASSWORD, JENKINS_USER, JENKINS_TOKEN

# 4. Kill any stale process on port 8080 (if redeploying)
# Windows: taskkill /F /PID <pid>
# Linux:   fuser -k 8080/tcp

# 5. Start the server
PYTHONPATH=. .venv/Scripts/python run.py   # Windows (Git Bash)
# PYTHONPATH=. .venv/bin/python run.py     # Linux/Mac

# 6. Verify
curl http://localhost:8080/api/settings    # Should return JSON config
```

Open `http://localhost:8080` in your browser.

## VmTools.jar

`VmTools.jar` is committed to the repo — fresh clones get it automatically.

To update it manually (rare):
- Copy from `C:\Automation\VmTools\target\VmTools.jar` (local build)
- Or from network share: `//vgwversions-gen.ctera.local/versions/Automation/dev/VmTools.jar`

## Known Gotchas

| Issue | Explanation |
|-------|-------------|
| `.env` not loaded | `run.py` calls `load_dotenv()` — no need to `source .env` manually |
| Config changes not taking effect | `vmtools` and `jenkins` config re-sync from `config.yaml` on every startup; other settings seed once into SQLite (`data/autopilot.db`) — delete the DB file for a full reset |
| VmTools.jar path | Config uses relative path `VmTools.jar` — works on any OS when started from project root |
| Special chars in `.env` passwords | `&`, `%`, `~`, etc. work fine with python-dotenv; do NOT wrap values in quotes |
| No separate frontend server needed | Backend serves `frontend/build/` as static files |
| First infra refresh is slow | ~60-90s (sequential VmTools calls to vSphere for datastores, hosts, VM folders) |
| Port 8080 already in use | A previous instance may still be running — kill it first |

## Verification Checklist

| Endpoint | Expected |
|----------|----------|
| `GET /api/settings` | JSON with hosts, datastores, vm_folders |
| `GET /api/decisions` | `[]` (empty array) |
| `GET /api/jenkins/job-statuses` | Job data with status/build_number (not 401 errors) |
| `POST /api/infrastructure/refresh` | Real CPU/storage percentages (not -1 values) |
| Browser `http://localhost:8080` | Dashboard with CPU gauges, storage bar, Jenkins jobs |

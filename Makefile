.PHONY: install dev build deploy test setup-cron

PYTHON := python3
VENV := .venv
PIP := $(VENV)/bin/pip
PYTEST := $(VENV)/bin/pytest

install:
	$(PYTHON) -m venv $(VENV)
	$(PIP) install -r backend/requirements.txt
	$(PIP) install pytest pytest-asyncio httpx
	cd frontend && npm install

dev-backend:
	PYTHONPATH=. $(VENV)/bin/python run.py

dev-frontend:
	cd frontend && npm start

dev:
	@echo "Run 'make dev-backend' and 'make dev-frontend' in separate terminals"

build:
	cd frontend && npm run build

test:
	PYTHONPATH=. $(PYTEST) tests/ -v

deploy: build
	@echo "Copy repo to /opt/automation-pilot on target server"
	@echo "Then: sudo systemctl enable automation-pilot && sudo systemctl start automation-pilot"

setup-cron:
	@echo "Installing auto-update cron (every 5 minutes) for user autopilot..."
	(crontab -l 2>/dev/null | grep -v 'autopilot-update.sh'; \
	 echo "*/5 * * * * /opt/automation-pilot/scripts/autopilot-update.sh >> /opt/automation-pilot/logs/cron-update.log 2>&1") | crontab -
	@echo "Done. Verify with: crontab -l"

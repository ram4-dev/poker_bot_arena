.PHONY: setup dev dev-backend dev-frontend prod-backend db-migrate db-upgrade db-reset test test-backend test-frontend lint format tick seed run-agents docker-build docker-run clean

VENV = backend/.venv
PYTHON = $(VENV)/bin/python
PIP = $(VENV)/bin/pip
UVICORN = $(VENV)/bin/uvicorn
ALEMBIC = $(VENV)/bin/alembic
PYTEST = $(VENV)/bin/pytest
RUFF = $(VENV)/bin/ruff

setup:
	python3 -m venv $(VENV)
	$(PIP) install -r backend/requirements.txt
	cd backend && PYTHONPATH=. $(CURDIR)/$(ALEMBIC) upgrade head
	@echo "✅ Backend ready"
	@if [ -d frontend ]; then cd frontend && npm install && echo "✅ Frontend ready"; fi

dev:
	@echo "Starting backend + frontend..."
	@trap 'kill 0' EXIT; \
	cd backend && PYTHONPATH=. $(CURDIR)/$(UVICORN) app.main:app --reload --port 8000 & \
	if [ -d frontend ]; then cd frontend && npm run dev; else wait; fi

dev-backend:
	cd backend && PYTHONPATH=. $(CURDIR)/$(UVICORN) app.main:app --reload --port 8000

prod-backend:
	cd backend && PYTHONPATH=. $(VENV)/bin/gunicorn app.main:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

dev-frontend:
	cd frontend && npm run dev

db-migrate:
	cd backend && PYTHONPATH=. $(CURDIR)/$(ALEMBIC) revision --autogenerate -m "$(m)"

db-upgrade:
	cd backend && PYTHONPATH=. $(CURDIR)/$(ALEMBIC) upgrade head

db-reset:
	rm -f backend/bot_arena.db
	cd backend && PYTHONPATH=. $(CURDIR)/$(PYTHON) -m app.seed
	@echo "✅ Database reset and seeded"

test: test-backend test-frontend

test-backend:
	cd backend && PYTHONPATH=. $(CURDIR)/$(PYTEST) tests/ -v

test-frontend:
	@if [ -d frontend ]; then cd frontend && npm test; else echo "No frontend yet"; fi

lint:
	cd backend && $(CURDIR)/$(RUFF) check . && $(CURDIR)/$(RUFF) format --check .

format:
	cd backend && $(CURDIR)/$(RUFF) format .

tick:
	curl -s -X POST http://localhost:8000/api/admin/tick | python3 -m json.tool

seed:
	cd backend && PYTHONPATH=. $(CURDIR)/$(PYTHON) -m app.seed

run-agents:
	@echo "Starting AlphaBot + BetaBot against Bronze arena..."
	cd backend && PYTHONPATH=. $(CURDIR)/$(PYTHON) scripts/run_agents.py

docker-build:
	docker build -t bot-arena-api ./backend

docker-run:
	docker run --env-file backend/.env -p 8000:8000 bot-arena-api

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	rm -f backend/bot_arena.db
	rm -rf frontend/node_modules
	@echo "✅ Cleaned"

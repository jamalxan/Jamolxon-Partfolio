.PHONY: dev up down test lint migrate seed build owner

COMPOSE_DEV = docker compose -f infra/docker-compose.dev.yml

up:
	$(COMPOSE_DEV) up -d postgres redis

down:
	$(COMPOSE_DEV) down

dev: up migrate
	cd backend && uv run uvicorn app.main:app --reload --port 8000 & \
	cd backend && uv run arq app.workers.main.WorkerSettings & \
	cd frontend && npm run dev & \
	cd admin && npm run dev

test:
	cd backend && uv run pytest -q --cov
	cd frontend && npm run build && npm run render:dist && node tests/budget.mjs dist && node tests/visual/smoke.mjs .site
	cd admin && npm test -- --run

lint:
	cd backend && uv run ruff check app scripts tests && uv run mypy app
	cd admin && npm run lint && npm run typecheck

migrate:
	cd backend && uv run alembic upgrade head

seed:
	cd backend && uv run python -m scripts.seed_from_datajs

owner:
	cd backend && uv run python -m scripts.create_owner --email $(EMAIL)

build:
	docker build -f infra/Dockerfile --target app -t jamolxon-app:dev .
	docker build -f infra/Dockerfile --target web -t jamolxon-web:dev .

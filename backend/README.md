# DentalERP Python backend

This is the PostgreSQL/FastAPI replacement for the legacy Next.js route modules.
Migration is vertical: a workflow moves here with its authorization and tests, then
the matching TypeScript routes are deleted after frontend cutover.

## Run locally

```bash
docker compose -f docker-compose.dev.yml up -d postgres
cd backend
uv sync
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload --port 8000
```

OpenAPI is available at `http://localhost:8000/docs`.

When the development backend is running through Compose, seed it from the
repository root with either command:

```bash
docker compose -f docker-compose.dev.yml exec backend uv run python -m app.seed
# Equivalent direct command:
docker compose -f docker-compose.dev.yml exec backend /app/.venv/bin/python -m app.seed
```

The demo seed creates `admin@demo-dental.com` with password `Admin@123`. Change it
outside local development.

## Dependency direction

`HTTP router → workflow → SQLAlchemy session → PostgreSQL`

Authentication derives the clinic identifier from the signed token. Workflow code
never accepts a clinic identifier from request data. Authorization uses permission
keys (`patients.read`, `patients.create`, and so on), not route-local role checks.

## Commands

```bash
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run alembic check
```

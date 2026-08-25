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

## Offline license decision

The backend contains the server-side adapter for the shared signed offline license
format documented in `../docs/licensing/license-v1.md`. Existing deployments remain
unchanged because `BACKEND_LICENSE_ENFORCEMENT` defaults to `disabled`.

The supported rollout is:

1. `disabled` — no license reads and no enforcement.
2. `audit` — evaluate the installed license and expose status without blocking writes.
3. `required` — deny mutation requests after invalidity or the five-day grace period.

The installation state directory contains `installation.json`, `current.lic`, and the
runtime-managed `evidence.json`. The offline Windows installer owns creation and
machine-scoped protection of that directory. Issuer public keys are trust anchors
shipped read-only with the application so clinic-writable state cannot replace them;
issuer private keys never belong on clinic computers.

Authenticated users can read `/api/license/status`. Staff with `license.manage` can
import a replacement through `/api/license/import`, including while ordinary writes
are restricted. Missing or damaged license state fails closed for writes while
patient viewing, backup/export, audit, and license administration remain available.

The legacy Next.js API uses the same policy and state directory through
`LICENSE_ENFORCEMENT`, `LICENSE_PRODUCT_ID`, and `LICENSE_STATE_DIR`. Its shared
authorization helper blocks unsafe HTTP methods with status 423. The production
Compose stack bind-mounts `LICENSE_STATE_HOST_DIR` so the Windows host agent and
the application containers see the same installation identity, license, and time
evidence. The backup and license-recovery routes explicitly remain available.

## Commands

```bash
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run alembic check
```

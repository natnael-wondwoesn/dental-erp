# ADR 0001: FastAPI/PostgreSQL domain Modules

- Status: Accepted
- Date: 2026-08-14

## Decision

The production backend is Python FastAPI only, backed by PostgreSQL through SQLAlchemy 2 and Alembic. Prisma, MySQL, Next.js route handlers, NextAuth server code, and other JavaScript/TypeScript backend Implementations are migration-only and must be removed.

The backend is split into deep business Modules: identity/RBAC, patient records, scheduling, clinical care, revenue cycle, laboratory, finance, and reporting. FastAPI routers are thin Interfaces; workflows own validation and orchestration; repositories/SQLAlchemy are persistence Adapters. Every workflow requires tenant context.

## Consequences

- Frontend TypeScript calls stable `/api/*` HTTP contracts through Next rewrites.
- PostgreSQL is the only production database and Alembic is the only schema history.
- Permission dependencies at the HTTP seam provide a single authorization policy.
- Audit and atomic clinic-scoped sequences are shared infrastructure with high Leverage.
- Legacy route-by-route Prisma logic is not translated mechanically; business behavior moves into the owning Module and is verified with black-box and PostgreSQL integration tests.

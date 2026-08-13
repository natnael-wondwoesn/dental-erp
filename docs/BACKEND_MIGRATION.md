# FastAPI/PostgreSQL backend migration

The target backend is Python-only: FastAPI, SQLAlchemy 2, Alembic, and PostgreSQL.
The Next.js application remains the frontend. Prisma and the TypeScript route modules
are temporary compatibility code and will be removed as each workflow moves.

## Business dependency order

1. Tenant identity and clinic isolation
2. Staff authentication and database-backed RBAC
3. Transactional audit trail
4. Patient care and documents
5. Scheduling and treatment delivery
6. Billing, payments, and insurance
7. Inventory and laboratory operations
8. Communications and CRM
9. Reports, AI workflows, and scheduled jobs

This ordering migrates the invariants used by every later workflow before the
workflow itself. It also produces useful vertical releases rather than maintaining
two complete backends until a final big-bang switch.

## Current slice

The first slice lives in `backend/` and includes:

- PostgreSQL schema ownership through Alembic
- Signed staff access tokens
- Database-backed roles and permission grants
- Clinic context derived exclusively from the verified token
- Patient list, search, create, read, update, and archive
- Audit records committed with patient mutations
- HTTP tests for permission denial and cross-clinic isolation

The legacy Patient route modules have not been deleted yet because the current UI
still authenticates through NextAuth and calls those paths. Cutover requires changing
the frontend transport and session flow first; deleting them earlier would break the
working application.

## Cutover rule

A TypeScript route module and its Prisma usage can be deleted only after:

1. The FastAPI path has matching response/status contracts.
2. RBAC and tenant isolation tests pass.
3. The frontend caller uses the FastAPI authentication/transport module.
4. PostgreSQL data migration is verified for that workflow.
5. End-to-end tests pass without the legacy route.

Prisma is removed from dependencies after the final workflow satisfies this rule.

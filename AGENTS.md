<claude-mem-context>
# Memory Context

# [dental-erp] recent context, 2026-08-14 3:55pm GMT+3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (19,886t read) | 810,644t work | 98% savings

### Aug 13, 2026

4918 1:24p 🔵 Dental ERP codebase architecture mapped for migration planning
4928 1:39p 🔵 dental-erp Backend Scale Assessment for FastAPI Migration
4929 " ⚖️ Architecture Migration Strategy: Domain Modules + Ports-and-Adapters Pattern
4936 2:29p 🔵 Test Failure Root Cause Hypotheses After Migration Commits
4937 " 🔵 Migration Commit Anatomy: middleware.ts Deleted, i18n System Added
4938 " 🔵 dental-erp Working Tree Has Unstaged Changes Atop Migration Commits
4939 2:30p 🟣 DashboardShell Re-integrates AI Widgets After Backend Decoupling
4940 " ✅ FastAPI Proxy Rewrites Narrowed From Catch-All to Specific Routes
4941 " 🔴 Sidebar Test Fixed: useLanguage Mock Added, Rebranded Assertions Updated
4942 " 🟣 FastAPI Auth Client lib/api-client.ts With localStorage JWT Management
4943 2:31p 🔵 Two Remaining Test Failures: Missing Lucide Mock and localStorage Undefined
4944 " 🔵 Lucide-React Mock Pattern Is a Project-Wide Convention
4945 2:32p 🔵 layout-components.test.tsx Already Has Lucide Mock — Stethoscope Failure Is a Different Bug
4946 " 🔵 jsdom localStorage Returns undefined Due to Missing Accessor in Property Descriptor
4947 " ⚖️ Auth Guard Migrated From Edge Middleware to Client-Side React Effect
4948 2:33p 🔵 Vitest's jsdom Adapter Overwrites localStorage Descriptor, Bare jsdom Has It Correctly
4949 " 🔵 No Role-Based Route Guards Remain After Middleware Deletion
4950 " 🔵 RBAC Enforcement Moved to FastAPI Backend, Not Eliminated
4951 " 🔵 tests/setup.ts Globally Mocks fetch But Has No localStorage Polyfill
4952 " 🔵 Lucide Proxy Mock Returns Real Components for Existing Icons — data-testid Never Set
4954 2:34p 🔴 Full Test Suite Passes: 186 Files, 4327 Tests, Zero Failures
4955 " 🔵 FastAPI RBAC Uses Principal Dataclass With Typed Permission Annotations per Route
4953 2:36p 🔴 All 65 Tests Pass: localStorage Polyfill and Stethoscope Selector Fix Applied
S1456 FastAPI backend integration with Next.js frontend and containerization of the FastAPI service in Docker Compose (Aug 13 at 2:39 PM)
S1455 Fix test failures from two migration commits in dental-erp: FastAPI auth migration (d9e9990) and i18n/refactor commit (41f44c6) (Aug 13 at 2:39 PM)
4956 2:39p 🔵 FastAPI Backend Has Only Two Routers: auth and patients
4957 2:40p 🔵 Dual-Database Migration Strategy: PostgreSQL for FastAPI, MySQL Temporary for Prisma
4958 " 🔵 FastAPI Migration Coverage: 7 Endpoints Ported Out of 195 Next.js API Routes
4959 " 🔵 FastAPI Proxy for /api/patients/:path* Shadows 8 Next.js Sub-Routes Not Implemented in FastAPI
4960 " 🔵 FastAPI Backend Config Uses BACKEND_ Env Prefix, 8-Hour JWT, PostgreSQL via asyncpg
4961 " 🔵 Login Flow: Fetch to /api/auth/login, Store JWT in localStorage, Monkey-Patch window.fetch
4962 " 🔵 FastAPI Backend Stack: Argon2 Passwords, PyJWT, SQLAlchemy Async, aiosqlite for Tests
4963 2:42p 🔵 CI Release Workflow Publishes Only Next.js Image — FastAPI Backend Has No CD Pipeline
4964 " 🔵 JWT Secret Mismatch: FastAPI and Legacy Next.js Routes Use Different Signing Keys
4965 2:44p 🔵 User ID Type Incompatibility: Prisma/MySQL Uses CUID Strings, FastAPI/PostgreSQL Uses UUIDs
4966 2:46p ⚖️ New Task: Complete FastAPI-Frontend Integration and Add Backend to Docker Compose
4967 2:47p 🔵 dental-erp Has 195 Next.js API Routes Across 46 Domains and 81 Prisma Models
S1457 FastAPI/PostgreSQL backend integration, containerization, and full Ethiopian Dental ERP migration roadmap (Aug 13 at 2:52 PM)
4973 2:52p ⚖️ Full production-ready Ethiopian Dental ERP scope confirmed
4974 " ✅ Git history detached from upstream fork via orphan commit
4975 4:09p ✅ Git history fully detached — repository now has single root commit on main
4976 " 🟣 FastAPI backend and migration services added to docker-compose.dev.yml
4977 " ✅ .env.example updated with FASTAPI_URL and DENTAL_ERP_DEV_BACKEND_PORT
4978 4:10p 🔵 docker-compose.dev.yml validates cleanly with Docker daemon running
4988 4:21p 🔵 UV Cache Permission Denied in Docker Backend Container

### Aug 14, 2026

4980 10:52a 🔵 DentalERP Full-Stack Launch Procedure
4993 11:19a 🔵 Login Returns 500 with No Backend Request Visible in Logs
5003 " ⚖️ UI Overhaul Requested with Ethiopian Market Context and Full ERP Module Expansion
4989 11:20a 🔵 Docker Backend Container UV Cache Root Cause: uid=10001 with HOME=/
4990 " 🔴 Fixed UV Permission Denied in Backend Docker Image via ENV + pre-created cache dir
4994 11:26a 🔵 Login 500 Root Cause: next.config.js Wrong Default FastAPI Port
4995 " 🔴 Fixed Login 500: Corrected FASTAPI_URL Default Port and Added Missing .env Vars
4996 " 🔵 FastAPI Auth Response Uses camelCase via Pydantic alias_generator

Access 811k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>

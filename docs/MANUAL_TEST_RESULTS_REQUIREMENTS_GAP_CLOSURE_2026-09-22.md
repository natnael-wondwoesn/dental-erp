# Manual Acceptance Results — Requirements Gap Closure

Date: 2026-09-22
Branch: `codex/client-requirements-audit`
Environment: local Next.js development server with Docker MySQL
Tester: Codex browser-assisted acceptance run

## Result

**PASS WITH EXTERNAL-ENVIRONMENT FOLLOW-UP**

The migrated local application passed the queue, recall, payment-attribution,
survey-authorization, and responsive smoke paths exercised below. Live SMS
delivery and production scheduler execution require the configured deployment
environment and were not simulated as successful provider deliveries.

## Final pre-deployment re-validation

Build under test: `c4a00bb` plus Playwright base-URL configurability recorded in
the deployment commit. Base URL: `http://localhost:3001`. Browser: Chromium and
Codex in-app browser. Database: local Docker MySQL with all 14 migrations applied.

| Area              | Check                                                                                              | Result  | Evidence                                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full regression   | Entire Vitest suite                                                                                | PASS    | 212 files; 4,575 tests passed.                                                                                                                                                     |
| Browser workflows | Queue, payment plans, payment list, invoice payment dialog                                         | PASS    | 29/29 Chromium tests passed serially against full ERP mode. Parallel run passed 25/29; four failures were login timeouts only and all passed in serial rerun.                      |
| Localization      | Dashboard, queue, invoice, payment plans, billing settings, communication settings, patient recall | PASS    | Live pages used Sunny Smile/Addis Ababa identity, ETB, Ethiopian VAT, `+251`, Africa/Addis_Ababa, English/Amharic; no Hindi, Tamil, rupee symbol, or Indian SMS guidance appeared. |
| Payment dialog    | Methods and currency                                                                               | PASS    | ETB amount; Cash, Card, Mobile Money (legacy), Telebirr, Bank Transfer, Cheque, Other Provider.                                                                                    |
| Amharic           | Queue and recall workflow                                                                          | PASS    | Queue overview and six-month recall labels switched to Amharic; state/data unchanged; UI restored to English afterward.                                                            |
| Migration         | Production migration readiness                                                                     | PASS    | `prisma migrate status`: 14 migrations found; schema up to date. Production build generated all 242 static pages.                                                                  |
| Live SMS          | Real Ethiopian provider delivery                                                                   | BLOCKED | No production-capable provider credential/safe recipient available locally. Failure, retry, claim, and authorization paths passed automated coverage.                              |
| Second tenant     | Live cross-clinic browser exercise                                                                 | BLOCKED | No second configured local tenant. API tenant-isolation tests passed.                                                                                                              |

Release recommendation: **CONDITIONAL GO**. Deploy application and migrations;
then execute readiness checks plus live SMS/second-tenant follow-up below.

## Executed checks

| Area       | Check                                      | Result | Evidence                                                                                                                                                              |
| ---------- | ------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration  | Apply all pending migrations               | PASS   | Queue assignment, payment attribution/provider, and patient recall migrations applied successfully; Prisma reported no migration failure.                             |
| Recall     | Reject patient without completed treatment | PASS   | Patient detail displayed `A completed treatment is required before scheduling a recall`.                                                                              |
| Recall     | Schedule from completed treatment          | PASS   | Synthetic treatment completed 2026-09-22 produced follow-up 2027-03-22 and reminder 2027-03-15. UI displayed `SCHEDULED` and SMS `pending`.                           |
| Recall     | Reject duplicate                           | PASS   | Second schedule attempt displayed `A recall is already scheduled for this follow-up date`.                                                                            |
| Recall     | Mark patient returned                      | PASS   | UI displayed `Patient return recorded.` and state changed to `RETURNED`; action disappeared.                                                                          |
| Queue      | Administrator cannot claim                 | PASS   | Waiting card displayed no `Take Patient` action in the administrator session.                                                                                         |
| Queue      | Doctor can claim                           | PASS   | Doctor session displayed `Take Patient`; claim moved the patient from Waiting to In Progress.                                                                         |
| Queue      | Duplicate claim protection                 | PASS   | Second claim returned HTTP `409` with `This patient has already been taken by another doctor`.                                                                        |
| Payment    | Telebirr/provider UI                       | PASS   | Payment method list included Telebirr and selecting it displayed the required provider field.                                                                         |
| Payment    | Attribution and balance                    | PASS   | Synthetic ETB 10 Telebirr payment reduced balance from ETB 1,180 to ETB 1,170 and displayed provider `Telebirr QA`, recorder `Admin User`, and transaction reference. |
| Survey     | Results authorization                      | PASS   | Administrator received HTTP `200`; doctor received HTTP `403` and `{ "error": "Forbidden" }` for the same synthetic survey.                                           |
| Responsive | Invoice at 390×844                         | PASS   | Content remained available and document/body scroll widths equaled 390px.                                                                                             |
| Responsive | Queue at 390×844                           | PASS   | Queue content remained available and document/body scroll widths equaled 390px.                                                                                       |
| Responsive | Queue at 768×1024                          | PASS   | Queue loaded and document/body scroll widths equaled 768px.                                                                                                           |
| Build      | Optimized production build                 | PASS   | Next.js compiled, type-checked, generated all 242 static pages, and completed route tracing.                                                                          |

## Synthetic records created

- Treatment `cmucbpdr20001lq6m4ivr31zd`, labeled `QA recall acceptance test`.
- Appointment `cmucbrt4a0005lq6mh7v04fcz`, labeled `QA atomic queue claim`.
- Payment `PAY-202609-0001`, reference `QA-20260922`, amount ETB 10.
- Survey titled `QA-20260922 Survey Isolation`.
- One recall associated with the synthetic completed treatment; final state `RETURNED`.

These records are in the local development database only.

## Follow-up checks after deployment

- Confirm the production migration job applies all three new migrations.
- Verify both public readiness endpoints after container replacement.
- Configure an Ethiopian-capable SMS provider and invoke the protected recall
  cron during the clinic's allowed window.
- Confirm one real test SMS is logged and delivered, then verify retry behavior
  using the provider's documented sandbox/failure mechanism.
- Repeat cross-clinic survey and recall isolation with a second production QA
  tenant if one is available.

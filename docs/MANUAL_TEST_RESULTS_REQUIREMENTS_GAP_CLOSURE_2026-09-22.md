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

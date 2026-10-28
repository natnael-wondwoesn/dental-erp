# Berhanu CMS client audit — 2026-10-22

**Target:** `https://berhanu.dental-clinic-cms.duckdns.org/login`  
**Perspective:** existing clinic ADMIN, browser UI only  
**Scope:** entitled modules: core, patients, appointments, clinical, billing,
insurance, lab, finance, inventory, staff, reports, CRM, communications,
forms, portal, video, AI, sterilization, devices, and data import.

## Method and limits

I signed in using the supplied temporary administrator account and inspected
the rendered UI, navigation, controls, empty states, safe searches, and a
blank required-field submission. Evidence came from the live browser rather
than API calls or source inspection.

The workspace contains no patient, appointment, invoice, payment, inventory,
lab, device, or sterilization records. No synthetic records were created: that
kept the audit free of clinical and financial side effects. No real messages,
AI prompts, video invites, payments, exports containing clinic data, imports,
subscription changes, integrations, security changes, or deletions were run.
Those workflows are marked blocked/not tested, rather than passed.

Screenshots were captured in the live CUA audit session for E1–E3. They show
only empty aggregate data and clinic branding; no PHI or credential is shown.

## UI inventory

The desktop navigation exposes Dashboard, AI Chat, Patients, Appointments,
Video Consults, Assessment & Treatment, Prescriptions, Forms, Drug Catalog,
Billing, Accounting & Finance, CRM, Inventory, Sterilization, Devices, Dental
Laboratory, Communications, Staff, Reports, and Settings. Settings exposes
setup guide, clinic, appointments, billing, communications, procedures,
system, security, integrations, data import, profile, and subscription.
Billing exposes invoices, payments, receipts, payment plans, insurance claims,
providers, pre-authorizations, and financial reports.

## Results matrix

| Module         | Client flows exercised                                                                                          | Result                   | Evidence / limits                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Core           | login; dashboard cards; sidebar; global search with `QA-CODEX-20261022`; language toggle; mobile 375×812 drawer | **FAIL / PASS**          | Login, nav, empty global search, mobile layout/drawer passed. Partial Amharic localization failed (E3).            |
| Patients       | list, filters, empty state, register page, blank required-field submit                                          | **PASS**                 | Browser retained focus on required First Name; no record created.                                                  |
| Appointments   | list, date/search controls, status/type controls, calendar control, new-booking entrypoint                      | **PASS (entry UI)**      | Booking submit and lifecycle blocked: no patient fixture.                                                          |
| Clinical       | treatments, treatment plans entrypoint, prescriptions, drug catalog                                             | **PASS (list/entry UI)** | Empty lists and filters render. Clinical record creation/print blocked: no patient and no clinical side effects.   |
| Billing        | dashboard, invoices, payments, receipts, payment plans, financial reports                                       | **PASS (read-only UI)**  | Empty-state totals and filters render. Invoice/payment/refund/receipt actions not run.                             |
| Insurance      | claims, providers, pre-authorization                                                                            | **PASS (read-only UI)**  | Claims/provider/pre-auth pages and empty states render. Creation/submission blocked: no patient/financial fixture. |
| Lab            | orders dashboard, vendor/order controls, filters                                                                | **PASS (read-only UI)**  | Empty state renders. No lab order created.                                                                         |
| Finance        | finance landing and billing/commission/report workspaces                                                        | **PASS (read-only UI)**  | Landing cards render. No accounting data changed.                                                                  |
| Inventory      | item list, category/type/status/low-stock controls, suppliers/transactions/reports entrypoints                  | **PASS (read-only UI)**  | List and filter UI render. No item or transaction created.                                                         |
| Staff          | list, role/status filters, attendance/leaves entrypoints                                                        | **PASS (read-only UI)**  | UI renders; no staff account or attendance change made.                                                            |
| Reports        | dashboard, period/export controls, analytics tabs, natural-language report controls                             | **FAIL**                 | Zero-data patient KPIs display `NaN%` (E2). AI generation not run to avoid provider use/charges.                   |
| CRM            | dashboard, membership, loyalty, referral entrypoints                                                            | **PASS (read-only UI)**  | Metrics and entrypoints render as zero-state. No membership/loyalty/referral created.                              |
| Communications | SMS/email/templates/surveys tabs and SMS validation UI                                                          | **PASS (read-only UI)**  | UI renders. No SMS/email/test message was sent.                                                                    |
| Forms          | medical-certificate and prescription-paper entrypoints                                                          | **PASS (entry UI)**      | Patient-linked document, A4 preview/print, and email delivery blocked: no patient and no external send.            |
| Portal         | public `/portal` route                                                                                          | **FAIL**                 | Browser displays “This page couldn’t load” after 3.5 seconds (E1).                                                 |
| Video          | consult status tabs/table                                                                                       | **PASS (read-only UI)**  | Zero-state table renders. No invite, camera/mic permission, or consult started.                                    |
| AI             | assistant shell, quick prompts, hands-free/voice controls                                                       | **NOT TESTED**           | UI renders. Prompts/voice not invoked to avoid provider charges and unintended actions.                            |
| Sterilization  | center counters and instruments/logs/compliance entrypoints                                                     | **PASS (read-only UI)**  | All zero-state counters and links render. No cycle/instrument update made.                                         |
| Devices        | device list/status filters/register control/API instructions                                                    | **PASS (read-only UI)**  | Zero-state UI renders. No device registered or data pushed.                                                        |
| Data import    | type selection and upload/column-map/preview/validate/confirm wizard                                            | **PASS (entry UI)**      | Wizard renders. File upload/validation/import not run to avoid data mutation.                                      |

## Verified findings

### P1 — Patient portal route is unusable

**Reproduction**

1. Sign in to the clinic administrator workspace.
2. Navigate to `https://berhanu.dental-clinic-cms.duckdns.org/portal`.
3. Wait at least 3.5 seconds.

**Expected:** Patient portal should render its public sign-in/booking UI, as
described by the Clinic Information setting (“Allow patients to log in, view
records, book appointments, and pay bills online”).

**Observed:** Browser remains on a generic black failure screen: “This page
couldn’t load / Reload to try again, or go back.”

**Evidence:** E1, live browser screenshot captured 2026-10-22. No PHI.

### P2 — Reports show invalid percentages in an empty clinic

**Reproduction**

1. Sign in as clinic ADMIN.
2. Open Reports.
3. Keep the default “This Month” period with zero patients.

**Expected:** New Patients and Returning Patients should show a defined
zero-data value such as `0%`, `—`, or an explanatory empty state.

**Observed:** Both cards show `NaN% of total` below a displayed count of `0`.

**Evidence:** E2, live browser screenshot captured 2026-10-22. No PHI.

### P2 — Amharic mode is incomplete on the dashboard

**Reproduction**

1. Sign in as clinic ADMIN and open Dashboard.
2. Click “Switch to Amharic.”

**Expected:** A user-facing Amharic mode should translate dashboard cards and
navigation consistently, or clearly identify unavailable translations.

**Observed:** Much of the sidebar translates, but “Forms,” “Notifications,”
the trial status, clinic workspace copy, and all dashboard module cards remain
English. The UI presents this as a completed language switch without a
translation-availability indication.

**Evidence:** E3, live browser screenshot captured 2026-10-22. No PHI. English
was restored after the test.

### P3 — Ethiopia-targeted setup content retains India-specific onboarding

**Reproduction**

1. Open Settings → Setup Guide, Clinic Information, or Billing Settings.

**Expected:** Guidance for this Addis Ababa/ETB clinic should use relevant
payment and tax terminology.

**Observed:** Setup guide requests “Bank & UPI Details”; billing settings
promote Razorpay, PhonePe, Paytm, and GST; clinic placeholders include an
Indian address pattern, IFSC and PAN. This conflicts with the otherwise
Ethiopian VAT, ETB, Addis Ababa, and Telebirr-oriented interface.

**Evidence:** Live rendered setup and settings UI; no values saved or changed.

## Pass details

- Login completed and reached `/dashboard`; role-visible navigation exposed all
  expected administrative areas.
- Global search accepted the clearly synthetic search string and returned “No
  results found,” without creating data.
- Mobile dashboard at 375×812 had no horizontal overflow; cards became a
  single-column layout and the hamburger opened the full module drawer.
- Required patient fields blocked a blank create attempt at browser level.
- Slow-loading configuration pages (communications, security, integrations,
  profile, system statistics) resolved within 3.5 seconds; they were not
  failures.
- Subscription view confirms all 20 requested modules are included and access
  is active.

## Data fixtures and safety record

No records were created. The reserved `QA-CODEX-20261022` prefix was used only
as a global search query. No real patient, staff, clinical, financial, or
communication data was read beyond aggregate zero-state counts.

## Follow-up test requirements

After P1/P2/P3 fixes, create a dedicated synthetic patient and explicitly
authorized disposable fixtures to cover end-to-end booking, treatment,
invoice/payment, insurance claim, lab order, CRM, printing/receipt preview,
patient portal, video, data import preview, and non-sending communication
validation. Keep all external sends, charges, invites, integrations, and
destructive cleanup out of the test unless separately approved.

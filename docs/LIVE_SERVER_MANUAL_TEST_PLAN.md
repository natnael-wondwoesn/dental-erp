# Dental Clinic ERP — Live Server Manual Test Plan

**Target:** <https://dental-clinic-cms.duckdns.org>  
**Scope:** Major clinical, operational, billing, laboratory, reporting, and finance workflows  
**Tester:** ____________________  
**Test date:** ____________________  
**Build/commit:** ____________________  
**Browser/device:** ____________________

## 1. How to use this checklist

Use the demo credentials shown on the login page. Run the tests in the order
listed because later modules reuse the patient, appointment, treatment, invoice,
payment, and lab order created earlier.

For each test, record one result:

- **PASS** — the expected result occurred with no material UI or data issue.
- **FAIL** — the workflow could not be completed or produced incorrect data.
- **BLOCKED** — a prerequisite, permission, or earlier defect prevented testing.
- **N/A** — intentionally excluded from this deployment.

Do not enter real patient or payment information. Prefix all test records with
`QA-` and include the test date so they can be found and removed later.

## 2. Test data

Create and reuse the following records:

| Record         | Suggested test value                                              |
| -------------- | ----------------------------------------------------------------- |
| Patient        | `QA Patient <date>`                                               |
| Phone          | A valid Ethiopian-format test number, for example `+251911000000` |
| Appointment    | Tomorrow at an available time                                     |
| Dentist        | Any active dentist                                                |
| Diagnosis      | `QA reversible pulpitis`                                          |
| Procedure      | Any configured examination or restoration procedure               |
| Treatment plan | `QA Treatment Plan <date>`                                        |
| Lab vendor     | An existing active vendor, or `QA Lab Vendor <date>`              |
| Lab order      | Crown or bridge for the QA patient                                |
| Invoice        | One treatment line with a known ETB amount                        |
| Payment        | Partial cash payment, followed by final payment if supported      |

## 3. Environment and smoke checks

| ID     | Test                | Steps                                                      | Expected result                                                                                       | Result/notes |
| ------ | ------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------ |
| ENV-01 | Public availability | Open the target URL in a private/incognito window.         | The login page loads over HTTPS without a certificate warning.                                        |              |
| ENV-02 | Authentication      | Sign in with the demo credentials shown on the login page. | Login succeeds and the dashboard opens. No blank screen or server error appears.                      |              |
| ENV-03 | Readiness           | Open `/api/ready` in a separate tab.                       | HTTP 200 response with database status `ok`.                                                          |              |
| ENV-04 | Navigation          | Open each primary sidebar module once.                     | Every module opens without a 404/500 response or broken loading state.                                |              |
| ENV-05 | Desktop layout      | Test at approximately 1440×900.                            | Navigation, headings, buttons, tables, and dialogs are visible and do not overlap.                    |              |
| ENV-06 | Mobile layout       | Test at approximately 390×844.                             | No page-level horizontal overflow; primary task content appears promptly; controls remain usable.     |              |
| ENV-07 | Theme consistency   | Inspect dashboard, patient history, billing, and forms.    | Surfaces use one consistent light theme; no navy cards mixed with white-on-white text.                |              |
| ENV-08 | Language switch     | Change English to Amharic and return to English.           | The selected language persists during navigation; content remains readable and layout does not break. |              |

## 4. Patient Management

### 4.1 Patient registration

| ID     | Test                      | Steps                                                                                                      | Expected result                                                                                                                           | Result/notes |
| ------ | ------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| PAT-01 | Required-field validation | Open **Patients → Register patient** and submit an empty form.                                             | Required fields are identified next to the relevant inputs; no patient is created.                                                        |              |
| PAT-02 | Register patient          | Enter the QA patient’s name, Ethiopian phone number, sex, birth date, address, and optional details; save. | A success message appears and one patient record is created with a unique patient ID.                                                     |              |
| PAT-03 | Duplicate protection      | Attempt to register the same phone or other unique identity data again.                                    | The application warns about the duplicate or handles it according to the configured policy without silently creating conflicting records. |              |
| PAT-04 | Search                    | Search by QA patient name, patient ID, and phone number.                                                   | The same patient is returned for each supported search field. Clearing search restores the list.                                          |              |

### 4.2 Profile and records

| ID     | Test                | Steps                                                                                                                     | Expected result                                                                                                               | Result/notes |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------ |
| PAT-05 | Patient profile     | Open the QA patient from the list.                                                                                        | Identity, contact details, age/date of birth, balances, appointments, and clinical navigation belong to the selected patient. |              |
| PAT-06 | Edit profile        | Change one non-key detail, save, refresh, and reopen the profile.                                                         | The updated value persists and no unrelated field changes.                                                                    |              |
| PAT-07 | Medical history     | Open **Medical & dental history**; record an allergy, medical condition, medication, and clinical note; save and refresh. | All values persist and remain attached to the QA patient. Important allergy/condition flags are prominent.                    |              |
| PAT-08 | Previous treatments | Add or complete a treatment for the patient, then return to the patient history.                                          | Previous treatment shows the correct procedure, tooth/area, dentist, date, status, notes, and ETB amount where applicable.    |              |
| PAT-09 | Patient timeline    | Review the patient timeline/record.                                                                                       | Relevant registration, appointment, treatment, document, invoice, and payment events appear once and in chronological order.  |              |
| PAT-10 | Upload record       | Upload a small non-sensitive PDF or image as a patient document, then open/download it.                                   | Upload succeeds, metadata is correct, and only the selected patient’s document is shown.                                      |              |
| PAT-11 | Record isolation    | Open a different patient in another tab and compare URLs/data.                                                            | No QA patient history, document, treatment, invoice, or balance leaks into the other patient.                                 |              |

## 5. Appointment Management

| ID     | Test                   | Steps                                                                                                                            | Expected result                                                                                                          | Result/notes |
| ------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------ |
| APT-01 | Book appointment       | Open **Appointments → New appointment**; select the QA patient, dentist, date, available time, type, reason, and duration; save. | Appointment is created once and appears under the correct patient and dentist.                                           |              |
| APT-02 | Required fields        | Try booking without a patient, dentist, date, or time.                                                                           | Submission is blocked with clear field-level validation.                                                                 |              |
| APT-03 | Dentist schedule       | View list/calendar and filter by the selected dentist and date.                                                                  | The appointment appears at the correct local Addis Ababa time without timezone drift.                                    |              |
| APT-04 | Collision handling     | Attempt to book the same dentist for an overlapping time.                                                                        | A clear conflict warning appears or the occupied slot is unavailable.                                                    |              |
| APT-05 | Reschedule             | Edit the QA appointment to another available time; refresh the page.                                                             | The original slot is released and only the new date/time remains.                                                        |              |
| APT-06 | Cancellation           | Cancel an appointment and provide a reason if prompted.                                                                          | Status becomes cancelled; it is excluded from active queue counts but remains in history.                                |              |
| APT-07 | Check-in workflow      | For a scheduled appointment, perform check-in and inspect the queue.                                                             | Status changes to checked-in and the patient appears once in today’s queue.                                              |              |
| APT-08 | Appointment completion | Progress an eligible appointment through in-chair/check-out/completed states.                                                    | Status transitions occur in valid order and timestamps/history are retained.                                             |              |
| APT-09 | Appointment history    | Open the QA patient’s appointment history.                                                                                       | Original, rescheduled, cancelled, and completed states are represented accurately without duplicate active appointments. |              |
| APT-10 | Filters and search     | Filter by date, status, dentist, and QA patient search term.                                                                     | Results and counts match the selected criteria; reset restores all appointments.                                         |              |

## 6. Assessment & Treatment Management

### 6.1 Examination, diagnosis, and dental chart

| ID     | Test              | Steps                                                                                            | Expected result                                                                                  | Result/notes |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------ |
| TRT-01 | Assessment entry  | Open the QA patient’s clinical/treatment workflow and record examination findings.               | Findings save successfully and remain tied to the patient and encounter.                         |              |
| TRT-02 | Diagnosis         | Add the QA diagnosis with tooth/area and notes, then refresh.                                    | Diagnosis persists and is visible in the clinical record and treatment context.                  |              |
| TRT-03 | Dental chart      | Open the dental chart, select a permanent tooth using FDI notation, and add a condition/surface. | The correct tooth and surface change visually; condition and notes persist after refresh.        |              |
| TRT-04 | Chart history     | Change or resolve the charted condition.                                                         | Current state is correct while prior chart activity remains auditable where history is provided. |              |
| TRT-05 | Patient isolation | Switch the chart’s patient selector to another patient.                                          | The chart changes to that patient and does not retain QA patient conditions.                     |              |

### 6.2 Treatment plan and execution

| ID     | Test                     | Steps                                                                                                                                  | Expected result                                                                                           | Result/notes |
| ------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------ |
| TRT-06 | Create treatment plan    | Create `QA Treatment Plan <date>` for the QA patient and add at least two procedure items with tooth/area, quantity, price, and notes. | Plan saves once; totals equal the sum of line items and display in ETB.                                   |              |
| TRT-07 | Plan validation          | Attempt to save a plan without selecting a patient or without required treatment items.                                                | Submission is blocked with a clear explanation.                                                           |              |
| TRT-08 | Plan status and progress | Open the plan and move it through available approval/active states.                                                                    | Status badge and progress values update consistently across list and detail pages.                        |              |
| TRT-09 | Create treatment         | Create a treatment from one plan item or manually, assigning patient, dentist, procedure, and tooth/area.                              | Treatment appears once in the treatment list and patient record with status planned.                      |              |
| TRT-10 | Start treatment          | Start the planned treatment.                                                                                                           | Status changes to in progress; start timestamp and responsible dentist are correct.                       |              |
| TRT-11 | Procedure performed      | Record the performed procedure, clinical notes, materials where supported, and outcome.                                                | Procedure details persist and are available in the patient’s previous treatments.                         |              |
| TRT-12 | Treatment progress       | Complete one item while leaving another active.                                                                                        | Plan completion percentage and counts accurately reflect completed versus remaining items.                |              |
| TRT-13 | Complete treatment       | Complete the active treatment with completion notes.                                                                                   | Status changes to completed; completed treatment cannot accidentally be started again.                    |              |
| TRT-14 | Follow-up tracking       | Create a follow-up date/instruction or appointment from the treatment workflow.                                                        | Follow-up is visible in the relevant patient/appointment view with the correct date and instruction.      |              |
| TRT-15 | Clinical chronology      | Review the patient record after treatment completion.                                                                                  | Assessment → diagnosis → plan → performed procedure → notes → follow-up appears in a coherent chronology. |              |

## 7. Billing & Payments

| ID     | Test                        | Steps                                                                                                   | Expected result                                                                                                                      | Result/notes |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| BIL-01 | Create invoice              | Create an invoice for the QA patient using the completed treatment or a known line item.                | Invoice number is unique; patient, items, quantities, totals, dates, and status are correct.                                         |              |
| BIL-02 | Currency                    | Review billing dashboard, invoice list/detail, payment form, receipt, and reports.                      | Every amount uses ETB consistently; no ₹, INR, $, or Indian digit grouping appears.                                                  |              |
| BIL-03 | Invoice calculation         | Add multiple items and verify subtotal, discount, tax if configured, paid amount, and balance manually. | Displayed total follows the configured clinic calculation and contains no rounding inconsistency.                                    |              |
| BIL-04 | Fixed discount              | Apply an authorized fixed ETB discount.                                                                 | Total decreases by the exact amount and the discount is shown on invoice/receipt/audit trail.                                        |              |
| BIL-05 | Percentage discount         | Apply an authorized percentage discount.                                                                | Discount uses the correct calculation base and cannot exceed configured limits.                                                      |              |
| BIL-06 | Partial payment             | Record a partial cash payment against the invoice.                                                      | Payment appears once; invoice becomes partially paid and outstanding balance decreases exactly.                                      |              |
| BIL-07 | Final payment               | Record the remaining payment using another supported payment method.                                    | Invoice becomes paid and outstanding balance becomes zero.                                                                           |              |
| BIL-08 | Receipt                     | Open/print the generated receipt.                                                                       | Receipt has clinic and patient details, payment reference, method, date, invoice link, amount in ETB, and no unrelated patient data. |              |
| BIL-09 | Payment idempotency         | Refresh after submitting payment and revisit the payment list.                                          | The payment was recorded once; refresh does not duplicate it.                                                                        |              |
| BIL-10 | Outstanding balance         | Create or retain an unpaid invoice and inspect patient profile and billing dashboard.                   | Patient and aggregate outstanding balances increase by the same amount and later decrease after payment.                             |              |
| BIL-11 | Insurance provider          | Create/select an insurance provider and attach valid policy information to the QA patient.              | Provider and policy persist and remain patient-specific.                                                                             |              |
| BIL-12 | Insurance/pre-authorization | Submit an eligible pre-authorization or claim workflow.                                                 | Status, requested amount, patient, provider, and supporting treatment remain linked and trackable.                                   |              |
| BIL-13 | Invalid payment             | Attempt zero, negative, or greater-than-allowed payment amounts.                                        | Invalid amounts are rejected with a clear message and balances remain unchanged.                                                     |              |

## 8. Dental Laboratory Management

| ID     | Test                | Steps                                                                                                                                                  | Expected result                                                                                             | Result/notes |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------ |
| LAB-01 | Vendor availability | Open **Laboratory → Vendors** and confirm at least one active vendor, or create a QA vendor.                                                           | Active vendor is selectable when creating a lab order.                                                      |              |
| LAB-02 | Create crown order  | Create a crown order for the QA patient with vendor, dentist, tooth, shade/material, due date, priority, and estimated cost.                           | Order saves once with correct patient, work type, details, dates, and ETB cost.                             |              |
| LAB-03 | Other work types    | Confirm bridge, denture, partial denture, implant crown, veneer, inlay/onlay, night guard, retainer, aligner, model, and other appear where supported. | Work-type options are readable and selecting each does not break the form.                                  |              |
| LAB-04 | Required fields     | Submit a new order without patient, vendor, work type, due date, or required cost.                                                                     | Submission is blocked and each missing requirement is clear.                                                |              |
| LAB-05 | Status lifecycle    | Move the QA order through created → sent to lab → in progress → quality check → ready → delivered/fitted as supported.                                 | Only valid transitions are available; list/detail status and dates stay synchronized.                       |              |
| LAB-06 | Remake/cancellation | Mark a test order as remake required or cancelled with notes.                                                                                          | Reason is retained, status is visually distinct, and it is excluded from active/ready counts appropriately. |              |
| LAB-07 | Filters             | Filter by status, vendor, work type, priority, and QA patient/order search.                                                                            | Only matching orders display; reset restores the complete list.                                             |              |
| LAB-08 | Cost reporting      | Compare order estimated/actual cost with laboratory summaries or exports.                                                                              | The same ETB value and order identity appear consistently.                                                  |              |

## 9. Reports & Dashboard

Use the records created above so expected count changes are known.

| ID     | Test                   | Steps                                                                                        | Expected result                                                                                                  | Result/notes |
| ------ | ---------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------ |
| RPT-01 | Dashboard freshness    | Note dashboard values, create a patient/appointment/payment, then refresh.                   | Relevant cards and recent-activity sections update without duplicate counts.                                     |              |
| RPT-02 | Patient statistics     | Open patient analytics for a period containing the QA patient.                               | Total/new patient figures include the QA record exactly once and exclude it outside the period.                  |              |
| RPT-03 | Appointment statistics | Compare scheduled, completed, cancelled, and no-show figures with appointment filters.       | Report totals equal underlying appointment records for the same date range.                                      |              |
| RPT-04 | Treatment reports      | Filter clinical/treatment reports by date, status, procedure, and dentist where available.   | Completed QA treatment appears under the correct procedure/dentist and totals.                                   |              |
| RPT-05 | Revenue report         | Compare report revenue with the QA invoice/payment and billing dashboard for the same dates. | Paid/collected revenue and outstanding invoiced amounts are not confused or double-counted.                      |              |
| RPT-06 | Dentist performance    | Open dentist/doctor performance for the selected QA dentist.                                 | Appointment, treatment, production/revenue, and commission figures use only that dentist’s attributable records. |              |
| RPT-07 | Clinic performance     | Review clinic-level operational indicators.                                                  | Values are internally consistent with patient, appointment, treatment, and billing reports.                      |              |
| RPT-08 | Date boundaries        | Test today, this month, a custom range, and a range excluding QA records.                    | Inclusive/exclusive boundaries behave consistently in Africa/Addis_Ababa timezone.                               |              |
| RPT-09 | Export                 | Export available CSV/PDF reports and open the downloaded files.                              | Export succeeds; filters, headers, row data, dates, and ETB totals match the on-screen report.                   |              |
| RPT-10 | Empty state            | Select a range with no records.                                                              | A clear zero/empty state appears instead of an exception, stale previous data, or misleading chart.              |              |

## 10. Accounting & Finance

| ID     | Test                        | Steps                                                                                                                  | Expected result                                                                                                                   | Result/notes |
| ------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| FIN-01 | Revenue/income              | Open **Accounting & Finance** and compare this-month revenue with billing reports for the same dates.                  | Revenue uses posted transactions consistently and displays in ETB.                                                                |              |
| FIN-02 | Expenses                    | Create or identify a QA expense if expense entry is available; verify category, date, reference, and amount.           | Expense persists once and reduces net cash flow for the correct period. If entry is unavailable, record as a functional gap.      |              |
| FIN-03 | Cash flow                   | Compare inflows from QA payments and outflows from QA expense for the same period.                                     | Net cash flow equals inflows minus outflows and uses the same date basis throughout.                                              |              |
| FIN-04 | Receivables                 | Compare finance receivables with unpaid/partially paid invoices.                                                       | Outstanding totals match billing and patient balances without counting paid invoices.                                             |              |
| FIN-05 | Commission rules            | Open **Finance → Commissions**; set or inspect an authorized dentist commission rule.                                  | Rule saves and states its percentage/basis clearly.                                                                               |              |
| FIN-06 | Dentist commission          | Compare the QA dentist’s completed revenue and calculated commission.                                                  | Eligible revenue is included once; commission equals the configured rule and excludes unpaid/ineligible work according to policy. |              |
| FIN-07 | Commission statement        | Filter by period and open/export the dentist statement.                                                                | Dentist, revenue basis, rate, commission payable, and period match on-screen values.                                              |              |
| FIN-08 | Financial reports           | Compare aging, revenue by procedure, revenue by doctor, and daily collections to source invoices/payments.             | Totals reconcile and aging buckets use invoice due dates correctly.                                                               |              |
| FIN-09 | Cross-module reconciliation | Reconcile the QA invoice total, discounts, payments, outstanding balance, reported revenue, cash flow, and commission. | The same transaction chain reconciles without unexplained differences or currency mismatch.                                       |              |

## 11. Amharic localization and typography pass

Run this section on every primary page after switching to Amharic.

| ID     | Test                | Steps                                                                                                | Expected result                                                                                                   | Result/notes |
| ------ | ------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------ |
| AMH-01 | Navigation coverage | Review header, sidebar, breadcrumbs, module titles, and quick actions.                               | No user-facing English remains except proper names, IDs, or intentionally untranslated technical terms.           |              |
| AMH-02 | Form coverage       | Review labels, placeholders, select options, validation, dialogs, buttons, and success/error toasts. | All supported user-facing text is translated consistently.                                                        |              |
| AMH-03 | Data tables         | Review table headings, filters, pagination, status labels, empty states, and export controls.        | Translation is complete and columns remain readable.                                                              |              |
| AMH-04 | Typography          | Compare Amharic headings, body text, labels, inputs, and badges across modules.                      | Ethiopic glyphs use the approved font, have even weight/line-height, and are not clipped or visually substituted. |              |
| AMH-05 | Mixed content       | Test patient names and notes containing both Amharic and Latin text/numbers.                         | Text remains legible, punctuation/order is natural, and numbers/IDs are not corrupted.                            |              |
| AMH-06 | Responsive Amharic  | Repeat key registration, booking, treatment, and billing screens at 390×844.                         | Longer translations wrap without overlap, truncation, hidden buttons, or horizontal page overflow.                |              |
| AMH-07 | Persistence         | Select Amharic, refresh, sign out/in, and navigate directly to a deep URL.                           | Language choice persists according to product policy and no page flashes into an unusable mixed theme/layout.     |              |

## 12. Security and reliability spot checks

| ID     | Test                 | Steps                                                                                      | Expected result                                                                                  | Result/notes |
| ------ | -------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------ |
| SEC-01 | Authentication guard | Sign out, then open a copied patient, invoice, or treatment URL.                           | Protected data is not displayed; user is redirected to login or receives an authorized response. |              |
| SEC-02 | Role restrictions    | If non-admin credentials are available, try administrative, billing, and settings actions. | Each role sees and can execute only permitted actions.                                           |              |
| SEC-03 | Direct-record access | While signed in, alter a patient/invoice ID in the URL to a nonexistent value.             | A safe not-found state appears; no unrelated record is returned.                                 |              |
| SEC-04 | Double submission    | Double-click save/pay/create buttons or press Enter repeatedly.                            | Only one record/transaction is created and the button shows a pending state.                     |              |
| SEC-05 | Refresh/recovery     | Refresh during or immediately after common save operations.                                | The application recovers without corrupted, partially duplicated, or misleading data.            |              |

## 13. Final reconciliation and sign-off

Before sign-off:

- [ ] All seven requested modules were tested.
- [ ] Every failed or blocked case has a defect ID.
- [ ] Patient, appointment, treatment, invoice, payment, lab, report, and finance data reconcile.
- [ ] ETB and Africa/Addis_Ababa defaults are consistent.
- [ ] English and Amharic were tested on desktop and mobile.
- [ ] No real patient or financial data was used.
- [ ] QA records were removed or clearly retained for regression testing.

### Test summary

| Result         | Count |
| -------------- | ----: |
| Passed         |       |
| Failed         |       |
| Blocked        |       |
| Not applicable |       |
| **Total**      |       |

### Release recommendation

- [ ] **GO** — no open critical/high defects; core clinical and financial reconciliation passes.
- [ ] **CONDITIONAL GO** — only documented low-risk defects remain with an accepted workaround.
- [ ] **NO-GO** — a critical workflow, data isolation, financial calculation, authentication, or deployment-readiness test fails.

**Tester signature:** ____________________  
**Product owner approval:** ____________________  
**Date:** ____________________

## 14. Defect report template

```text
Defect ID:
Title:
Module/test case:
Environment/build:
Severity: Critical / High / Medium / Low
Browser/device:
Language: English / Amharic
Preconditions:
Steps to reproduce:
Expected result:
Actual result:
Screenshot/video:
Patient/appointment/invoice test IDs (never real patient data):
Console/network error, if visible:
Reproducibility: Always / Intermittent / Once
```

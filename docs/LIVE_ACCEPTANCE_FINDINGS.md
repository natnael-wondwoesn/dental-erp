# Live Administrator Acceptance Findings

**Environment:** `https://dental-clinic-cms.duckdns.org`  
**Assessment role:** Dental clinic administrator / prospective buyer  
**Scope:** Ethiopian dental clinic workflows, English/Amharic presentation, patient-to-payment flow  
**Test data:** Synthetic records only

## Synthetic records created

- Patient: **Eyerusalem Tesfaye** (`PAT202600002`)
  - Addis Ababa address, Ethiopian mobile numbers, O+ blood group
  - Medical history: no current medication reported, dental anxiety level 2, previous routine scaling and polishing
  - Preference note: Amharic communication and morning visits
- Dentist schedule: **Dr. Selam** enabled Monday–Saturday
- Draft invoice: **INV-202608-0001**, ETB 500
  - Description: comprehensive oral examination
  - Explicitly marked as synthetic acceptance-test data; no payment collected

## Findings and resolution status

| Priority | Area                 | Live finding                                                                                                                                    | Resolution                                                                                                                         |
| -------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Critical | Patient profile      | A newly registered patient displayed a hard-coded root canal treatment, Dr. Hana, and a fabricated note even though none existed in the record. | Fixed locally: removed all demo fallbacks; the profile now renders only API data and neutral empty states.                         |
| Critical | Treatment creation   | Creating a treatment without an appointment failed. The form sent an empty string into a nullable appointment foreign key.                      | Fixed locally: empty appointment selections are stored as `null`; regression test added.                                           |
| High     | Lab order creation   | Selecting Model submitted lowercase `model`, while the database enum requires uppercase `MODEL`; the order failed.                              | Fixed locally: all work-type option values now match the database enum.                                                            |
| High     | Appointment slots    | Slot generation crashed when saved clinic hours omitted lunch fields; legacy appointments without a valid time could also crash overlap checks. | Fixed locally: merge safe defaults, validate schedule inputs, ignore invalid legacy times, and cover both cases with route tests.  |
| High     | Billing localization | Invoice UI mixed ETB totals with ₹ fixed discounts, CGST/SGST, and “Rupees Only”.                                                               | Fixed locally: ETB labels and Birr/Santim wording; 15% VAT presentation; clinical items are non-taxable by default.                |
| High     | Amharic completeness | Finance content and several navigation modules remained in English after switching to Amharic.                                                  | Core ERP hubs and shared navigation vocabulary translated; catalogue substantially expanded.                                       |
| Medium   | Amharic typography   | Ethiopian text used a global static Noto font that made mixed Latin/Ethiopic screens look inconsistent.                                         | Matched Clinic-CMS: Manrope for Latin plus variable Noto Sans Ethiopic fallback, with Amharic-specific line height/tracking rules. |
| Medium   | Dentist schedule     | Saving custom hours appeared to revert enabled days to 09:00–18:00.                                                                             | Needs production re-test after deployment; the automated browser could not reliably operate native time controls.                  |
| Medium   | Appointment booking  | Slot generation could not be completed because the automated browser could not reliably update the native date input’s React state.             | Re-test manually and after deployment; not yet classified as an application defect.                                                |
| Medium   | Finance module       | Finance advertises expenses, but no direct expense-entry workspace was exposed from the finance landing page.                                   | Product gap recorded; implementation remains.                                                                                      |
| Low      | Error feedback       | Lab/treatment forms surfaced generic failure messages and hid useful safe validation details.                                                   | Root causes fixed for the tested paths; broader error-message review remains.                                                      |

## Re-examination checklist after deployment

1. Register a second synthetic patient and confirm no treatment, note, doctor, document, date, or count appears unless created.
2. Create a treatment with no linked appointment; confirm it succeeds and appears in the patient timeline.
3. Create a `MODEL` lab order, advance it through statuses, and confirm cost remains in ETB.
4. Open invoice creation and detail views; confirm there is no ₹, INR, CGST, SGST, Rupee, Paise, Lakh, or Crore wording.
5. Switch to Amharic on dashboard, patients, appointments, treatments, billing, lab, reports, and finance.
6. Confirm mixed English names/numbers and Amharic labels use consistent font weight, baseline, and spacing.
7. Create Dr. Selam’s custom weekly hours and verify generated free slots from the appointment form.
8. Test the complete flow: patient → appointment → assessment → treatment → lab → invoice → payment → receipt → reports.

The reusable detailed script is in `docs/LIVE_SERVER_MANUAL_TEST_PLAN.md`.

## Post-deployment re-examination

- **Passed:** The new patient profile shows zero treatments and no fabricated doctor, note, file, or appointment data.
- **Passed:** Created planned treatment `TRT202608180001` for Eyerusalem Tesfaye with Dr. Selam and no linked appointment.
- **Passed:** Created Model lab order `LAB20260001` with Addis Crown Studio; the enum submission failure is resolved.
- **Passed:** Invoice values and amount-in-words render in ETB and Birr/Santim.
- **Passed:** Main navigation labels switch between English and Amharic, including AI Chat, video consults, medication catalogue, CRM, sterilization, devices, communications, and staff.
- **Passed:** The final deployment workflow completed successfully and the public readiness check passed.
- **Automation limitation:** The browser can populate the native date input visually, but it does not trigger the form's React date state. Slot generation is covered by route regressions for partial schedules and missing legacy appointment times; manual date-picker confirmation remains in the checklist.
- **Follow-up fixed:** The lab list still showed ₹ after successful order creation. Its date locale and currency formatter are now converted to Ethiopian presentation.

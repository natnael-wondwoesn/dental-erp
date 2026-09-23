# Manual Test Guide — Dental Patient Chart

## Purpose

Verify the complete patient chart workflow: patient safety context, history, examination, odontogram, radiographs, diagnosis, treatment plan, consent, progress notes, permanent record, and print output.

## Preconditions

- Application is running at `http://localhost:3001`.
- Use an `ADMIN` or `DOCTOR` account.
- At least one patient exists and has an MRN.
- For the alert test, the patient should have at least one allergy or medical condition recorded in Medical History.
- Keep one small JPEG, PNG, WebP, or PDF ready for the radiograph upload test.

## Test data

Use clearly identifiable test-only values:

| Field                | Value                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Chief complaint      | `MANUAL TEST — pain in lower-left molar for 3 days`                                             |
| HPI                  | `Sharp pain with cold drinks, severity 7/10, settles after 2 minutes.`                          |
| Blood pressure       | `128/82 mmHg`                                                                                   |
| Heart rate           | `74 bpm`                                                                                        |
| Temperature          | `36.9 °C`                                                                                       |
| Extra-oral exam      | `No facial swelling; lymph nodes not palpable.`                                                 |
| Intra-oral exam      | `Deep occlusal lesion on tooth 36; gingiva mildly inflamed.`                                    |
| Radiograph finding   | `Periapical image shows lesion approaching pulp on tooth 36.`                                   |
| Diagnosis            | `Symptomatic irreversible pulpitis associated with tooth 36.`                                   |
| Treatment plan       | `Phase 1: pain control and RCT 36.\nPhase 2: definitive crown 36.\nPhase 3: preventive review.` |
| Cost estimate        | `ETB 12,500`                                                                                    |
| Completed procedure  | `Clinical examination and emergency dressing on 36.`                                            |
| Materials/anesthesia | `2% lidocaine with epinephrine; temporary restorative material.`                                |
| Post-op instructions | `Avoid chewing on tooth 36; return if swelling or severe pain occurs.`                          |
| Next visit           | `7 days — commence root canal treatment on 36.`                                                 |

> Tooth numbering uses FDI notation. Tooth 36 is the lower-left first permanent molar.

## Test cases

### TC-01 — Open chart and verify safety banner

1. Sign in as an administrator or doctor.
2. Open **Patients**, then open a patient record.
3. Select **Dental chart**.
4. Scroll through the page.

Expected:

- Chart uses the same cards, typography, spacing, buttons, and navigation style as the rest of the application.
- Sticky red safety banner shows patient name, MRN, age, sex, and medical alerts/allergies.
- Banner remains visible while scrolling.
- Existing medical and dental history values are prefilled where available.

### TC-02 — Required-field validation

1. Leave **Chief Complaint** and **Diagnosis / Assessment** empty.
2. Select **Save and prepare print**.

Expected:

- Save is stopped.
- Error says chief complaint and diagnosis are required.
- No chart is added to **Previous Clinical Charts**.

### TC-03 — History and examination

1. Enter the test data for chief complaint and HPI.
2. Review or update PMH, alerts/allergies, PDH, and social/family history.
3. Enter all three vital signs.
4. Enter extra-oral and intra-oral findings.

Expected:

- All entries remain visible while completing the page.
- Medical-alert edits immediately appear in the sticky banner.

### TC-04 — Interactive odontogram

1. Select tooth **36**.
2. Select an abnormal condition such as **Caries**.
3. Set severity, affected surfaces, and a short note.
4. Save the tooth entry.

Expected:

- All 32 permanent teeth are available.
- Tooth 36 changes appearance according to its condition.
- Active-condition count/history updates.
- Reloading the chart retains the tooth entry.

### TC-05 — Radiograph upload and viewing

1. Choose a supported image or PDF in **Upload Radiograph**.
2. Enter `MANUAL TEST — periapical tooth 36` as description.
3. Select **Upload**.
4. Open the new radiograph link.

Expected:

- Success notification appears.
- File and description appear in the radiograph list.
- Link opens the uploaded image or PDF.
- Unsupported or oversized files are rejected.

### TC-06 — Diagnosis, phased plan, cost, and consent

1. Enter the diagnosis, phased treatment plan, and ETB estimate from the test data.
2. Confirm the patient consent name.
3. Tick the consent checkbox.
4. Draw a signature in the signature pad.

Expected:

- Signature preview appears.
- Clear button can remove it; draw it again before continuing.

### TC-07 — Progress notes and permanent record

1. Enter completed procedure, materials/anesthesia, post-op instructions, and next visit.
2. Select **Save and prepare print** once.

Expected:

- Success notification includes a chart number such as `DC-2026-00001`.
- Print view opens in a new tab.
- Saved chart appears in **Previous Clinical Charts** after returning/reloading.
- Record has a print action but no edit/delete action.

### TC-08 — Print output

1. In print view, inspect every section.
2. Open the browser print preview.

Expected:

- Clinic header and chart number display.
- Patient identity and medical-alert banner display.
- History, examination, diagnosis, plan/cost, consent, progress, and generated S/O/A/P narrative display.
- Consent signature displays when captured.
- A4 preview is legible, with no clipped or overlapping content.
- Browser-only controls are absent from printed pages.

### TC-09 — Reopen and print immutable record

1. Reload the patient chart page.
2. Find the saved chart under **Previous Clinical Charts**.
3. Select **Print**.

Expected:

- Previously saved values are unchanged.
- Print output matches the saved encounter.
- Saving a later encounter creates a new chart; it does not overwrite the earlier one.

### TC-10 — Role and tenant isolation

1. Sign in as a receptionist and open the same patient's chart.
2. Attempt to view/print the chart.
3. If possible, submit a save request using browser developer tools.
4. Try a patient URL belonging to another clinic or a non-existent patient.

Expected:

- Receptionist may view and print.
- Receptionist cannot create a chart; server returns `403`.
- Cross-clinic/non-existent patient is not disclosed (`404`).

## Result record

| Test  | Result  | Evidence / notes                                                                                                                         |
| ----- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| TC-01 | Pass    | Selamawit Bekele; MRN/age/sex and Diabetes/Hypertension banner shown.                                                                    |
| TC-02 | Pass    | Save blocked; required-data notification shown; no chart created.                                                                        |
| TC-03 | Pass    | All history/examination fields retained; edited alert appeared in sticky banner.                                                         |
| TC-04 | Pass    | Tooth 36 saved as mild occlusal caries; count changed to 1 and survived reload.                                                          |
| TC-05 | Pass    | PNG uploaded, description listed, protected file link generated.                                                                         |
| TC-06 | Pass    | Phased plan, ETB estimate, consent checkbox, and drawn signature accepted.                                                               |
| TC-07 | Pass    | Immutable chart `DC-2026-00001` created and listed with print-only action.                                                               |
| TC-08 | Partial | Browser print document visually inspected; all sections, SOAP note, and signature present. Native OS print-preview dialog not exercised. |
| TC-09 | Pass    | Reload retained chart, caries entry, and radiograph; no edit/delete action exists.                                                       |
| TC-10 | Partial | Receptionist POST returned 403 and non-existent patient returned 404. Receptionist UI view/print was not exercised.                      |

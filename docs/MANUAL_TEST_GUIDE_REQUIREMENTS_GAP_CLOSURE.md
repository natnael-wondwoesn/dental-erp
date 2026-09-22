# Manual QA Guide — Requirements Gap Closure

**Scope:** the current `codex/client-requirements-audit` changes only:

- atomic doctor patient claiming and queue behavior;
- payment provider/recorder attribution and concurrent payment protection;
- survey response access control and clinic isolation;
- six-month recall scheduling, SMS delivery state, retries, and patient return tracking;
- Ethiopian UI and data defaults across queue, billing, AI assistance, and communications settings.

This guide does not claim that GoodDoc integration or inventory purchase workflows are complete yet. Recall SMS requires a configured provider and an external scheduler in the target environment before live delivery can be signed off.

## Test record

| Field          | Value |
| -------------- | ----- |
| Tester         |       |
| Date/time      |       |
| Build/commit   |       |
| Base URL       |       |
| Browser/device |       |
| Database       |       |

Use synthetic records only. Prefix every record with `QA-<date>` and delete or archive them after testing.

## 1. Prerequisites

1. Start the development stack and application using the repository's normal procedure.
2. Apply the new database migrations to the test database:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

3. Confirm the application is reachable and that the database is ready.
4. Prepare two active doctor accounts in the same clinic, one receptionist account, and one administrator account. Each doctor must have an associated active `Staff` record.
5. Prepare one unpaid invoice with a known balance, for example ETB 1,000.
6. Prepare one active survey in the same clinic and, if possible, a survey in a second clinic for isolation testing.
7. Give the QA patient a synthetic Ethiopian mobile number, such as `0911000000`, and complete one treatment with a known end date.
8. For live SMS tests, configure a provider that can deliver to Ethiopia, the clinic timezone as `Africa/Addis_Ababa`, and a safe test recipient. Set `CRON_SECRET` and ensure you can invoke the recall cron endpoint manually.

Record the synthetic IDs below:

| Record                    | ID / value |
| ------------------------- | ---------- |
| Clinic A                  |            |
| Clinic B (isolation test) |            |
| Doctor A                  |            |
| Doctor B                  |            |
| Receptionist              |            |
| Administrator             |            |
| QA patient                |            |
| Checked-in appointment    |            |
| Invoice                   |            |
| Survey                    |            |
| Completed treatment       |            |
| Recall                    |            |

For every case, record **PASS**, **FAIL**, or **BLOCKED** and attach the timestamp, URL, and screenshot for failures.

## 1A. Ethiopian localization smoke test

### LOC-01 — Clinic identity and core workflow UI

1. Open the dashboard, Today’s Queue, an invoice, and Payment Plans.
2. Compare their page shell, navigation, spacing, cards, typography, and controls.
3. Check the clinic, staff, patient, address, phone, currency, and timezone shown on those pages.

Expected:

- The pages use the same established ERP shell and component styling.
- The clinic is in Addis Ababa and sample people use Ethiopian names and `09…`/`+251…` phone numbers.
- Monetary values display as ETB/birr; no rupee symbol or Indian locale content is visible.
- Dates and times use the clinic’s `Africa/Addis_Ababa` settings.

Result/notes: ______________________________

### LOC-02 — English and Amharic behavior

1. On Today’s Queue and a patient profile, switch the interface to Amharic.
2. Confirm the newly added queue/recall labels translate and remain readable.
3. Switch back to English.
4. Open the AI treatment assistant consent-language selector.

Expected:

- New workflow labels participate in the same language switch as the rest of the app.
- English and Amharic are offered; Hindi and Tamil are not offered.
- Switching languages does not change clinic data, amounts, or workflow state.

Result/notes: ______________________________

### LOC-03 — Billing and communications defaults

1. Open **Settings → Billing** and **Settings → Communications**.
2. Confirm the billing defaults and SMS test-number guidance.
3. Open an invoice payment dialog and a payment plan.

Expected:

- Billing defaults show ETB and Ethiopian VAT terminology.
- SMS guidance expects `+251` format and uses Africa/Addis_Ababa local hours.
- Payment methods show Telebirr, bank transfer, and mobile-money wording where applicable.
- Legacy provider options, if retained for old installations, are explicitly labeled as legacy.

Result/notes: ______________________________

## 2. Queue and atomic doctor assignment

### Q-01 — Reception check-in creates one waiting patient

1. Sign in as Receptionist.
2. Open the QA appointment scheduled for today.
3. Check the patient in.
4. Open **Appointments → Today’s Queue**.

Expected:

- The appointment status is `CHECKED_IN`.
- The patient appears exactly once under **Waiting**.
- No doctor claim or assignment timestamp is shown yet.
- Refreshing the page does not create a duplicate queue row.

Result/notes: ______________________________

### Q-02 — All Doctors filter really means all doctors

1. While signed in as Receptionist, open Today’s Queue.
2. Leave the doctor selector at **All Doctors**.
3. Note the waiting count.
4. Select a specific doctor and note the filtered count.
5. Return to **All Doctors**.

Expected:

- All Doctors shows waiting appointments across the clinic.
- A specific doctor filters only appointments assigned to that doctor.
- Returning to All Doctors restores the original unfiltered count.

Result/notes: ______________________________

### Q-03 — Doctor sees Take Patient, receptionist does not

1. Open the queue as Receptionist.
2. Open the same queue as Doctor A in a separate browser profile or private window.

Expected:

- Doctor A sees **Take Patient** for a checked-in patient.
- Receptionist does not see a doctor claim control.
- Directly calling the take endpoint as a non-doctor returns HTTP `403`.

Result/notes: ______________________________

### Q-04 — First doctor wins a claim

1. Ensure the patient is `CHECKED_IN` and waiting.
2. Sign in as Doctor A and select **Take Patient**.
3. Refresh the queue.

Expected:

- The request succeeds.
- Status becomes `IN_PROGRESS`.
- The appointment doctor is Doctor A.
- An assignment timestamp is present in the database/API response.
- The patient moves from Waiting to In Progress.

Result/notes: ______________________________

### Q-05 — Second doctor cannot take the same patient

1. Check in a second synthetic appointment, or reset a test appointment to waiting using test data only.
2. Open the same waiting patient at nearly the same time as Doctor A and Doctor B.
3. Have both doctors click **Take Patient**.
4. Refresh both queues and inspect the appointment detail.

Expected:

- Exactly one request succeeds.
- The losing request returns HTTP `409` and a clear “already taken” message.
- The final assigned doctor and assignment timestamp belong to only the winning doctor.
- No duplicate treatment/appointment is created.

Optional API check from two authenticated sessions:

```bash
curl -i -X POST "$BASE_URL/api/appointments/$APPOINTMENT_ID/take" \
  -H "Cookie: $DOCTOR_A_SESSION_COOKIE"

curl -i -X POST "$BASE_URL/api/appointments/$APPOINTMENT_ID/take" \
  -H "Cookie: $DOCTOR_B_SESSION_COOKIE"
```

Run the two requests as close together as possible. Do not use real patient cookies or data in a shared shell history.

Result/notes: ______________________________

### Q-06 — Generic status update cannot bypass assignment

1. Use an authenticated doctor or an API client against a checked-in appointment.
2. Send `PUT /api/appointments/<id>` with `{ "status": "IN_PROGRESS" }`.

Expected:

- HTTP `409` is returned with instructions to use **Take Patient**.
- The appointment remains unassigned and `CHECKED_IN`.

Result/notes: ______________________________

### Q-07 — Invalid claim states are safe

Repeat the Take Patient action for an appointment that is `SCHEDULED`, `COMPLETED`, `CANCELLED`, and already `IN_PROGRESS`.

Expected:

- No state is corrupted.
- The API returns `404` for an unknown appointment and `409` for a known appointment that is not claimable.

Result/notes: ______________________________

## 3. Payments and financial audit trail

### PAY-01 — Record a cash payment

1. Sign in as Receptionist.
2. Open the QA invoice and record a partial cash payment.
3. Refresh the invoice and open payment history.

Expected:

- The invoice paid amount increases by exactly the payment amount.
- The remaining balance decreases by exactly the same amount.
- The payment date, amount, method, and payment number are correct.
- **Recorded by** identifies the receptionist.

Result/notes: ______________________________

### PAY-02 — Record Telebirr with provider

1. Record a payment using **Telebirr**.
2. Enter `Telebirr` (or the configured provider name) in the provider field.
3. Save and reopen the invoice.

Expected:

- The payment is accepted.
- Method is Telebirr and provider is persisted.
- Recorded-by user is shown.
- Omitting the provider causes a clear validation error and creates no payment.

Result/notes: ______________________________

### PAY-03 — Bank transfer requires the bank/provider

1. Try to record a bank transfer without a bank/provider.
2. Confirm it is rejected.
3. Enter a synthetic bank/provider name and retry.

Expected:

- The first attempt is rejected with HTTP `400`/clear UI validation.
- The second attempt succeeds and displays the selected bank/provider.

Result/notes: ______________________________

### PAY-04 — Concurrent payments cannot overpay

1. Use an invoice with exactly ETB 1,000 remaining.
2. Open the payment dialog in two separate sessions.
3. Submit ETB 1,000 from both sessions nearly simultaneously.

Expected:

- One payment succeeds.
- The other receives HTTP `409` with a stale-balance/refresh message.
- Final invoice balance is zero, paid amount is ETB 1,000, and only one ETB 1,000 payment exists.

Result/notes: ______________________________

### PAY-05 — Role restrictions

1. As Doctor, attempt to open invoice payment history.
2. As Doctor, attempt to record a payment.
3. As Receptionist, record a payment.
4. As Administrator or Accountant, record a payment if that role is enabled.

Expected:

- Doctor can only read financial data if the clinic's approved permission policy allows it.
- Doctor cannot record payments.
- Receptionist, Administrator, and Accountant follow the configured write policy.
- Direct API calls enforce the same rules as the UI.

Result/notes: ______________________________

## 4. Survey results and tenant isolation

### SUR-01 — Administrator can read own-clinic results

1. Sign in as Administrator for Clinic A.
2. Open the feedback/survey results for the Clinic A survey.

Expected:

- Results and aggregate statistics load.
- Answers and ratings are displayed correctly.

Result/notes: ______________________________

### SUR-02 — Non-administrator cannot read results

1. Sign in as Doctor or Receptionist.
2. Open the same survey-results URL or call `GET /api/communications/surveys/<id>/responses`.

Expected:

- HTTP `403` is returned or the UI shows an access-denied state.
- No response answers, ratings, IP addresses, or user-agent data are returned.

Result/notes: ______________________________

### SUR-03 — Cross-clinic survey isolation

1. Sign in as Clinic A Administrator.
2. Replace the survey ID in the results URL with the known Clinic B survey ID.
3. Repeat through the API if available.

Expected:

- HTTP `404` is returned.
- Clinic B response data is never returned to Clinic A.

Result/notes: ______________________________

## 5. Six-month recall and SMS

### REC-01 — Schedule from the latest completed treatment

1. Sign in as Receptionist or Administrator.
2. Open the QA patient's detail page.
3. Under **Six-month recall**, select **Schedule**.

Expected:

- A recall is created from the patient's latest completed treatment, not from today's date.
- The follow-up is six calendar months after the treatment end date.
- The reminder is seven days before the follow-up date.
- The card shows `scheduled` and SMS `pending`.
- The stored creator is the signed-in user.

Concrete date check: a treatment completed on **January 1, 2026** produces follow-up **July 1, 2026** and reminder **June 24, 2026**.

Result/notes: ______________________________

### REC-02 — Completed treatment and duplicate safeguards

1. Try scheduling for a patient with no completed treatment.
2. Schedule a valid recall, then select **Schedule** again without completing a newer treatment.

Expected:

- The first case is rejected with a clear completed-treatment requirement.
- The duplicate attempt returns HTTP `409`/a clear already-scheduled message.
- Only one recall exists for that patient and follow-up date.

Result/notes: ______________________________

### REC-03 — Recall role permissions and clinic isolation

1. As Doctor, view the patient detail and recall history.
2. As Doctor, call `POST /api/patients/<patient-id>/recalls` directly.
3. As Receptionist, repeat the POST for an eligible patient.
4. While signed into Clinic A, substitute a Clinic B patient or recall ID in GET/PATCH requests.

Expected:

- Doctor may read recall history but cannot schedule, cancel, or mark returned (`403`).
- Receptionist and Administrator can schedule and update recalls.
- Cross-clinic records return `404`; no patient or recall data leaks.

Result/notes: ______________________________

### REC-04 — Ethiopian number and allowed-hours behavior

1. Use patient number `0911000000` or `+251911000000` and clinic timezone `Africa/Addis_Ababa`.
2. Make a recall due and invoke the protected cron between 09:00 and 20:59 clinic time.
3. Repeat with another due test record outside that window.

```bash
curl -i "$BASE_URL/api/cron/recall" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected:

- The local and `+251` formats are accepted and normalized for the provider.
- During allowed hours, the due record is claimed and a delivery attempt is logged.
- Outside 09:00–21:00, sending fails safely with an explanatory log/error; it is not marked sent.
- The response exposes counts under `recallReminders` without exposing the secret.

Result/notes: ______________________________

### REC-05 — Reminder content and successful delivery state

1. Set a recall's reminder date to now and follow-up date in the future.
2. Invoke the cron during allowed hours with the test SMS provider configured.
3. Inspect the received SMS, patient recall card, database/API response, and SMS log.

Expected:

- The message contains the patient name, follow-up/check-up date, clinic name, and clinic contact number when configured.
- Exactly one SMS is received.
- Recall state becomes `REMINDER_SENT`, SMS state becomes `SENT`, and send time/log ID are stored.
- Refreshing patient detail shows the persisted state.

Result/notes: ______________________________

### REC-06 — Concurrent cron calls send only once

1. Create one due pending recall.
2. Invoke the cron twice at nearly the same time using two terminals.

Expected:

- Only one invocation claims the recall.
- Exactly one provider request/SMS log is produced for the successful send.
- The other invocation reports the record as skipped or does not include it as sendable.
- SMS attempts are not double-counted by the losing invocation.

Result/notes: ______________________________

### REC-07 — Failure, retry limit, and stale-claim recovery

1. Make the provider reject a safe test send (for example, use a provider sandbox failure number).
2. Invoke the cron and inspect the recall.
3. Correct the provider/number and invoke again while the recall is due.
4. Separately create a `SENDING` test recall whose processing timestamp is more than 15 minutes old, then invoke the cron.

Expected:

- A failure stores SMS `FAILED`, the error text, and an incremented attempt count; it does not mark the reminder sent.
- A corrected record can retry, with no more than three total claims.
- A stale `SENDING` claim becomes retryable after 15 minutes.
- No failed attempt is silently lost.

Result/notes: ______________________________

### REC-08 — Record patient return

1. On a scheduled or reminder-sent recall, select **Mark returned** as Receptionist or Administrator.
2. Refresh the page and try the action again through the API.

Expected:

- Status becomes `RETURNED` and a return timestamp is stored.
- The action is no longer shown.
- A second terminal update is rejected with HTTP `409`.

Result/notes: ______________________________

## 6. Responsive and recovery checks

Repeat Q-02, Q-04, PAY-01, and PAY-02 at approximately 1440×900, 768×1024, and 390×844.

Expected:

- Queue cards and payment dialogs remain usable.
- Buttons do not overlap or become unreachable.
- Tables scroll within their container rather than causing page-wide horizontal overflow.
- Refreshing after a successful action shows the same persisted state.

Result/notes: ______________________________

## 7. Evidence and defect template

For every failure capture:

- test ID and exact timestamp;
- build/commit and browser/device;
- synthetic patient, appointment, invoice, or survey ID;
- screenshot or short recording;
- response status/body from the browser Network panel when relevant;
- whether the issue reproduces after refresh and in a second browser session.

```text
Test ID:
Severity: Critical / High / Medium / Low
Build/commit:
Browser/device:
Preconditions:
Steps:
Expected:
Actual:
Synthetic record IDs:
Screenshot/network evidence:
Reproducibility:
```

## 8. Sign-off

| Area                                | Pass | Fail | Blocked | Notes |
| ----------------------------------- | ---: | ---: | ------: | ----- |
| Queue and atomic assignment         |      |      |         |       |
| Payment attribution and concurrency |      |      |         |       |
| Survey authorization/isolation      |      |      |         |       |
| Six-month recall and SMS            |      |      |         |       |
| Responsive behavior                 |      |      |         |       |

Release recommendation: **GO / CONDITIONAL GO / NO-GO**
Tester signature: ____________________
Product owner: ____________________
Date: ____________________

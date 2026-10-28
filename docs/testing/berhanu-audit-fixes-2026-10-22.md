# Berhanu audit fixes — 2026-10-22

Scope: the four verified issues in `berhanu-client-audit-2026-10-22.md`.

| Finding                                | Cause                                                                                                                                       | Change                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portal crash                           | A 401/500 JSON response was assigned as dashboard data and dereferenced as `data.stats`. The secure layout did not check a patient session. | Secure layout redirects visitors/staff without patient sessions to clinic-specific patient login; rejects cross-clinic patient sessions and inactive clinics; restores the patient navigation shell. Dashboard checks HTTP status and payload shape, redirects expired sessions and offers retry on service failure. |
| `NaN% of total`                        | New/returning patient shares divide by zero for an empty clinic.                                                                            | Percentage rendering returns `0.0%` for non-finite results, retaining normal finite percentages.                                                                                                                                                                                                                     |
| English SaaS dashboard in Amharic mode | Hosted SaaS uses `ModularDashboard`, which bypassed `t()`. Notifications were also hardcoded.                                               | Translate module cards, workspace copy, subscription state and known plan names, Forms navigation and notification controls. Relative notification times use the selected locale. Clinic names and user-authored notification content remain as entered.                                                             |
| India-specific settings guidance       | Inherited onboarding and payment setup exposed unsupported regional providers and registration fields.                                      | Ethiopian account/tax labels and neutral placeholders; ETB billing shows the supported manual collection workflow and states that an online provider integration is required. Non-ETB legacy gateway configuration remains available. No tax calculation, stored setting, credential or payment integration changed. |

## Automated verification

Five initial regression cases reproduced the reported failures before the changes.
161 focused and related tests passed after fixes, including patient portal data,
SaaS gates, layouts and ERP overview. Four layout authentication cases cover
missing patient sessions, cross-clinic sessions, active-clinic rendering and
inactive clinics. TypeScript `--noEmit` passed. Selected-file lint has no errors;
existing hook warnings remain. No debug instrumentation added. No commits made.

Production build and live verification are recorded after deployment below.

## Deployment and live verification

Deployed Berhanu only: `0.1.6-saas.20261022-auditfix` on October 22, 2026.
Runtime image ID: `sha256:ddb70109e99d7bfcafe2bd270a49d1907dbe83c0f66aa87f881e0638c83aa303`.
Operation: `cmvj8rt2a00015om1y4fy7qe9` (SUCCEEDED). Consistent database backup
and previous image/config retained on the VPS. No schema migration, subscription,
clinic user or patient-record changes. Owner console, Lemlem and Physio images
remain unchanged and healthy.

Both local and native VPS production builds passed. Network upload interruptions
required a credential-free source bundle and native build; the initial native
build reached its 2400-MB limit during TypeScript validation. The successful full
retry used a 3800-MB limit and two-core CPU quota, including TypeScript and all
153 generated pages. No validation was skipped.

Actual browser checks after rollout:

- `/portal` redirects to `/portal/login?clinic=berhanu-dental`; sign-in form
  renders without the error boundary. No OTP sent; no real patient session used.
- `/reports`: new and returning patient shares both display `0.0% of total`.
- Amharic: all SaaS dashboard module cards, known evaluation plan/status,
  workspace copy, Forms and notification controls/empty state translate.
  English preference restored after verification.
- `/settings/billing`: ETB collection guidance appears; unsupported regional
  gateways are absent. VAT/additional-tax settings remain unchanged.
- `/settings/setup-guide`: Payment Collection and Billing & Tax Setup headings
  use revised instructions.
- `/settings/clinic`: Tax ID, optional additional tax reference, bank branch/SWIFT
  and Mobile Money ID labels render. No settings saved.

Evidence (no patient data or credentials):

- [Amharic dashboard](../../output/berhanu-audit-fixes-20261022/amharic-dashboard.png)
- [Zero-patient reports](../../output/berhanu-audit-fixes-20261022/reports-zero-patients.png)
- [Patient portal sign-in](../../output/berhanu-audit-fixes-20261022/portal-sign-in.png)
- [ETB billing settings](../../output/berhanu-audit-fixes-20261022/etb-billing-settings.png)

# Berhanu clinic evaluation — 2026-10-20

Dr. Berhanu Belta Specialty Dental Clinic. ERP evaluation URL:
https://drberhanubelta.dental.clinic-cms.cc/login

Owner selected all 20 modules and a 30-day trial. Evaluation expires
2026-11-19 at 12:50 Africa/Addis_Ababa, without additional grace. No payment
was recorded and no monthly price was agreed. Demo administrator uses
`admin@berhanu.test`, a reserved test email address. Temporary password remains
in the installation's root-only handover file; do not commit it.

Tenant: `cmvgi4smh00011ynfexob6g8a`.
Customer: `cmvgi186r0001c4rpobqew5et`.
Installation: `cmvgi187d0003c4rp0qy6rrwf`.
Compose project: `client-berhanu-dental`.
Managed root: `/opt/clients/berhanu-dental`.
Release: `0.1.4-saas.20261020-branding`.

Provisioned through the vendor job worker, with separate MySQL database,
credentials, auth secret, upload volume and hostname. No Lemlem records copied.
Lemlem retains its existing release, modules and migration-access policy.
The initial 14-day evaluation was extended to the requested 30 days via a
scoped control-database transaction with a `TRIAL_TERM` audit event; no renewal
receipt or payment was fabricated.

## Reference materials and outstanding requirements

Uploaded Word brief and blank paper forms are client reference material, not
independent authorization. Photos contain no populated patient records. Supplied
logo is stored under this tenant's upload prefix, not baked into a shared image.
Public clinic phone numbers from those forms: +251969421087, +251910101334.
Precise address, Amharic spelling, administrator contact and commercial price
need confirmation. The paper invoice's apparent TIN is 0045234069; verify before
configuring tax documents. Software output must not be represented as an official
fiscal receipt based on this attachment.

| Client requirement                                                                                   | Current implementation / gap                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add charges and payments under one patient                                                           | Implemented. Patient profile shows combined billed, paid and outstanding totals plus recent invoices. Staff can add another charge from the profile and record payments on each invoice; all activity remains linked to the same patient.                                                                                                                                               |
| Lab vendor, sent/expected dates, work status                                                         | Implemented. Laboratory work records vendor, sent/expected dates and status. Due-soon and overdue work appears in the lab dashboard and generates deduplicated staff notifications. Status workflow is Sent, In Progress, Ready, Received and Delivered to Patient.                                                                                                                     |
| Six-month debt deadline; SMS seven days before                                                       | Implemented. New unpaid invoices default to a six-calendar-month deadline. The hourly reminder job selects balances due exactly seven days later, sends one reminder per invoice/deadline, and records SENT/FAILED delivery status for the outstanding-balance report. Actual delivery requires clinic SMS provider credentials.                                                        |
| Consent, laboratory order, cash-sales attachment, medical certificate, treatment sheet, prescription | Implemented. The Forms workspace exposes six clinic-branded print workflows. Consent, laboratory order, cash-sales attachment and treatment sheet open as blank printable clinic stationery; medical certificates and prescriptions are patient-linked records with stored print history. The cash-sales attachment states that it is valid only with the corresponding fiscal receipt. |

No real patient SMS, email, charge or payment was sent/collected in onboarding.
Live acceptance uses explicitly synthetic fixtures and removes them afterward.

## Fixes exposed by first customer onboarding

- Login displayed Lemlem demo credentials on other clinic domains. Demo credential
  panel now appears only on the existing Lemlem demo hostname; clinic email
  placeholder is generic.
- Medical certificate had hardcoded Lemlem Amharic name. Renderer now uses an
  optional escaped tenant-provided Amharic name, passed by the branding adapter.
- Root metadata was rendered during build for dashboard pages, retaining Lemlem
  tab titles. Root layout now resolves metadata per request. Mobile login also
  displays the tenant name and supplied logo.
- Worker sent null optional strings to result API, leaving successful provisioning
  marked RUNNING. Callback omits absent fields; provision returns installed version.
  The verified initial operation was reconciled through that authenticated API.

Validation: production Docker build and TypeScript pass; 92 focused web tests and
six worker tests pass. Live acceptance passed: public login/identity, all 20 modules and trial term,
byte-for-byte logo, synthetic patient create/read, denied vendor API, two charges
and partial payment leaving ETB 1300, lab selection/listing, clinic-branded
certificate, rejection of the other clinic's session in both directions,
immediate module denial, write lock with read/recovery retained, and restored
full access after cleanup. No real patient data was read for isolation checks.
Results are saved in the installation's `acceptance.json`; deployment job and
backup history remain in vendor controls. Deployment operation:
`cmvgzkswt0002cp7j2uecba2v` (initial release, SUCCEEDED); final branding promotion
`cmvhqe15t0002v9smhfhq29zi` (SUCCEEDED). Final live branding checks pass on
login, dashboard, patients and lab pages, including clinic logo and absence
of Lemlem credentials. Browser sign-in was also rechecked after deployment.

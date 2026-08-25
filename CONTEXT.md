# Dental ERP Domain Context

## Product

Dental ERP is a multi-clinic dental practice system designed first for Ethiopian clinics. English and Amharic are first-class languages. Tenant defaults are Ethiopia (`ET`, `ETB`, `Africa/Addis_Ababa`, `+251`) but remain configurable per clinic.

## Canonical domain language

- **Clinic**: the tenant and legal/operational boundary. Existing database code may still call this `Hospital` while the compatibility migration is active.
- **Staff member**: a clinic worker. A staff member may have an authenticated user account and one or more RBAC roles.
- **Patient record**: demographics, Ethiopian contact/address details, alerts, consent, medical and dental history, documents, and the longitudinal clinical record.
- **Appointment**: reserved chair time between a patient and dentist. Rescheduling and cancellation are events, never silent overwrites.
- **Encounter**: clinical work performed during a visit. It owns assessment, diagnoses, chart observations, procedures, notes, and follow-up.
- **Dental chart entry**: a tooth/surface observation using FDI tooth notation.
- **Treatment plan**: an approved set of planned procedures, prices, progress, and clinical ownership.
- **Invoice**: an immutable commercial claim after issue. Adjustments use discounts, payments, or credit records rather than rewriting history.
- **Payment**: money received through cash, bank, Telebirr, CBE Birr, card, or insurer. A posted payment produces a receipt.
- **Lab case**: a laboratory order for a crown, bridge, denture, aligner, appliance, or related work, including status and cost history.
- **Ledger entry**: an auditable income, expense, commission, or adjustment posting used for financial reporting.

## System invariants

1. Every business row belongs to exactly one clinic; clinic identity comes from the verified principal, never client input.
2. Authorization is permission-based at the FastAPI Interface. UI visibility is convenience, not enforcement.
3. Business identifiers are allocated atomically per clinic and document type.
4. Money uses fixed-precision decimals and the clinic currency; floats are forbidden in domain calculations.
5. Clinical, payment, and audit history is append-oriented. Corrections retain who changed what and when.
6. All stored timestamps are timezone-aware UTC; presentation uses the clinic timezone.
7. Patient phone numbers are normalized to E.164, defaulting local Ethiopian numbers to `+251`.
8. English and Amharic strings and names are Unicode-safe. Amharic uses Noto Sans Ethiopic in the frontend.

## Dependency order

Delivery follows business dependency order: shared identity/tenancy/RBAC/audit → patient record → appointment → clinical encounter/treatment → invoice/payment → lab/finance → reporting. Reporting reads from posted operational records rather than maintaining a second source of truth.

## Offline product distribution language

- **Installation**: one deployed product instance on a clinic's main Windows computer. An installation has a locally generated identity and may serve one or more clinic computers over an internet-free LAN.
- **License**: a vendor-signed, time-limited authorization for one product and one installation. It contains commercial entitlements but never patient or clinical data.
- **License decision**: the locally computed state that determines whether ordinary writes are allowed. Canonical states are active, grace, expired read-only, invalid, and recovery.
- **Activation request**: a portable file created by an installation so the online issuer can bind a license without the clinic computer being online.
- **Rehost**: an operator-approved move from a replaced or failed clinic computer to a new installation identity.

## Offline licensing invariants

1. License authenticity is verified server-side with Ed25519; UI visibility is never enforcement.
2. The issuer private key never ships in a product or offline installation.
3. A standard license has exactly five calendar days of grace after expiry.
4. Expiry never blocks authenticated viewing, audit history, license renewal, backup, or patient-data export.
5. Online activation and renewal are conveniences; the same lifecycle always works through portable files and USB.
6. TPM protection is opportunistic. Windows 10/11 without TPM remains supported with a software-protected installation identity.
7. Two computers may connect directly by Ethernet. Three or more require a switch but never require internet or a Wi-Fi router.

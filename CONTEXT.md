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

# Changelog

All notable product changes are recorded here.

## [2026-09-23] — Client requirements gap closure

Deployed commit: `f861064`

### Added

- Today’s patient queue with waiting, in-progress, upcoming, completed, and no-show states.
- Atomic **Take Patient** workflow so only one doctor can claim a checked-in patient.
- Doctor-assignment timestamp and claim-conflict responses.
- Payment provider and recorded-by attribution.
- Telebirr, bank transfer, and other-provider payment capture.
- Concurrent-payment protection against stale balances and overpayment.
- Administrator-only survey response access with clinic isolation.
- Six-month patient recalls based on latest completed treatment.
- Recall reminder dates, SMS delivery state, retry tracking, stale-claim recovery, and returned-patient status.
- Ethiopian localization migration for new and untouched legacy clinic defaults.
- Manual QA guide and recorded acceptance results.

### Changed

- Queue page now uses existing ERP shell, cards, spacing, typography, and responsive layout.
- Clinic defaults now use `en-ET`, `ET`, `ETB`, and `Africa/Addis_Ababa`.
- Billing workflows use ETB/birr, Ethiopian VAT wording, Telebirr, and mobile-money terminology.
- AI consent and patient-facing language options use English and Amharic.
- SMS settings expect Ethiopian `+251` numbers and Addis Ababa local hours.
- Legacy Indian payment/SMS providers remain labeled as legacy where compatibility is retained.
- Playwright accepts `PLAYWRIGHT_BASE_URL`, allowing tests against an existing non-default port.

### Fixed

- Payment-history columns now align payment number, date, method, provider, amount, and status correctly.
- Generic appointment updates can no longer bypass doctor claiming.
- Duplicate doctor claims return a conflict without corrupting appointment state.
- Duplicate recalls and invalid terminal recall transitions are rejected.
- Survey responses cannot leak across roles or clinics.
- Concurrent payments cannot create duplicate full-balance payments.
- Removed Hindi, Tamil, rupee symbols, Indian tax wording, and Indian SMS guidance from changed workflows.
- Removed temporary QA records and restored the test invoice balance after acceptance testing.

### Database

- Added appointment assignment metadata.
- Added payment provider and recorder attribution.
- Added patient recall scheduling and SMS tracking.
- Added Ethiopian defaults migration with safe conversion only for untouched legacy default tuples.
- Production and local databases report all 14 migrations applied.

### Validation

- Vitest: 212 files, 4,575 tests passed.
- Chromium workflow smoke: 29 tests passed.
- TypeScript, ESLint, and production build passed.
- Production clinic and control-plane readiness endpoints returned database `ok`.
- Manual localization, payment-dialog, queue, recall, and responsive checks passed.

### Follow-up

- Validate one real recall SMS through a production-capable Ethiopian provider.
- Repeat live cross-clinic isolation checks when a second production QA tenant is available.

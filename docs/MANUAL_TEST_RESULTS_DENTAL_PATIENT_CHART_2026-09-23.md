# Manual Test Results — Dental Patient Chart

**Date:** 2026-09-23
**Environment:** Local Next.js development server, MySQL development data
**Tester role:** Admin, plus receptionist authorization API check
**Patient:** Selamawit Bekele (`PAT20240001`)
**Saved chart:** `DC-2026-00001` (`cmudiedtu0007vw04i4kh8dm5`)

## Result

- 8 passed.
- 2 partially passed.
- 0 failed.

## Verified

- Existing app visual system is retained: shared dashboard shell, cards, buttons, typography, spacing, and breadcrumbs.
- Sticky safety banner showed name, MRN, age/sex, Diabetes, and Hypertension; edits updated immediately.
- Empty save showed the required chief-complaint/diagnosis error and created no record.
- Full history, vitals, examination, diagnosis, phased treatment, ETB estimate, progress, and next-visit data persisted.
- Interactive 32-tooth FDI chart saved mild occlusal caries on tooth 36 and retained it after reload.
- Radiograph workflow accepted a PNG test asset, stored its description, and displayed its protected link.
- Consent checkbox and drawn signature were captured.
- Save generated immutable chart `DC-2026-00001`; the list exposes Print but no Edit/Delete action.
- Printed A4 document contained clinic/patient identity, safety alert, every clinical section, automated S/O/A/P note, clinician, and signature. No clipping or overlap observed in the rendered page.
- Reload retained chart, odontogram entry, and radiograph.
- Receptionist create request returned `403 Forbidden`.
- Non-existent/cross-scope-style patient lookup returned `404 Patient not found`.

## Partial coverage

- Native operating-system print preview was not opened. The actual printable HTML and full-page A4 rendering were inspected instead.
- Receptionist UI view/print was not exercised. Server authorization was verified directly: GET is allowed by route policy; POST was manually confirmed as 403.

## Automated verification

- Targeted Vitest: 4 files, 61 tests passed.
- TypeScript: passed (`npx tsc --noEmit`).
- Production build: passed (`npm run build`).
- Test runner emitted one existing mocked `<option><div>` hydration warning from `clinical-components.test.tsx`; no test failed.

## Development data created

- One chart: `DC-2026-00001`.
- One active tooth-36 caries entry.
- One radiograph-workflow PNG using `public/assets/dentix-hero-ethiopia.png`, clearly described as `MANUAL TEST — radiograph upload workflow`.

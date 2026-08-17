# Design QA

**Source visual truth**

- Marketing reference: `/var/folders/tt/k23n9rms1cvfsvt57gjq0rzm0000gn/T/codex-clipboard-c5a24264-1c0e-46aa-9bc6-cd41f3b91d8d.png`
- Patient workspace reference: `/var/folders/tt/k23n9rms1cvfsvt57gjq0rzm0000gn/T/codex-clipboard-6163bb29-1929-4548-a3c4-068e58af2e8a.png`

**Implementation evidence**

- Marketing desktop: `/Users/macbook/Desktop/Nate/dental-erp/qa-landing-desktop-final.png`
- Marketing mobile: `/Users/macbook/Desktop/Nate/dental-erp/qa-landing-mobile-final.png`
- Patient desktop: `/Users/macbook/Desktop/Nate/dental-erp/qa-patient-desktop-final.png`
- Patient mobile: `/Users/macbook/Desktop/Nate/dental-erp/qa-patient-mobile-final.png`
- Side-by-side marketing comparison: `/Users/macbook/Desktop/Nate/dental-erp/qa-landing-comparison.png`
- Side-by-side patient comparison: `/Users/macbook/Desktop/Nate/dental-erp/qa-patient-comparison.png`
- Ethiopian Amharic landing typography: `/Users/macbook/Desktop/Nate/dental-erp/qa-amharic-font-landing.png`
- Ethiopian Amharic patient workspace typography: `/Users/macbook/Desktop/Nate/dental-erp/qa-amharic-font-patient.png`

**Viewport and normalization**

- Browser desktop CSS viewport: 1280 x 720 at device scale factor 1. Marketing capture: 1272 x 716 pixels; patient capture: 1280 x 720 pixels.
- Responsive browser capture: requested 390 x 844; in-app content viewport reported 445 x 1324 after browser scaling. Marketing capture: 437 x 1300 pixels; patient capture: 445 x 1324 pixels.
- Marketing source: 2048 x 1536 pixels. The source's left-page content region was cropped to 1128 x 716 and padded to 1272 x 716 before the side-by-side comparison.
- Patient source: 1504 x 1128 pixels. It was normalized to 1280 x 960 and cropped to 1280 x 720 before the side-by-side comparison.
- Browser chrome and the device frame surrounding the patient reference were excluded from fidelity judgments.

**State**

- Marketing: light theme, top of page, navigation closed for desktop; mobile navigation opened and closed during interaction testing.
- Patient: authenticated demo administrator, `/patients/demo`, upcoming appointments selected, default patient note visible.

**Full-view comparison evidence**

- Marketing retains the source composition: rounded photographic hero, floating white pill navigation, high-contrast blue CTA, oversized sans/serif headline pairing, split supporting copy, light blue canvas, and white editorial sections.
- Patient workspace retains the source composition: left navigation, slim utility header, blue-gray application canvas, patient identity/details card, appointment workspace, notes panel, and document list.
- Generated photographic assets are sharp, correctly cropped, and consistent with the clean clinical art direction.

**Focused region comparison evidence**

- Hero/navigation: inspected in `qa-landing-comparison.png`; header proportions, headline wrapping, CTA placement, overlay contrast, and image focal point are readable at comparison scale.
- Patient identity/details/notes: inspected in `qa-patient-comparison.png`; card hierarchy, two-column responsive detail grid, note editor, and blue action accents are readable at comparison scale.
- No additional focused crop was needed because the relevant typography, controls, icons, and card spacing remain legible in the normalized comparisons.

**Required fidelity surfaces**

- Fonts and typography: system sans plus Georgia italic reproduce the source's modern/editorial contrast; weights, line heights, headline wrapping, labels, and compact UI hierarchy are consistent.
- Spacing and layout rhythm: hero and workspace proportions, rounded frames, card gaps, section padding, and responsive stacking follow the references without horizontal overflow.
- Colors and visual tokens: cool white/blue-gray surfaces, saturated blue actions, restrained borders, and dark navy text match the supplied direction with accessible contrast.
- Image quality and asset fidelity: all visible photographic content uses real generated raster assets; no placeholder boxes or CSS-drawn imagery remain.
- Copy and content: dental marketing copy and realistic patient, appointment, note, and document data replace lorem ipsum while preserving the reference hierarchy.

**Interaction and browser checks**

- Marketing mobile menu opens and closes.
- Marketing anchor navigation and primary CTA targets are present and keyboard-focusable.
- Patient Upcoming, Past, and Medical records tabs switch state; the Past state renders its empty message.
- Patient note editing and Save note success state work.
- Fresh-page browser logs for both routes contain no errors.
- Responsive landing and patient views were visually captured and checked.
- English/Amharic preference switch persists across landing and authenticated workspace navigation.
- Bundled Noto Sans Ethiopic loads successfully in the browser; Amharic headings and compact UI labels were checked at desktop size with no horizontal overflow.

**Findings**

- No actionable P0, P1, or P2 differences remain.

**Comparison history**

1. Initial patient pass: P2 — the three-column details grid compressed labels and values at a 1280px desktop viewport. Fix: changed the profile/details split to 240px plus flexible content and kept details at two columns until wider screens. Post-fix evidence: `qa-patient-desktop-final.png` and `qa-patient-comparison.png` show readable fields with stable card proportions.
2. Initial marketing pass: P2 — the desktop hero height and 100px headline pushed core actions below the 720px viewport. Fix: reduced the desktop hero to 680–700px and headline to 76–84px. Post-fix evidence: `qa-landing-desktop-final.png` and `qa-landing-comparison.png` show the full primary composition and both CTAs above the fold.
3. Initial asset pass: P2 — testimonial avatars were represented by generic circles. Fix: replaced them with real cropped team photography and replaced the text-only emblem with an icon-library mark. Post-fix evidence: `qa-landing-desktop-final.png` and `qa-landing-mobile-final.png`.
4. Ethiopian localization pass: P2 — Amharic inherited an inconsistent system fallback, italic display styling, tight letter spacing, and an SSR/local-storage hydration mismatch. Fix: bundled Noto Sans Ethiopic in four weights, removed italics/uppercase tracking for Amharic, increased small-label line height, normalized display typography, and restored persisted locale only after hydration. Post-fix evidence: `qa-amharic-font-landing.png` and `qa-amharic-font-patient.png`; browser console has no errors.

**Follow-up polish**

- P3: a future branded logo asset could replace the current icon-library mark if Dentix brand files become available.

**Implementation checklist**

- [x] Desktop and responsive captures reviewed.
- [x] Primary interactions verified.
- [x] Browser console errors checked.
- [x] Production build compiled successfully.
- [x] P0/P1/P2 visual findings resolved.

final result: passed

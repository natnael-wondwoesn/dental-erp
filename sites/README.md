# Landing sites

Each folder under `sites/` is one client's landing-page-only website, built to plain
static files with `node sites/<name>/build.mjs` (output in `dist/`, not committed).

## House rules for every site

- **Fonts:** Inter is the primary font (body text) and Poppins is the secondary font
  (headings, buttons, the brand name). Both are self-hosted from `_shared/`:
  `_shared/fonts.css` and `_shared/fonts/`. Copy them into the site's `assets/` at build
  time (see `dalian-dental/build.mjs`) and use `var(--font-primary)` and
  `var(--font-secondary)`. Do not load fonts from a third-party CDN.
- **Content:** all text lives in the site's `content.json`. Empty values are details the
  client has not given us yet; the page hides them instead of showing made-up values.
- **Paused page:** `_paused/index.html` is shown, with HTTP 503, when the control site
  pauses a site for non-payment.
- **Publishing:** the `Deploy landing site` workflow. See `ops/landing/README.md`.

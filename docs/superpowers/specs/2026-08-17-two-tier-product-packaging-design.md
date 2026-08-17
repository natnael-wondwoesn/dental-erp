# Two-Tier Product Packaging — Design

Date: 2026-08-17
Status: Approved for planning

## Problem

The product must be sellable in two forms from one codebase:

1. **Landing tier** — a public clinic website only: home, about us, contact us, clinic
   location. Delivered to clients who want a web presence and nothing more. The ERP must
   not be usable.
2. **Full tier** — the same public website plus the complete ERP (and, later, a CMS).

Today there is one deployable. `app/page.tsx` is a single 283-line marketing page with
hardcoded copy, and the ERP sits alongside it under `app/(dashboard)`, `app/(auth)`,
`app/portal`, `app/pay`, and 46 API route domains under `app/api`. There is no way to hand
a client the website without also handing them a working ERP.

## Decisions

| Question                      | Decision                                                           | Consequence                                                                                 |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| How are tiers separated?      | Runtime env var on one shared image                                | Fast to build and maintain; ERP source is present but unusable on a landing client's server |
| Who edits landing content?    | The vendor, via a committed per-client config file                 | Landing tier needs no database, no auth, no admin UI                                        |
| What happens on "contact us"? | Direct contact links only — phone, Telegram, WhatsApp, map, mailto | Landing tier is a pure static site: no API, no email, no spam handling                      |

### Accepted trade-off: source code presence

The landing artifact contains ERP source that is unreachable at runtime. This protects the
_product_ (a landing client cannot operate the ERP) but not the _code_ (a client with
server or image access could unpack it). This was accepted deliberately in favour of
delivery speed. The routing and configuration work below is unchanged if a build-time
split becomes necessary later; only the packaging step would be added.

## Out of scope — the CMS gets its own spec

Letting clinics edit their own site content is an independent subsystem and is **not**
covered here. This spec's config loader is deliberately written behind a single
`loadSiteConfig()` boundary so the CMS can later swap the JSON source for Postgres without
touching any page or component.

## Architecture

### 1. Tier resolution — `lib/product-tier.ts`

```ts
export type ProductTier = 'landing' | 'full'
export function getProductTier(): ProductTier
export function isFullSuite(): boolean
```

Reads `process.env.PRODUCT_TIER`. **Defaults to `'full'`** so every existing test, dev
command, and deployment keeps working with no change. An unrecognised value is a startup
error, not a silent fallback — a typo must not silently ship an ERP to a landing client.

**`NEXT_PUBLIC_PRODUCT_TIER` must not be used.** `NEXT_PUBLIC_*` values are inlined into
the client bundle at `next build`, which would freeze the tier at build time and defeat
the one-image goal. The tier is read server-side only.

### 2. Enforcement

Two gates, only one of which is load-bearing.

**Hard gate — `middleware.ts` (new file).** When the tier is `landing`, every request
outside a public allowlist returns **404**. This covers all of `/api/*`, `/dashboard`,
`/login`, `/portal`, and `/pay`. 404 rather than 403 or a redirect, so that probing the
server does not confirm the ERP exists.

Middleware is the only maintainable option: gating 46 API route domains individually is
not sustainable, and route groups are a compile-time organisation tool with no runtime
access semantics.

This is a new middleware with one narrow responsibility: tier gating. It does **not**
reintroduce the auth middleware that was deliberately removed — authentication and RBAC
stay in FastAPI, per `docs/adr/0001-python-postgres-erp-boundaries.md`.

**Soft gate — navigation.** `config/nav.ts` and the site header omit ERP entry points in
landing tier. This is presentation only; the middleware is what enforces.

### 3. Site route group

```
app/(site)/
  layout.tsx          server component: reads tier + config, renders header/footer
  page.tsx            home            (moved from app/page.tsx)
  about/page.tsx      about us
  contact/page.tsx    contact, location, map, opening hours
```

Route-group parentheses mean URLs are unchanged: `/` stays `/`.

**Server/client boundary.** `app/(site)/layout.tsx` is the only server component in the
group. It calls `getProductTier()` and `loadSiteConfig()` and passes both into a client
context provider (`components/site/site-provider.tsx`). Pages and sections remain client
components so they keep using the existing `useLanguage()` hook from `lib/i18n.tsx`, which
is a client context and drives the instant language switch already in place.

Today's `app/page.tsx` is decomposed. The layout renders `<SiteHeader/>` and `<SiteFooter/>`
— both client components, since the header owns the language switcher and the mobile-menu
toggle. The hero, services, metrics, and doctors sections become client components under
`components/site/`. The layout itself stays server-only: it fetches, it does not render
interactive chrome directly.

### 4. Per-client site config

Location: `config/sites/<SITE_ID>.json`, selected by the `SITE_ID` env var, defaulting to
`config/sites/default.json` (a demo clinic used in development and tests). An optional
`SITE_CONFIG_PATH` overrides the lookup with an absolute path, so a client can mount an
edited file without a rebuild.

Validated with **zod** (already a dependency) inside `loadSiteConfig()`. Validation failure
is a startup error with the failing field path — a malformed config must never render a
half-empty page to patients.

Bilingual content uses `{ en, am }` field pairs, **not** `t()` lookups. The existing
`lib/i18n.tsx` dictionary is keyed by English source string and is correct for shared UI
chrome, but a clinic's own name, doctor bios, and service descriptions are per-client data
that cannot live in a shared catalog.

Shape:

```ts
interface SiteConfig {
  clinic: { name: Localized; tagline: Localized; logo?: string }
  location: { region; city; subCity; woreda; kebele?; landmark?; mapEmbedUrl }
  contact: { phones: string[]; telegram?; whatsapp?; email }
  hours: { day: string; open: string; close: string }[]
  services: { title: Localized; copy: Localized; icon?: string }[]
  doctors: { name: string; credentials: Localized; bio: Localized; photo?: string }[]
  about: { story: Localized; metrics: { value: string; label: Localized }[] }
  social?: { facebook?; instagram?; tiktok?; youtube? }
}
type Localized = { en: string; am: string }
```

Ethiopian address fields (region / city / sub-city / woreda / kebele / landmark) follow the
patient address model already established in `CONTEXT.md`.

### 5. Full-tier additions

The full tier renders the same site from the same config, plus three conditionals:

- "Open workspace" → `/login` in the header
- "Book online" → `/portal/book` in the contact section (the patient portal already
  exists, so this is a near-zero-cost upgrade signal)
- Later: the CMS replaces the JSON config as the content source

### 6. Delivery artifacts

- `docker-compose.landing.yml` — **app container only**. No Postgres, no Redis, no FastAPI
  backend. `PRODUCT_TIER=landing`, `SITE_ID=<client>`.
- `.env.landing.example`
- `docs/DELIVERY.md` — the two handoff procedures, and the landing → full upgrade path
- Existing `docker-compose.yml` and `docker-compose.dev.yml` set `PRODUCT_TIER=full`
  explicitly rather than relying on the default

## Error handling

| Failure                             | Behaviour                                            |
| ----------------------------------- | ---------------------------------------------------- |
| `PRODUCT_TIER` unset                | Default to `full`                                    |
| `PRODUCT_TIER` unrecognised         | Throw at startup, naming the value and valid options |
| `SITE_ID` config file missing       | Throw at startup, naming the resolved path           |
| Config fails zod validation         | Throw at startup, naming the failing field path      |
| ERP route requested in landing tier | 404, no logging of the path as an error              |

## Testing

- `tests/unit/product-tier.test.ts` — resolution, default-to-full, unrecognised value throws
- `tests/unit/site-config.test.ts` — zod validation, missing file, `SITE_CONFIG_PATH`
  override, bilingual field shape
- `tests/api/tier-gating.test.ts` — landing tier 404s ERP pages and `/api/*`; full tier
  passes both; allowlisted paths pass in both
- `tests/smoke/` — site pages render in both tiers; full tier shows the workspace and
  booking links, landing tier does not

Existing suites must stay green unchanged, which the `full` default guarantees.

## Open item for implementation

The middleware allowlist is a security-vs-usability judgement to be made during
implementation, not assumed here. Specifically: whether `/api/health` stays reachable for
uptime monitoring at the cost of confirming an API layer exists, and whether
`/robots.txt` and `/sitemap.xml` pass through for SEO. `middleware.ts` will be scaffolded
with the tier check and matcher in place and the allowlist policy left explicit.

# Delivery Guide

DentalERP ships as **one Docker image**. Which product a client gets — a
clinic website, or the full dental ERP — is chosen entirely by a runtime
environment variable, `PRODUCT_TIER`. There is no separate build for either
tier.

- `PRODUCT_TIER=landing` — a public clinic website only. No database, no
  cache, no FastAPI backend, no authenticated area. Enforced by
  `middleware.ts`, which 404s everything not on an explicit allowlist.
- `PRODUCT_TIER=full` (the default when unset) — the website plus the entire
  ERP: patients, scheduling, billing, staff, and so on.

This document covers onboarding a client, handing off each tier, upgrading a
landing client to full, and one caveat about what "landing-only" actually
means on disk.

## 1. Onboarding a client

Every deployment — landing or full — renders its public site from a
per-client JSON config at `config/sites/<SITE_ID>.json`. Onboarding a new
client means creating that file.

```bash
cp config/sites/default.json config/sites/<client-slug>.json
```

Edit `config/sites/<client-slug>.json` and fill in **both halves of every
localized field** — each field is `{ "en": "...", "am": "..." }`, and leaving
one language blank means that language falls back to nothing on the live
site, not to the other language. Fill in:

- `clinic.name`, `clinic.tagline`
- `location` — region, city, subCity, woreda, landmark, and `mapEmbedUrl`
- `contact` — phones, telegram, whatsapp, email
- `hours` — per-day open/close, both language labels
- `services`, `doctors` — title/copy or bio in both languages

**Getting the Google Maps embed URL:** open Google Maps, search the clinic's
address, click Share → Embed a map → Copy HTML, and take the `src="..."`
value out of the returned `<iframe>` tag. That is the `mapEmbedUrl`.

**Validate the config** before deploying it:

```bash
SITE_ID=<client-slug> npx vitest run tests/unit/site-config.test.ts
```

This runs the config through the same zod schema the app validates against
at startup, so a malformed or incomplete file is caught here rather than as a
startup crash on the client's server.

## 2. Landing handoff

One container. No database, no backend, no CMS — content changes require
editing the JSON config and redeploying.

```bash
cp .env.landing.example .env
# edit .env: set SITE_ID to the client's slug, and SITE_URL to the site's
# real public URL (see the SITE_URL note below)
docker compose -f docker-compose.landing.yml up -d
```

That's the whole deployment. `docker-compose.landing.yml` builds a single
`app` service with `PRODUCT_TIER=landing` baked into its environment — there
is no way to accidentally start a database or backend alongside it, because
the compose file doesn't declare any.

Set `SITE_URL` to the site's real domain (e.g. `https://www.dentix.et`).
Leaving it unset publishes `http://localhost:3000` URLs in `sitemap.xml` and
`robots.txt` — harmless in local development, wrong once the site is live.

## 3. Full-suite handoff

The existing production procedure, with `PRODUCT_TIER=full` (the default,
but set it explicitly so the deployment states its own tier):

```bash
cp .env.example .env
# fill in database credentials, secrets, PRODUCT_TIER=full, SITE_ID, SITE_URL
docker compose up -d
```

See `docker-compose.yml` for the full stack (MySQL, the one-shot Prisma
migration job, the app) and `SELF_HOSTING.md` for TLS, backups, and the
reverse-proxy setup.

## 4. Upgrade path: landing → full

A landing client's site content keeps rendering from the same JSON config
throughout this upgrade — there is no content migration step, because the
site was never backed by a database to begin with.

1. Switch `PRODUCT_TIER` from `landing` to `full` in the client's `.env`.
2. Bring up the database and the FastAPI backend alongside the app (see
   `docker-compose.yml` / `docker-compose.dev.yml` for the service shapes —
   MySQL/Postgres, `migrate`/`backend-migrate`, `backend`).
3. Run migrations: `prisma migrate deploy` for the Next.js side,
   `alembic upgrade head` for the FastAPI backend.
4. Seed the clinic (staff accounts, initial data) per the existing seed
   procedure.
5. Redeploy with `docker-compose.yml` instead of `docker-compose.landing.yml`.

The site content keeps rendering from the same `config/sites/<SITE_ID>.json`
until the CMS ships — upgrading to `full` does not require re-entering the
clinic's public-facing content.

## 5. The source-presence caveat

A landing client's server holds ERP source that is unreachable but not
absent.

`PRODUCT_TIER=landing` is a runtime gate, not a build-time exclusion — the
same image is deployed either way, and the ERP's code, routes, and
dependencies are physically present in the container's filesystem whether or
not `middleware.ts` will ever route a request to them. The gate is
enforcement, not deletion. This is a deliberate tradeoff (one image, one
build pipeline, one thing to patch) and it means "landing-only" describes
what the deployment serves, not what the deployment contains.

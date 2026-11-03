# AGENTS.md — build, ship and run the whole clinic ERP ecosystem

Read this first. It tells any agent (or person) how to change **any** part of the
system, deploy it safely, and add a brand-new clinic. It is written in plain
language on purpose: if you run out of tokens halfway, a human can pick up
exactly where you stopped.

Last verified against the repo and live DNS on 2026-11-03 (release v0.1.24 was the
latest tag). Items I could not verify from the repo are marked **[VERIFY]** and
collected in section 9.

---

## 0. The 60-second version

- **One codebase, one image.** Every clinic site _and_ the control site run the
  same Docker image `ghcr.io/natnael-wondwoesn/dental-erp:<version>`. Clinics
  differ only by their own `.env`, database, config file and the modules switched
  on in the control site. The control site also has a separate Python backend
  image `ghcr.io/natnael-wondwoesn/dental-erp-backend:<version>`.
- **Pushing a branch or merging to `main` never deploys.** Only pushing a version
  tag (`vX.Y.Z`) deploys, and it deploys to **every site, in order**:
  control backend → control web → Abiy (`lemlem`) → Berhanu (`berhanu-dental`).
- **Normal change:** branch → PR → CI green → merge → tag → watch rollout → check
  the site(s). Section 4 (change) and section 5 (ship).
- **New clinic:** section 7. It touches the code (a site config file), the control
  site (customer, installation, registration, modules) and the VPS (a few
  root-only files). Follow it in order.
- **When something breaks:** section 8. Every site rolls itself back automatically
  if its health check fails, and a database backup is taken before every deploy.

---

## 1. The map

### 1.1 The sites

| Site                  | Public URL                                    | Fleet name       | Where it lives on the VPS                                                   | Stack layout |
| --------------------- | --------------------------------------------- | ---------------- | --------------------------------------------------------------------------- | ------------ |
| Control site (vendor) | `https://control.clinic-cms.cc`               | `control`        | web `/opt/product-control`, backend `/opt/dental-saas`                      | legacy       |
| D/R Abiy clinic       | `https://lemlem.dental.clinic-cms.cc`         | `lemlem`         | `/opt/dental-erp` (the folder/name still says "lemlem"; the clinic is Abiy) | legacy       |
| Dr Berhanu Belta      | `https://drberhanubelta.dental.clinic-cms.cc` | `berhanu-dental` | `/opt/clients/berhanu-dental`                                               | standard     |

- The VPS is `185.190.142.27`. DNS is on Cloudflare and points straight at it
  (grey-cloud / DNS-only; the records resolve to the VPS IP, not to Cloudflare).
- The real domain is **`clinic-cms.cc`** (not `.com`). A clinic hostname is
  `<name>.dental.clinic-cms.cc`. `*.dental.clinic-cms.cc` is a **wildcard** that
  already points at the VPS (checked: a made-up name resolves to the VPS IP), so a
  new clinic hostname needs **no DNS change**. Plain `x.clinic-cms.cc` is _not_
  wildcarded; each of those needs its own DNS record.
- One reverse proxy (`kora-caddy-1`, Caddy) is the only thing on ports 80/443. It
  gets TLS certificates automatically. Per-clinic proxy snippets live in
  `/opt/kora/sites/<slug>.caddy`.

### 1.2 The two stack layouts (this matters for deploys)

- **Standard** (Berhanu and every new clinic): a folder `/opt/clients/<name>/`
  with `compose.yml` and `.env`. Services are `mysql`, `migrate`, `app`. The `.env`
  holds `APP_IMAGE` and `HOSTNAME`. `deploy.sh` just rewrites `APP_IMAGE`. Compose project is
  `client-<name>`; containers are `client-<name>-app-1` and
  `client-<name>-mysql-1`.
- **Legacy** (control and Abiy): described by `ops/deploy/clients/<name>.conf` in
  the repo. `deploy.sh` injects the image through an overlay file
  (`.deploy-image.yml`) so the old compose files keep working. Do not convert
  these; just leave them alone.

### 1.3 Where the code for each thing lives

| You want to change…                                      | Look here                                                                                                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anything a clinic user sees (patients, billing, lab, …)  | `app/(dashboard)/…`, `app/api/…`, `components/…`, `lib/…`, database in `prisma/schema.prisma` + `prisma/migrations/`                                  |
| A clinic's public landing page text, services, phones    | `config/sites/<site>.json` (validated by `lib/site-config.shared.ts`), images in `public/assets/`                                                     |
| Printable forms (consent, lab order, notices, …)         | `lib/clinical-forms/clinic-printables.ts`, forms page `app/(dashboard)/forms/page.tsx`                                                                |
| **Control site pages** (clinics, fleet, releases, audit) | `app/(dashboard)/owner/**`, `components/saas/**`, `components/platform/**`, `lib/saas/admin.ts`                                                       |
| **Control site backend** (subscriptions, modules, audit) | `backend/app/saas/router.py`, `models.py`, migrations in `backend/alembic/versions/` (latest is `0009`)                                               |
| Module list (what can be switched on per clinic)         | `config/saas-modules.json` (21 modules, includes `braces`)                                                                                            |
| Deploy scripts, fleet list, per-stack settings           | `ops/deploy/` (`deploy.sh`, `deploy-backend.sh`, `record.sh`, `fleet.json`, `clients/*.conf`)                                                         |
| Workflows                                                | `.github/workflows/` — `ci.yml`, `release.yml` (tag → build → auto rollout), `deploy-fleet.yml`, `deploy-client.yml`                                  |
| Host worker that provisions clinics (runs on the VPS)    | `ops/platform-worker/` (`platform_worker.py`, `templates/dental-erp.compose.yml`, `owner_operations.py`)                                              |
| Existing deployment docs (shorter, older than this file) | `docs/DEPLOYMENT.md`, `docs/OWNER_CONSOLE.md`, `docs/PRODUCT_PLATFORM_OPERATIONS.md`, `docs/SAAS_OPERATIONS.md`, `docs/clients/BERHANU_ONBOARDING.md` |

---

## 2. Golden rules

1. **Never edit code on the VPS and never deploy a working tree.** Production runs
   tagged images only.
2. **One image for all sites ⇒ every change must be safe for every clinic.** If a
   change is for one clinic only, gate it so it is invisible elsewhere: a
   `config/sites/<site>.json` value, a control-site module/client option, or a
   clinic-name check (the Berhanu printables do this with `/berhanu\s+belta/`).
   "Fix Berhanu's page" must not alter Abiy's page.
3. **Migrations must be additive** (add columns/tables; never drop or rename in the
   same release that stops using them). The database is **not** rolled back when a
   deploy rolls back, so the previous version must still work against the new
   schema. Also don't write data migrations that touch "all clinics" unless you
   mean to — they run on every site.
4. **The control backend must stay backward compatible.** It rolls out before the
   web apps and before the clinics, and running clinics keep calling its reader
   endpoints (`/catalog`, `/access/{tenant}`, `/eligible`, `/branding`) during the
   rollout. Add fields; don't remove or rename them.
5. **Tag = deploy to everyone.** Treat `git push origin vX.Y.Z` as pressing the
   production button. Only do it when the user has asked you to ship/deploy.
6. **Git rules from the user (global, always apply):**
   - Never `git push` (branches, tags, force, anything) unless the user explicitly
     asked in this conversation. "Deploy / ship / push it" counts as that ask.
   - Never add yourself as co-author or mention Claude/Anthropic anywhere in
     commits, tags, PRs or authors.
7. **Never print, log, commit or paste secrets** (`.env` values, tokens, DB
   passwords, temporary clinic passwords). Refer to them by name only.
8. **Look before you overwrite** anything on the VPS: `cp -p file file.bak-$(date +%s)` first.
9. **Don't invent business facts** for a new clinic (price, TIN, address, phone,
   Amharic spelling). Ask the user, or leave it blank and say so.
10. **Verify, don't assume.** After a deploy, hit `/api/ready` and open the page.
    Say plainly what you checked and what you could not.

---

## 3. Working in parallel (several agents at once)

Several agents can work at the same time without colliding if each follows this.

- **Isolate:** each agent works in its own branch cut from fresh `origin/main`,
  ideally its own git worktree (`git worktree add ../wt-<task> -b <type>/<task> origin/main`).
  Never work directly on `main`, and never reuse another agent's branch.
- **Branch names:** `feat/…`, `fix/…`, `docs/…`, `chore/…`. One topic per branch.
- **Stay in your lane.** Touch only the files your task needs. Don't reformat
  unrelated files (CI runs `prettier --check .`; the commit hook formats staged
  files for you).
- **Know the shared hot-spots** where two agents most often collide, and rebase
  before opening the PR if `origin/main` moved:
  - `backend/alembic/versions/` — two new `0010_*.py` files = two Alembic heads =
    broken backend. Run `cd backend && uv run alembic heads`; there must be exactly
    one. If you collide, renumber yours on top of the other.
  - `prisma/migrations/` — timestamps differ so it rarely conflicts, but make sure
    yours sorts after the newest existing folder.
  - `ops/deploy/fleet.json`, `config/saas-modules.json`, `messages/*.json`,
    `lib/clinical-forms/clinic-printables.ts`.
- **Each agent opens its own PR** and gets its own CI green. Merging is cheap and
  safe; **tagging is the shared step.**
- **Tagging protocol (so two agents don't ship over each other):**
  1. `git fetch origin --tags` then `git tag --sort=-v:refname | head -3` for the latest.
  2. `gh run list --workflow=release.yml --limit 3` — if a release is still running,
     **wait** for it to finish. Never start a second tag while one is rolling out.
  3. `git log <latest-tag>..origin/main --oneline` — this is exactly what the next
     tag will ship, including other agents' merged work. If something in there is
     not ready, do not tag; tell the user.
  4. Tag the tip of `origin/main` (not your local branch): see section 5.
  5. If the tag name is already taken, you lost the race: re-fetch and use the next number.
  6. A tag whose release failed is burnt. Fix forward and tag the next patch number.
- Only one rollout runs at a time anyway (`concurrency: production-vps`), but
  stacking tags makes history confusing, so follow the protocol.

---

## 4. Playbook A — make a change (any site, any part)

1. **Start clean:** `git fetch origin && git switch -c <type>/<task> origin/main`
   (or a worktree, section 3).
2. **Find the right place** with the table in 1.3. Read the neighbouring code and
   match its style, naming and comment level.
3. **Decide the blast radius** (rule 2): all clinics, one clinic, or control only.
   Clinic-only ⇒ gate it. Control-only ⇒ it lives under `owner/`, `components/saas/`,
   `lib/saas/` or `backend/`.
4. **Write or update tests next to the change** (`tests/unit/…`, `backend/tests/…`).
5. **Run exactly what CI runs** (a PR cannot merge otherwise):

   ```bash
   npx tsc --noEmit
   npx eslint .
   npx prettier --check .
   npx vitest run                  # or: npx vitest run tests/unit/<file>.test.ts
   npm run build                   # production build; slow, run before opening the PR
   # only if you touched backend/:
   cd backend && uv sync --frozen && uv run pytest -q && uv run alembic upgrade head && uv run alembic heads
   ```

6. **Commit** with a conventional message (`feat(scope): …`, `fix(scope): …`).
   The pre-commit hook runs `tsc`, `eslint --fix` and `prettier` on staged files
   (takes a minute). Do not use `--no-verify`.
7. **Open a PR to `main`** (only push if the user asked; see rule 6). Wait for the
   four checks: Lint & Type Check, Unit & Integration Tests, Production Build,
   Backend policy/licensing/migrations. Look at them with `gh pr checks <n>`.
8. **Stop here** unless the user asked you to deploy. Say: "PR is green and ready;
   say the word and I'll merge, tag and deploy."

### Special cases

- **A control-site feature** (e.g. a new page in the owner console):
  - UI in `app/(dashboard)/owner/…` and `components/saas/…`; data through
    `lib/saas/admin.ts` (`ownerFetch`) which calls the backend via the proxy
    `app/api/saas-admin/[...path]/route.ts`.
  - New data ⇒ new FastAPI endpoint in `backend/app/saas/router.py` + model +
    Alembic migration (additive!). Add a test in `backend/tests/test_saas_control.py`.
  - The control web app is the _same image_ as the clinics, run in control-plane
    mode (`PLATFORM_CONTROL_PLANE_MODE=true`, see `lib/platform-mode.ts`); clinic
    routes return 404 there. A control feature therefore ships in the normal
    release, and its backend ships in the `-backend` image of the same tag.
- **A clinic-specific change** (e.g. something only for Berhanu): put the data in
  `config/sites/berhanu-dental.json`, or gate by clinic/module as in rule 2. The
  release will still be deployed to all sites, so prove it is invisible elsewhere
  (a test with a different clinic name is ideal — see
  `tests/unit/clinical-document-renderers.test.ts`).
- **A new module or switch for clinics:** add it to `config/saas-modules.json`, gate
  the feature on it, and tell the user to tick it per clinic (section 6.3).
- **A database change (clinic app):** edit `prisma/schema.prisma` and add a folder
  in `prisma/migrations/<timestamp>_<name>/migration.sql`. It runs automatically on
  every site during deploy through the `migrate` service.

---

## 5. Playbook B — ship it (merge → tag → rollout → verify)

Do this only when the user asked you to deploy.

1. **All checks green** on every PR going out: `gh pr checks <n>`.
2. **Merge:** `gh pr merge <n> --squash --delete-branch`. Repeat for each ready PR.
3. **Tag the tip of `origin/main`** (follow the protocol in section 3 first):

   ```bash
   git fetch origin --tags
   git tag -a vX.Y.Z -m "vX.Y.Z" origin/main
   git push origin vX.Y.Z
   ```

   Pick the next patch number (v0.1.24 → v0.1.25). Use a minor bump for a large
   feature. No `-rc` tags unless the user wants a pre-release.

4. **What happens automatically** (no further action needed):
   1. `Release` workflow re-runs CI, builds the app image (amd64+arm64) and the
      backend image, publishes both to GHCR, builds the Windows/offline bundle.
      Observed time: about 10–15 minutes.
   2. `Deploy fleet` workflow then SSHes to the VPS and, for each site in
      `ops/deploy/fleet.json` in order, runs `deploy.sh` (control also runs
      `deploy-backend.sh` first): pull image → **database backup** → switch image →
      migrations → wait for health → check `https://<host>/api/ready`.
   3. If any site fails its health check it **restores its previous image** and the
      run **stops**, so later sites keep what they had.
   4. Each result is recorded on the control site under **Releases**.
5. **Watch it** (don't poll in a tight loop):

   ```bash
   gh run list --workflow=release.yml --limit 1       # find the run id
   gh run watch <run-id> --exit-status                # blocks until done
   ```

   Then find the `Deploy fleet` run it triggered (`gh run list --workflow=deploy-fleet.yml --limit 1`)
   and check `gh run view <id> --json conclusion -q .conclusion` is `success`.

6. **Verify each site you changed** (and always the control site):

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://control.clinic-cms.cc/api/ready
   curl -s -o /dev/null -w "%{http_code}\n" https://lemlem.dental.clinic-cms.cc/api/ready
   curl -s -o /dev/null -w "%{http_code}\n" https://drberhanubelta.dental.clinic-cms.cc/api/ready
   ```

   All must print `200`. Then actually open the page you changed (login-protected
   pages: ask the user to look, or say you could not check them). Also check
   `https://control.clinic-cms.cc/owner/releases` shows the new version.

7. **Report:** tag, what shipped, which sites are on it, what you verified and what
   you could not.

**Redeploy or deploy only some sites** (no new tag), e.g. after a failure:
Actions → **Deploy fleet** → Run workflow, version `0.1.25`, optional `clients`
(`control berhanu-dental`). From a terminal:

```bash
gh workflow run deploy-fleet.yml -f version=0.1.25 -f clients="berhanu-dental"
```

**One site that is not in `fleet.json` yet** (a brand-new clinic) uses the older
single-site workflow instead: `gh workflow run deploy-client.yml -f client=<name> -f version=0.1.25`.

---

## 6. Day-to-day control of a clinic (control site)

Log in at `https://control.clinic-cms.cc/login` with the platform-owner account
(clinic admins cannot see any of this). Pages:

| Page              | What it does                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/owner`          | Customers, installations (one per clinic stack), operation queue (Provision / Deploy / Restart / Backup), health                |
| `/owner/clinics`  | Register a clinic, modules, branding, payments/renewal, suspend/restore, license, **profile and private notes**                 |
| `/owner/access`   | Per clinic: database status/stop/start, list users, create admin/staff, change role, activate/deactivate, seed/remove demo data |
| `/owner/fleet`    | Clinic counts, monthly revenue, renewals due, **module matrix with bulk add/remove**, CSV                                       |
| `/owner/releases` | Version on each site and every rollout's result with a link to its run                                                          |
| `/owner/audit`    | Fleet-wide audit log (subscription, module, branding, profile, payment)                                                         |

### 6.1 Cautions about the control site's own Deploy buttons

The host worker's `DEPLOY` job (from `/owner`, including toggling the handwriting
entitlement) rewrites the clinic's compose file and **sets `APP_IMAGE` to the
release stored on that installation**, which is the version chosen at provisioning
time, not the fleet version. **[VERIFY live — read from `platform_worker.py`, not
tested]** So after using any `/owner` Deploy/feature toggle on a fleet site, check
the site's version on `/owner/releases` and, if it went backwards, run Deploy fleet
for that site again (section 5).

### 6.2 Everything a clinic user can't do, you can

Suspend/restore writes, change modules immediately or at period end, record a
payment (verify the bank/Telebirr receipt first; same reference cannot extend
twice), upload branding, create an administrator (a temporary password is shown
once; hand it over privately, it is not emailed), stop/start only that clinic's
database (type the exact hostname to confirm). Details: `docs/OWNER_CONSOLE.md`.

### 6.3 Turning on a module for a clinic

`/owner/clinics` → select the clinic → modules (tick dependencies too) → choose
immediate or end-of-period → save. To change many clinics at once use the module
matrix on `/owner/fleet`. A release that adds a module does nothing for a clinic
until someone ticks it.

---

## 7. Playbook C — create a brand-new clinic ("new-clinic")

Goal: a new clinic with everything Berhanu has, live at
`https://new-clinic.dental.clinic-cms.cc`, controllable from the control site.
Replace `new-clinic` with the real slug throughout. Slug rules: lowercase letters,
digits and single hyphens, max 63 characters.

**What "everything Berhanu has" means:** the same app, the same 21 modules (tick
all; includes `braces`), its own landing-page config, its own database, uploads,
secrets and hostname. **Not** copied automatically: Berhanu's clinic-specific
extras: the two Amharic patient notices (`berhanu-*` printables, visible only when
the clinic name matches Berhanu), Berhanu's procedure price list
(`ops/platform-worker/import_berhanu_procedures.cjs`, prices are Berhanu's) and
Berhanu's cash-sales TIN. If the user wants any of those for the new clinic, make
a separate PR that generalises them (e.g. gate on a client option instead of the
clinic name).

### 7.0 Collect the inputs (ask the user for what is missing)

- Clinic name in English and Amharic; slug; hostname (default
  `<slug>.dental.clinic-cms.cc`).
- Customer: name, contact name/email/phone.
- Landing page content: tagline, address (region/city/sub-city/landmark), phones,
  WhatsApp/email, opening hours, services, doctors, "about", map link, logo/hero image.
- Commercial: access term (Berhanu got a 30-day evaluation), monthly fee (0 until
  agreed), plan name.
- Never invent prices, TIN, registration numbers, addresses or phone numbers.

### 7.1 Code PR #1 — the clinic's site config (lands first)

1. Branch from `origin/main`.
2. Copy `config/sites/berhanu-dental.json` to `config/sites/<slug>.json` and replace
   every clinic-specific value. It is validated by `siteConfigSchema`
   (`lib/site-config.shared.ts`); keep both `en` and `am` strings.
3. Put images in `public/assets/` (referenced as `/assets/<file>`).
4. Run `npx vitest run tests/unit/site-config.test.ts` and the full checks (section 4).
5. PR → green → merge → **tag a release** (section 5). This puts the new JSON into the
   image. The config must exist in a released image _before_ the clinic points at it
   (a `SITE_ID` with no file makes the app error).
6. **Do not add the clinic to `ops/deploy/fleet.json` yet.** `deploy.sh` stops with
   "no stack directory" for a clinic that doesn't exist, which would halt every
   later site in the rollout. It goes in PR #2 (7.8).

### 7.2 Make sure the release is "approved" for provisioning (VPS, root)

The provisioning worker only deploys releases listed in
`/etc/sunny-smile/approved-releases.json` (root-owned). If the version you just
tagged is missing, the Provision job fails with _"Release has not been approved by
the vendor"_. Add it (back the file up first, keep its permissions):

```bash
# get the immutable digest of the published release (run anywhere with docker + GHCR access)
docker buildx imagetools inspect ghcr.io/natnael-wondwoesn/dental-erp:0.1.25 | grep -m1 Digest
# on the VPS, add: "0.1.25": { "frontendImage": "ghcr.io/natnael-wondwoesn/dental-erp@sha256:<digest>" }
```

Edit with a JSON-aware tool (e.g. `python3`) rather than by hand, then confirm
`python3 -m json.tool /etc/sunny-smile/approved-releases.json` still parses. Do not
print other entries' contents unnecessarily.

### 7.3 Create the customer and installation on the control site

1. `https://control.clinic-cms.cc/owner` → create **Customer** (name, slug, contact).
2. Create **Installation**: product _Dental ERP_, name, **slug**, **hostname**
   (`<slug>.dental.clinic-cms.cc`), **version** = the approved release from 7.2.
3. Saving queues a **PROVISION** job. The root worker on the VPS then:
   creates `/opt/clients/<slug>/` (marker file, `compose.yml`, `.env` with fresh
   random secrets), pulls images, starts MySQL → migrations → app, writes
   `/opt/kora/sites/<slug>.caddy` and reloads Caddy (TLS certificate is issued
   automatically).
4. Wait for the operation to show **SUCCEEDED** on `/owner` (a few minutes).
   If **FAILED**, read the error on that page; common causes are an unapproved
   release (7.2), a bad hostname, or Caddy validation (section 8).
5. Note the **installation ID** and **customer ID** shown on `/owner`; you need both.

### 7.4 Point the clinic at its own site config (VPS)

The worker writes `SITE_ID=default`. Change it to the new config:

```bash
ssh <vps>   # see section 9 for how agents reach the VPS
cd /opt/clients/<slug>
cp -p .env .env.bak-$(date +%s)
sed -i 's/^SITE_ID=.*/SITE_ID=<slug>/' .env
docker compose up -d --wait app
curl -s -o /dev/null -w "%{http_code}\n" https://<hostname>/api/ready   # expect 200
```

Open `https://<hostname>/` and confirm the landing page shows the **new clinic's**
name (not Abiy's).

### 7.5 Create the first administrator and read the clinic ID

1. Open `https://<hostname>/signup` and create the clinic administrator. Use a
   strong random password, give it to the user privately, never write it into the
   repo, a doc or chat logs. (If the user prefers, they do this step themselves.)
2. While signed in, read the clinic ID from the browser console:
   `fetch('/api/auth/me').then(r => r.json())`, take the clinic/tenant id.
   Until the clinic is registered (7.6) it only has recovery access and normal
   operations stay blocked; that is expected.

### 7.6 Register the clinic on the control site and switch everything on

`/owner/clinics` → **Register clinic**:

| Field        | Value                                                    |
| ------------ | -------------------------------------------------------- |
| id           | the clinic ID from 7.5                                   |
| name / slug  | clinic name / `<slug>`                                   |
| hostname     | `<slug>.dental.clinic-cms.cc` (must match exactly)       |
| customerId   | the **customer ID** from 7.3 (as Berhanu's was)          |
| Access until | end of the term (Berhanu: 30 days; use Addis Ababa time) |
| Monthly fee  | `0` unless the user gave a price                         |
| Delivery     | Hosted                                                   |

Then select the new clinic and:

1. **Modules** → tick **all 21** (Berhanu parity), including dependencies, apply immediately.
2. **Branding** → display name, Amharic name, colour, contacts, address, logo upload
   (raster image only).
3. **Profile and internal notes** → plan, fee, private notes.

Check `/owner/audit` shows the REGISTER and MODULES events.

### 7.7 Enrol the clinic for account and database controls (VPS, root)

`/owner/access` only works for clinics listed in `/etc/sunny-smile/owner-targets.json`
(root-owned, mode 0600; the worker re-reads it on every job, no restart needed).
Add one entry, keyed by the **installation ID** from 7.3:

```json
"<installation-id>": {
  "hostname": "<hostname>",
  "productKey": "dental-erp",
  "tenantId": "<clinic id from 7.5>",
  "appContainer": "client-<slug>-app-1",
  "databaseContainer": "client-<slug>-mysql-1"
}
```

Confirm the container names with `docker ps --format '{{.Names}}' | grep client-<slug>`.
Keep the file's owner and mode (`stat -c '%U %a' …` → root 600). Then on
`/owner/access` click **Refresh database status** and **Load users** for the clinic
(both read-only) to prove it is wired.

Also start the hourly reminder job for the clinic:

```bash
systemctl enable --now dental-clinic-reminders@<slug>.timer
systemctl list-timers | grep <slug>
```

### 7.8 Code PR #2 — add the clinic to the automatic rollout

1. Branch from `origin/main`; add `{ "client": "<slug>" }` as the **last** entry of
   `sites` in `ops/deploy/fleet.json` (after `berhanu-dental`).
2. `npx vitest run tests/unit/fleet-manifest.test.ts` plus the usual checks.
3. PR → green → merge. From the next tag on, the new clinic is updated with the rest
   and shows under **Releases**. (Until then, deploy it by hand with
   `deploy-client.yml`, section 5.)

### 7.9 Final acceptance for the new clinic

- [ ] `https://<hostname>/api/ready` → 200, valid HTTPS certificate.
- [ ] Landing page shows the new clinic's name, phones, hours.
- [ ] Admin can sign in; dashboard works; all modules visible (incl. Braces, Forms, Lab).
- [ ] `/owner/clinics`: registered, all 21 modules, branding set, term correct.
- [ ] `/owner/fleet` lists the clinic; `/owner/access` shows DB status and users.
- [ ] A database backup exists after the first fleet deploy: `/opt/backups/<slug>/`.
- [ ] Nothing about Abiy or Berhanu appears on this clinic's pages (names, logos,
      printables).
- [ ] Write `docs/clients/<NAME>_ONBOARDING.md` like Berhanu's (IDs, release,
      URLs, term, open questions; **no passwords**) and open a docs PR.

---

## 8. Playbook D — something is wrong

| Symptom                                      | Do this                                                                                                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A site failed its deploy                     | It already restored its previous image. Read the failing step in the `Deploy fleet` run (`gh run view <id> --log-failed`). Fix forward in a new PR → new patch tag. Sites after the failed one were not touched; the next tag covers them. |
| Need an older version on one site right now  | `gh workflow run deploy-fleet.yml -f version=<older> -f clients="<site>"`. Remember the database is not rolled back (rule 3).                                                                                                              |
| Need to restore data                         | Dumps: `/opt/backups/<site>/<timestamp>.sql.gz` (clinic stacks; control backend uses `/opt/backups/saas-control/*.dump`; worker backups use `/opt/backups/clients/<slug>/`). Restore only after telling the user; it overwrites live data. |
| Where to see what happened                   | `/opt/clients/<site>/deployments.log` (legacy: the stack dir; control backend: `/opt/dental-saas/deployments.log`), the Releases page, the workflow run logs.                                                                              |
| `/api/ready` is not 200                      | On the VPS: `cd /opt/clients/<site> && docker compose ps && docker compose logs --tail=100 app migrate`.                                                                                                                                   |
| New hostname gives a certificate error / 502 | `docker exec kora-caddy-1 caddy validate --config /etc/caddy/Caddyfile`; check `/opt/kora/sites/<slug>.caddy` exists and the app container joined network `kora_default` with alias `<slug>-web`.                                          |
| Provision job FAILED                         | Error text is on `/owner`. Unapproved release → 7.2. "Refusing to adopt an unmanaged directory" → the folder already exists without the worker's marker file; ask the user before touching it.                                             |
| Clinic can sign in but "operations blocked"  | It is not registered, hostname mismatch, or expired. Check `/owner/clinics` (7.6) and the exact hostname.                                                                                                                                  |
| Release workflow failed before publishing    | Nothing was deployed. Read the failing job, fix, tag the next patch version.                                                                                                                                                               |
| Migration problem                            | The deploy rolled the image back but not the database. Write a new additive migration; do not hand-edit production tables without the user's go-ahead and a fresh backup.                                                                  |

Never delete a database volume, `docker compose down -v`, `docker system prune`
(beyond what `deploy.sh` already does), or `rm -rf` anything under `/opt` without
the user's explicit approval for that exact command.

---

## 9. Facts I could not verify from the repo — check these first, read-only [VERIFY]

An agent doing sections 7.2, 7.4, 7.7 or 8 needs shell access to the VPS. The
user's machine has an SSH entry for `185.190.142.27` (the VPS IP); use the user's
configured access, and tell the user before running anything that changes the
server. Quick read-only health check before you start a new clinic:

```bash
ls /opt/clients /opt/deploy /opt/kora/sites
docker ps --format '{{.Names}}' | grep -E 'client-|product-control|dental-saas|kora-caddy'
systemctl is-active product-platform-worker
stat -c '%U %a %n' /etc/sunny-smile/approved-releases.json /etc/sunny-smile/owner-targets.json
python3 -c "import json;print(list(json.load(open('/etc/sunny-smile/approved-releases.json'))))"   # versions only
grep -E '^(SITE_ID|HOSTNAME|APP_IMAGE)=' /opt/clients/berhanu-dental/.env                        # no secrets
```

Open questions (confirm once, then update this section):

- Berhanu's `.env` is expected to have `SITE_ID=berhanu-dental` (a config file with
  that name exists). Not checked on the server.
- The worker (`/opt/product-platform-worker`) is a **copy** of `ops/platform-worker/`
  installed by `install-worker.sh`; changing the compose template in the repo does
  not change what new clinics get until the worker is reinstalled on the VPS.
- Whether `/signup` is enabled on hosted clinic URLs (the Berhanu onboarding doc
  says admins were bootstrapped through it).
- The `/owner` Deploy buttons may pin an older image (6.1).
- Some VPS steps in section 7 (approved-releases, `SITE_ID`, owner-targets,
  reminder timer) are manual. They are good candidates to automate later (for
  example a `provision-client` script in `ops/deploy/` that does 7.2–7.7).
- GitHub environment `production` holds `VPS_HOST`, `VPS_USER`, `VPS_PORT`,
  `VPS_SSH_PRIVATE_KEY`, `VPS_SSH_HOST_KEY`; repo secret
  `LICENSE_ISSUER_PUBLIC_KEYS_JSON` is needed by the release build.

---

## 10. Copy-paste prompts for the user

> **Change one clinic:** "Change `<thing>` for Berhanu only. Use a branch from
> origin/main, gate it so Abiy and the others are unaffected, add tests, open a PR.
> Don't deploy yet." (then: "PR looks good — merge, tag and deploy, and verify.")

> **Control site feature:** "Add `<feature>` to the control site. Backend change
> must be additive and backward compatible. Open a PR, and when I say so, ship it
> and check `/owner/releases`."

> **New clinic:** "Create a new clinic called `<Name>` (Amharic: `<…>`), slug
> `<slug>`, copy Berhanu's setup with all modules on, 30-day trial, fee 0. Follow
> section 7 of AGENTS.md. Ask me for anything you're missing; don't invent facts.
> Tell me before every VPS change."

> **Ship everything that's merged:** "Follow section 3 and 5: check for a running
> release, show me what the next tag would ship, then tag, watch the rollout and
> verify all three sites."

---

## 11. Cheat sheet

```bash
# what will the next tag ship?
git fetch origin --tags && git log $(git describe --tags --abbrev=0 origin/main)..origin/main --oneline
# tag + deploy everything
git tag -a vX.Y.Z -m "vX.Y.Z" origin/main && git push origin vX.Y.Z
# watch
gh run list --workflow=release.yml --limit 1 && gh run watch <id> --exit-status
# redeploy some sites
gh workflow run deploy-fleet.yml -f version=X.Y.Z -f clients="control berhanu-dental"
# health
for h in control lemlem.dental drberhanubelta.dental; do curl -s -o /dev/null -w "$h %{http_code}\n" https://$h.clinic-cms.cc/api/ready; done
```

---

<claude-mem-context>
# Memory Context

# [dental-erp] recent context, 2026-08-20 11:34am GMT+3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (19,408t read) | 1,744,626t work | 99% savings

### Aug 13, 2026

4963 2:42p 🔵 CI Release Workflow Publishes Only Next.js Image — FastAPI Backend Has No CD Pipeline
4965 2:44p 🔵 User ID Type Incompatibility: Prisma/MySQL Uses CUID Strings, FastAPI/PostgreSQL Uses UUIDs
4966 2:46p ⚖️ New Task: Complete FastAPI-Frontend Integration and Add Backend to Docker Compose
4967 2:47p 🔵 dental-erp Has 195 Next.js API Routes Across 46 Domains and 81 Prisma Models
4973 2:52p ⚖️ Full production-ready Ethiopian Dental ERP scope confirmed
4974 " ✅ Git history detached from upstream fork via orphan commit
4975 4:09p ✅ Git history fully detached — repository now has single root commit on main
4976 " 🟣 FastAPI backend and migration services added to docker-compose.dev.yml
4977 " ✅ .env.example updated with FASTAPI_URL and DENTAL_ERP_DEV_BACKEND_PORT
4978 4:10p 🔵 docker-compose.dev.yml validates cleanly with Docker daemon running
4988 4:21p 🔵 UV Cache Permission Denied in Docker Backend Container

### Aug 14, 2026

4980 10:52a 🔵 DentalERP Full-Stack Launch Procedure
4993 11:19a 🔵 Login Returns 500 with No Backend Request Visible in Logs
5003 " ⚖️ UI Overhaul Requested with Ethiopian Market Context and Full ERP Module Expansion
4989 11:20a 🔵 Docker Backend Container UV Cache Root Cause: uid=10001 with HOME=/
4990 " 🔴 Fixed UV Permission Denied in Backend Docker Image via ENV + pre-created cache dir
4994 11:26a 🔵 Login 500 Root Cause: next.config.js Wrong Default FastAPI Port
4995 " 🔴 Fixed Login 500: Corrected FASTAPI_URL Default Port and Added Missing .env Vars
4996 " 🔵 FastAPI Auth Response Uses camelCase via Pydantic alias_generator

### Aug 17, 2026

5311 9:13a ⚖️ Two-Tier Product Delivery Architecture Planned
5312 " 🔵 Dental ERP is a Next.js 16 + Prisma Monorepo for Indian Dental Clinics
5313 " 🔵 App Route Structure: Landing Page Already Exists at Root, Full ERP in (dashboard) Group
5314 " 🔵 Product Designed for Ethiopian Clinics with Amharic, ETB, and Africa/Addis_Ababa as Defaults
5315 9:14a 🔵 No CMS Exists and No /about or /contact Pages Present in App
5316 " 🔵 Docker Compose Uses MySQL + Redis, Not PostgreSQL Despite Product Plan Specifying Postgres
5317 9:19a ⚖️ Two-Tier Product Delivery Strategy Defined
5319 " 🟣 Two-Tier Product Packaging Spec Document Written
5318 9:20a 🔵 Dental ERP Codebase Structure Explored
5320 9:24a 🟣 Spec Committed on Feature Branch feat/two-tier-product-packaging
5321 9:27a ⚖️ No Git Commits During Implementation Phase
5322 9:28a 🔵 Test Infrastructure: Vitest + jsdom + Comprehensive Directory Structure
5323 9:29a 🔵 Nav Config Has Role-Based Filter Function and ERP Route Structure
5324 " 🔵 app/layout.tsx Has India-Focused SEO Keywords for Ethiopian Product
5325 " 🔵 app/page.tsx Is 284-Line 'use client' Component With Hardcoded Content
5326 " 🔵 Providers Component Runs ERP Auth Fetch Interceptor Globally on All Pages
5328 " 🟣 Full 8-Task Implementation Plan Written for Two-Tier Product Packaging
5327 " 🔵 t() Function Falls Back to English for Missing Amharic Keys
5329 9:35a 🔴 Project Memory Files Created for Two-Tier Packaging and No-Commit Policy
5330 " ⚖️ Subagent-Driven Development Chosen for Two-Tier Packaging Execution
5331 9:39a 🟣 Custom review-package-wt Script Created for Uncommitted SDD Workflow
5332 " 🔴 Plan Test Fix: useSite Error Assertion Requires LanguageProvider Wrapper
5333 9:40a 🔴 Plan Fix: Task 8 compose-stack test uses structural service-name parsing, not word regex
5334 " 🔴 Plan Fix: zod 4 top-level format validators replace deprecated z.string().url() and z.string().email()
5336 9:44a 🔴 Task 2 brief prose says "14 tests" but the brief's own test code has only 13 it() blocks
S1514 Task 3 security review subagent launched — claude-opus-5 conducting bypass analysis and spec compliance review of middleware.ts (Aug 17 at 9:53 AM)
S1515 Task 3 security reviewer (opus-5) reading source files — checking Next.js version, file structure, and setup.ts for bypass analysis (Aug 17 at 9:54 AM)
S1516 Task 4 subagent launched and reading source files — decomposing app/page.tsx into SiteProvider, SiteHeader, SiteFooter, site route group (Aug 17 at 9:54 AM)
S1517 Two-tier Dentix ERP product packaging — Task 4 in active implementation: site route group, SiteProvider/SiteHeader/SiteFooter (Aug 17 at 9:55 AM)
S1518 Two-tier Dentix product packaging — Task 4 site route group implementation complete; Task 3 bypass analysis in progress (Aug 17 at 9:55 AM)
S1519 Task 3 security review: deeper bypass analysis of middleware.ts — edge sandbox env vars, x-middleware-subrequest CVE, PRODUCT_TIER env availability (Aug 17 at 9:58 AM)
S1520 Task 4 complete — full suite confirmed green; Task 3 security review finalizing with NextRequest.nextUrl.pathname behavior verified (Aug 17 at 9:59 AM)
S1521 Two-tier Dentix ERP packaging — Tasks 5 and 3 Fix Round 2 applied, Task 6 dispatched (Aug 17 at 9:59 AM)
S1522 Two-tier Dentix ERP packaging — Task 3 Fix Round 2, Task 6, and Task 4/5 review all completed; full suite 193/4418 green (Aug 17 at 10:00 AM)
S1523 Two-tier Dentix ERP packaging — Task 7, SiteHeader regression fixes, Task 8 delivery artifacts, and DOT_SEGMENT encoded-form tightening all simultaneously in flight (Aug 17 at 10:14 AM)
5342 9:41p 🔵 Git Branch Pull Requested from GitHub
5346 " 🔵 Git Status Shows Branch at 08fdd2c — Behind the 19da05e Pull
5343 " 🔵 dental-erp Git Repository State on feat/two-tier-product-packaging
5344 9:42p 🔵 Git Pull Brought 33-File Fast-Forward on feat/two-tier-product-packaging
5345 " 🔵 Full Test Suite: 20 Tests Failing Across 3 Test Files After Pull
5347 9:45p 🔵 Second Pull: 29 More Files Fast-Forwarded to 986e8ef — Test Fixes Included

Access 1745k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>

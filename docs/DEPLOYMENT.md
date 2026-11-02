# Deployment

How a change gets from a branch to a clinic. This is the current process; older
notes in `docs/SAAS_OPERATIONS.md` about staging snapshots under
`/opt/dental-saas/releases` apply only to the legacy Lemlem and control stacks.

## 1. Merge

Open a PR against `main` and get CI green (lint, types, unit tests, build,
backend). `main` is the only release line.

## 2. Release (automatic)

```bash
git checkout main && git pull
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

That one tag does everything. The `Release` workflow re-runs CI, builds the app
image (amd64 and arm64) and the SaaS backend image, publishes
`ghcr.io/natnael-wondwoesn/dental-erp:X.Y.Z` and `...-backend:X.Y.Z`, and then
the `Deploy fleet` workflow rolls the release out to every site listed in
`ops/deploy/fleet.json`, in order:

1. `control` - backend first (database backup, alembic migrations, health check),
   then the control web app.
2. `lemlem` (Abiy's clinic).
3. `berhanu-dental`.

For every site, `ops/deploy/deploy.sh` pulls the image, dumps the database to
`/opt/backups/<site>/`, switches the image, lets compose run the migrate service
and wait for the health check, then checks `https://<hostname>/api/ready`. Any
failure restores that site's previous version and stops the run, so later sites
keep what they had. The database is not rolled back, so migrations must be
additive. Each rollout is recorded on the control site under **Releases** and in
`/opt/clients/<site>/deployments.log`. Pushing a branch or `main` never deploys.

Redeploy or retry without a new tag: Actions -> **Deploy fleet** -> Run workflow
with the version, and optionally `clients` (for example `control berhanu-dental`).

## 3. Add a new client site

1. Provision its stack on the VPS: `/opt/clients/<name>/{compose.yml,.env}` with
   `APP_IMAGE` and `HOSTNAME` in `.env` (copy `berhanu-dental`). Legacy layouts use
   `ops/deploy/clients/<name>.conf` instead.
2. Add one line to `ops/deploy/fleet.json`: `{ "client": "<name>" }`.
3. Register the clinic on the control site, then merge. The next tag deploys it
   with everything else, and it appears under **Releases**.

To keep a site out of automatic releases, remove its line from `fleet.json`.

## 4. Turn on a module (if the release adds one)

control.clinic-cms.cc -> Clinic subscriptions -> pick the clinic -> tick the
module -> save.

## Rules for agents

- Do not stage releases or edit `/etc/sunny-smile/approved-releases.json` by
  hand for Berhanu-style clients; use the steps above.
- Do not deploy from a working tree. Production runs tagged images only.
- Pushing a version tag is the human-approved step: it deploys to every site.
  An agent prepares the branch and PR, and says when it is ready to tag.
- Lemlem and control use the same workflow. `ops/saas-control/deploy.py` is
  legacy and should not be used for releases any more.
- Deploy the control platform and Lemlem before large migrations land elsewhere,
  and check each site after its deploy.

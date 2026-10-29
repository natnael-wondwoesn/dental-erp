# Deployment

How a change gets from a branch to a clinic. This is the current process; older
notes in `docs/SAAS_OPERATIONS.md` about staging snapshots under
`/opt/dental-saas/releases` apply only to the legacy Lemlem and control stacks.

## 1. Merge

Open a PR against `main` and get CI green (lint, types, unit tests, build,
backend). `main` is the only release line.

## 2. Release (publishes an image, deploys nothing)

```bash
git checkout main && git pull
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

The `Release` workflow re-runs CI, builds amd64 and arm64 images and publishes
`ghcr.io/natnael-wondwoesn/dental-erp:X.Y.Z`. Pushing a branch or `main` never
deploys.

## 3. Deploy one clinic

GitHub -> Actions -> **Deploy client** -> Run workflow:

- `client`: `berhanu-dental`, `lemlem` or `control` (the control platform).
  Berhanu-style clinics live in `/opt/clients/<client>`; Lemlem and control are
  described by `ops/deploy/clients/*.conf`
- `version`: the released version without the `v` (for example `0.1.21`)

The workflow runs `ops/deploy/deploy.sh` on the VPS. It pulls the image, dumps
the clinic database to `/opt/backups/<client>/`, switches `APP_IMAGE`, lets
compose run the migrate service and wait for the health check, then checks
`https://<hostname>/api/ready`. Any failure restores the previous image. The
database is not rolled back, so migrations must be additive.

Deploy one clinic at a time and check it before the next. Each deploy is
appended to `/opt/clients/<client>/deployments.log`.

## 4. Turn on a module (if the release adds one)

control.clinic-cms.cc -> Clinic subscriptions -> pick the clinic -> tick the
module -> save.

## Rules for agents

- Do not stage releases or edit `/etc/sunny-smile/approved-releases.json` by
  hand for Berhanu-style clients; use the steps above.
- Do not deploy from a working tree. Production runs tagged images only.
- Pushing a tag and running Deploy client are the human-approved steps. An agent
  prepares the branch and PR, and says when it is ready to tag.
- Lemlem and control use the same workflow. `ops/saas-control/deploy.py` is
  legacy and should not be used for releases any more.
- Deploy the control platform and Lemlem before large migrations land elsewhere,
  and check each site after its deploy.

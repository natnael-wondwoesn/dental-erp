# Clinic SaaS operations

See [Owner console guide](OWNER_CONSOLE.md) for centralized account management
and full database stop/start. Those controls are separate from subscription
write suspension.

Release: `0.1.1-saas.20261018`. Owner operations:
`https://control.clinic-cms.cc/owner/clinics`.

## Clinic controls

Sign into vendor workspace with existing platform-owner account. Open **Clinic
subscriptions**. Clinic administrators cannot access these controls.

- **Modules:** choose Starter, Practice, all modules, or explicit custom grants.
  Dependencies must also be selected. Default downgrade timing is next paid period;
  choose immediate when required. Changes preserve existing records.
- **Payments:** verify bank/Telebirr receipt outside this app, then record reference,
  amount in ETB, and calendar months. Reusing the same reference cannot extend
  twice. No automatic charging or payment-provider reconciliation is implemented.
- **Suspend writes:** enter audit reason. Hosted operational writes lock on the
  next request, including existing sessions and entitled background jobs. Reads,
  clinical recovery, export/backup, audit, login and renewal remain available with
  existing role checks. Restoring a suspended clinic still respects expiry.
- **Branding:** set display/Amharic names, color, contacts, address, renewal contact,
  and tenant-owned raster logo upload path. No remote scripts or arbitrary CSS.
- **History:** inspect payment, module, branding, suspension and issuance events.

Lemlem starts in explicit `migration` status with all modules and no expiry, per
owner instruction. Its first verified renewal starts calendar-month enforcement.
No price, previous payment, or overdue debt was invented. Migration access remains
subject to explicit suspension and module changes.

## New hosted clinics

1. Provision dedicated installation from existing `/owner` installation workflow,
   choosing exact vendor-approved release. Each installation has separate MySQL
   database, upload volume, auth secret and URL. Shared Postgres clinical tenancy
   remains a future migration, not a property of this release.
2. Bootstrap clinic administrator through installation signup. Read clinic ID from
   authenticated `/api/auth/me` response. Missing SaaS registration allows recovery
   but blocks operational access.
3. Register that exact clinic ID in **Clinic subscriptions**, with customer ID,
   registered DNS hostname, delivery mode, modules, paid-through date and fee.
   Registration does not copy clinical data or create a DNS record.
4. Point DNS to VPS and confirm TLS/hostname routing before handover. Clinic URL
   and authenticated clinic membership must agree.

Existing user email uniqueness still permits one clinic per account. Global
identities, multi-clinic memberships, shared clinical Postgres/RLS, verified custom
DNS automation and clinical data synchronization are not included in this rollout.

## Offline installations

Provision same clinic/customer IDs into installation configuration. Initial setup
without IDs remains recovery-only until vendor finishes registration.

```powershell
.\Install-Offline.ps1 -LanMode LocalOnly -ClinicId '<clinic-id>' -CustomerId '<customer-id>'
```

For existing installation, preserve generated secrets and volumes; add
`SAAS_TENANT_ID` and `SAAS_CUSTOMER_ID` to its existing `.env`, then recreate app.
Installer intentionally does not overwrite an existing environment file.

Windows agent creates signed activation request. In vendor console, choose offline
clinic, verify paid period/modules, upload request, download installation-bound
`.lic`. Import using subscription page or existing agent/USB workflow. Signer
private seed remains `/opt/dental-saas/issuer.seed`, outside all clinic images,
environments, source archives and offline bundles.

Disconnected clinics enforce signed expiry and existing five-day grace locally.
Immediate suspension applies to hosted deployments. This release does not poll
vendor for offline suspension, even when the local machine reconnects; offline
installations enforce imported signed expiry/grace. Explicit module changes require a newer signed license.
Clock/replay/fingerprint checks continue through existing licensing runtime.
Offline branding resolves local clinic record without network access.

Windows packaging and DPAPI smoke tests use existing Windows GitHub Actions jobs.
This macOS session cannot prove Windows installation or hardware/LAN operation;
follow `docs/testing/OFFLINE_LICENSING_MANUAL_TEST.md` before customer handover.
No bidirectional hosted/offline clinical sync is provided.

## Runtime and secrets

- Clinic and vendor Next.js containers share private `dental_saas_gateway` network
  with FastAPI control companion. No new public database or API port.
- Separate Postgres volume holds subscriptions, payments, audit and license history.
  Existing clinical MySQL databases and uploads stay in place.
- Clinic gets reader token only. Vendor server gets separate admin token. Browser
  never gets either token. Backend JWT secret is independent of clinic auth.
- Hosted policy is fetched per request with no authoritative JWT/client cache.
  UI refreshes within 30 seconds. Policy outage denies normal operations; recovery
  endpoint retains its independent authentication and clinic scope.
- Generic legacy dashboards, broad AI commands and reports require their source
  modules. Narrow AI tools have narrower source checks. Dedicated modular home
  avoids requesting unlicensed aggregate data.

## Approved releases and rollback

> For Berhanu-style clinic stacks use the tag-and-deploy process in
> [DEPLOYMENT.md](DEPLOYMENT.md). This section describes the legacy path still
> used by Lemlem and the control platform.

Source snapshots live under `/opt/dental-saas/releases/<version>`. `release.json`
pins local Docker image IDs. `/etc/sunny-smile/approved-releases.json` is root-owned
allowlist for customer worker deployments. Mutable `latest` is rejected.

Production frontend image builds from Node 22 Bookworm. Backend builds separately.
Release workflow publishes images; publishing does not deploy. Deployment workflow
is manual and promotes an already staged version:

```bash
python3 /opt/dental-saas/releases/0.1.1-saas.20261018/ops/saas-control/deploy.py \
  --version 0.1.1-saas.20261018
```

Promotion checks immutable image IDs, backs up clinic/vendor databases and uploads,
restores both SQL backups into separate empty MySQL container, then applies additive
SaaS migrations and recreates only clinic/vendor web services. Failed readiness
restores previous web images/configuration. Existing clinical schemas are unchanged.

Current Compose overlays: `/opt/dental-saas/clinic.release.yml` and
`/opt/dental-saas/control.release.yml`. Always include them for manual web recreation;
legacy Compose alone points to an older local image. Source checkout remains
unchanged; `/opt/dental-saas/current` points at promoted snapshot.

Backup path and previous image IDs are recorded in protected
`/opt/dental-saas/deployment.json` and backup directory. No automatic database
rollback follows an incompatible migration; use expand/contract releases and review
restore procedure before any future destructive schema change. Signing-key custody
and off-server backup must remain under vendor control.

Live acceptance uses disposable synthetic tenants only:

```bash
python3 /opt/dental-saas/current/ops/saas-control/smoke.py
```

It verifies active writes, unlicensed APIs, cross-clinic record access, vendor
separation, suspension/read/recovery, immediate restoration and revocation. It then
removes only its own generated fixtures. Never suspend Lemlem for smoke tests.

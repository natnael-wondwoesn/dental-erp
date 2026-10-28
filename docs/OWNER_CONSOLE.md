# Software-owner console

Use the dedicated vendor account at
https://control.clinic-cms.cc/login.
Clinic administrator accounts do not have platform-owner access.

| Owner page       | Controls                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/owner`         | Customers, issued products, installation inventory, approved releases, health, supported backups/restarts and operation history                                      |
| `/owner/clinics` | Dental ERP module packages, branding, payment recording, term renewal, suspension/restoration and license issuance                                                   |
| `/owner/access`  | Per-installation database status/stop/start; clinic user listing, administrator/staff creation, role changes and account activation; Dental ERP demo-data seed/reset |

## Everyday use

To change modules, open Clinic subscriptions, select the clinic, select modules
and dependencies, choose immediate or paid-period-end change, and save.
Suspending writes preserves authorized reads and recovery/export. Restoration
still respects subscription expiry. Berhanu has a 30-day evaluation ending
November 19, 2026; Lemlem retains migration access until its paid-through term is
set by a verified renewal.

To create an administrator or staff user, open Clinic accounts and databases,
find the installation, enter an audit reason, full name, login email and product
role, and choose Create account. Copy the temporary password shown after the job
succeeds. Share it privately. No email/SMS is sent. The plaintext password is not
stored in job history and cannot be retrieved by reopening the page. Loading
users shows account metadata only; it does not open clinical records. Role and
activation changes consult current database-backed account permissions. The
last active clinic administrator cannot be disabled or demoted.

To stop a database, enter a reason and type that clinic's exact hostname, then
choose Stop database. This stops only its bound database container and preserves
its data volume. Clinic operations become unavailable. Vendor console stays
available; use Start database to start the same database and wait for readiness.
Refresh database status checks actual host state. Database stop/start is distinct
from subscription write suspension. No database deletion or volume removal is
exposed. Offline installations without host-agent connectivity cannot be remotely
stopped by this VPS console.

To prepare a Dental ERP installation for a client demonstration, enter an audit
reason and choose **Seed demo data** on `/owner/access`. The operation first
refreshes the installation's existing demo dataset, then adds synthetic records
across patients, appointments, clinical work, billing, laboratory tracking,
inventory, prescriptions, recalls, communications and sterilization. Choose
**Remove demo data** to delete only records carrying that tenant's reserved
`demo_seed_` identifiers. The worker binds the tenant from its protected registry;
the browser cannot select another clinic, and ordinary clinic records are retained.

Database controls and accounts currently support the issued Dental ERP and
Clinic CMS installations. Modules/subscriptions on `/owner/clinics` apply to
Dental ERP; other product families need their own commercial-policy adapter.
Legacy inventory-only installations retain their existing deployment restrictions,
while the new owner account/database actions use explicit host bindings.

## Privilege boundary and enrollment

The web server has no Docker socket, clinic DB credentials or root private key.
It queues typed, owner-authorized jobs with immutable installation association
and requested-by identity. Root worker resolves installations against
`/etc/sunny-smile/owner-targets.json`, whose entries bind vendor installation ID,
registered hostname, product, clinic ID, application container and database
container. Browser/request data cannot choose a container, tenant ID or SQL.

After provisioning a new installation and clinic bootstrap, add its verified
binding to this root-owned, mode-0600 registry before enabling owner account/DB
controls. Use existing product adapter only if its schema and authorization model
match. New product types require an adapter and acceptance tests; arbitrary
products or containers are never adopted from browser input.

Temporary credentials are protected in queued jobs with RSA-OAEP SHA-256.
Vendor gets only base64 public PEM via `PLATFORM_USER_PUBLIC_KEY_BASE64`.
Private PEM remains `/etc/sunny-smile/owner-user-private.pem` mode 0600 on host.
Dental ERP hashes with bcrypt cost 12 before encrypting. Clinic CMS decrypts only
inside the host workflow, hashes with its native Argon2 helper, and keeps PostgreSQL
RLS enabled with explicit clinic context. Account adapters return selected safe
fields and sanitize ORM errors. Clinic accounts can never grant platform-owner
privileges. Job results do not expose encrypted request contents.

Normal host jobs remain PROVISION/DEPLOY/RESTART/BACKUP; additional owner-only jobs
are STATUS/USER_LIST/USER_CREATE/USER_UPDATE/DB_STOP/DB_START/DEMO_SEED/DEMO_RESET. Account/list jobs
must not overwrite deliberately stopped installation state. Failed jobs remain
visible in operation history. No destructive schema migration is needed.

## Verification

Run focused API/proxy tests and `python3 -m unittest discover -s
ops/platform-worker -p 'test_*.py'`. Live acceptance uses synthetic tenant/accounts
and a separate disposable database to verify creation, role/activation changes,
last-admin protection, and data persistence across real Docker stop/start. Clinical
patient data is not needed for these tests. Existing client databases must remain
running throughout acceptance. Preserve ordinary append-only security audit events.

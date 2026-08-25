# Product platform operations

## Purpose

The platform-owner console at `/owner` manages Dental ERP, Clinic CMS, and future product adapters from one inventory. It is intentionally separate from clinic administration: an ordinary clinic `ADMIN` receives a 404 and cannot see customer, deployment, license, or operational data.

The console records:

- customers and contacts;
- product definitions and immutable image versions;
- isolated installations and hostnames;
- per-installation feature entitlements;
- license expiry dates;
- health and backup timestamps;
- an auditable queue of provisioning, deployment, restart, and backup operations.

## Security boundary

The Next.js web container does **not** receive `/var/run/docker.sock`, SSH keys, or root credentials. A root-owned systemd worker polls the console using a 32-byte-or-longer bearer token. The worker:

- recognizes only `PROVISION`, `DEPLOY`, `RESTART`, and `BACKUP`;
- supports only the `dental-erp` and `clinic-cms` adapters;
- accepts lowercase DNS-safe slugs and public hostnames;
- constructs paths only under `/opt/clients/<slug>`;
- refuses to adopt directories without its management marker;
- constructs Compose project names as `client-<slug>`;
- never evaluates customer-supplied shell text;
- reports every result back to the audit queue.

Treat the worker token as a root-adjacent secret. Store it only in the application `.env` and `/etc/sunny-smile/platform-worker.env`, both mode `0600`.

## VPS prerequisites

The existing `kora-caddy-1` proxy remains the only process publishing ports 80 and 443. Its Compose service must mount the managed sites directory:

```yaml
volumes:
  - ./Caddyfile:/etc/caddy/Caddyfile:ro
  - ./sites:/etc/caddy/sites:ro
```

The final line of `/opt/kora/Caddyfile` must be:

```caddy
import /etc/caddy/sites/*.caddy
```

Create the shared network once if it does not exist:

```bash
docker network inspect kora_default >/dev/null
```

## Install the worker

Generate a token without printing it into shell history where practical:

```bash
install -d -m 0700 /etc/sunny-smile
openssl rand -hex 32 > /etc/sunny-smile/platform-worker.token
chmod 0600 /etc/sunny-smile/platform-worker.token
```

Add the same token to the Dental ERP production `.env` as `PLATFORM_WORKER_TOKEN`. Then create `/etc/sunny-smile/platform-worker.env`:

```text
CONTROL_PLANE_URL=https://control.dental-clinic-cms.duckdns.org
PLATFORM_WORKER_TOKEN=<same token>
CLIENT_ROOT=/opt/clients
BACKUP_ROOT=/opt/backups/clients
CADDY_SITES_DIR=/opt/kora/sites
POLL_SECONDS=8
```

Install from the checked-out repository:

```bash
sudo ops/platform-worker/install-worker.sh
```

## Platform owner

The database field `User.isPlatformOwner` is independent of `role=ADMIN`. Promote only the product vendor account:

```sql
UPDATE User SET isPlatformOwner = TRUE WHERE email = '<owner email>';
```

Log out and sign in again after promotion. The login endpoint sets an eight-hour, HTTP-only, secure, same-site access cookie so server-rendered owner pages and server actions can authenticate without exposing the token to those pages.

## Provisioning behavior

Each new installation receives:

- its own Compose project;
- a private internal network;
- a separate MySQL or PostgreSQL volume;
- separate upload and license-state volumes;
- randomly generated database and application secrets;
- a single web service attached to `kora_default` under `<slug>-web`;
- an individual Caddy site file and TLS certificate;
- a disabled-by-default feature entitlement set.

Dental ERP handwriting is controlled by `FEATURE_HANDWRITTEN_DIAGNOSIS`. Changing the entitlement in the console and queuing `DEPLOY` updates only that installation. Sunny Smile therefore remains unchanged.

## Backup policy

`BACKUP` writes a compressed database dump and SHA-256 checksum under `/opt/backups/clients/<slug>`. This is a local recovery copy, not an off-site backup. A production schedule must also copy these encrypted artifacts to a different machine or storage provider. Database dumps are mode `0600` and never served by Caddy.

Recommended schedule:

- database dump nightly;
- upload/object storage snapshot nightly;
- encrypted off-site copy after each local backup;
- monthly restore drill into a disposable Compose project;
- record the restore result in the installation's operational notes.

## Adding another product

Adding a future custom product requires an explicit adapter rather than accepting arbitrary Compose text from the web:

1. Add a fixed Compose template under `ops/platform-worker/templates/`.
2. Add the product key to the worker's `PRODUCTS` allowlist.
3. Add product-specific secret generation and backup commands.
4. Validate paths, container networks, health checks, volumes, and migration order.
5. Add security tests before deployment.

This keeps future customization maintainable without turning the console into a remote shell.

# Landing-page-only sites

A landing site is a folder of static files (see `sites/<name>/`) that the existing
Caddy proxy serves. There is no app, database or login behind it.

- **Publish:** run the `Deploy landing site` workflow with the site name. It builds the
  site and uploads it to `/opt/landing-sites/<slug>/`, then switches `current` to the
  new build. Nothing is deployed by a version tag.
- **Pause / restore:** on the control site (`/owner`), the site's card has a **Pause
  site** / **Restore site** button. Pausing makes the hostname show the shared "service
  paused" page (HTTP 503). Restoring brings the real page back. Nothing is deleted.

## One-time setup on the VPS (root)

1. Let the Caddy container see the sites. In the compose file that runs `kora-caddy-1`,
   add this volume to the caddy service, then recreate it:

   ```yaml
   - /opt/landing-sites:/srv/landing:ro
   ```

2. Create the folders and the shared paused page:

   ```bash
   mkdir -p /opt/landing-sites/_paused
   # then copy sites/_paused/index.html into /opt/landing-sites/_paused/
   ```

3. Register each site so the worker is allowed to pause it (root-owned, mode 600). The
   key is the installation ID shown on `/owner`:

   ```json
   { "<installation-id>": { "slug": "dalian-dental", "hostname": "dalian.example.com" } }
   ```

   Save it as `/etc/sunny-smile/landing-sites.json`.

4. Update the worker on the VPS (copy `ops/platform-worker/landing_sites.py` and
   `platform_worker.py`, then `systemctl restart product-platform-worker`).

5. Add a product named `landing-site` to the control site's products (the key must be
   exactly `landing-site`) so the site can be created from `/owner`.

6. Point the site's DNS name at the VPS (`185.190.142.27`). A name under
   `*.dental.clinic-cms.cc` needs no DNS change.

## Creating a client site

On `/owner`: create the customer, then an installation with product `landing-site`, the
slug and hostname. Set "paid through" to the end of the paid period. Then run the
`Deploy landing site` workflow, and write the site's Caddy snippet by pressing
**Restore site** once (it writes the live snippet).

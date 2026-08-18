# Continuous deployment to the VPS

The `Deploy current branch to VPS` workflow deploys every push to
`feat/two-tier-product-packaging`. It connects to the VPS over SSH, checks out
the exact pushed commit, validates `compose.vps.yml`, rebuilds the production
containers, runs migrations through the Compose dependency chain, and verifies
the public `/api/ready` endpoint.

## One-time VPS preparation

The repository and production `.env` must already exist on the VPS. The
documented default location is `/opt/dental-erp`:

```bash
cd /opt/dental-erp
git remote -v
test -f .env
docker compose -f compose.vps.yml --env-file .env config --quiet
```

The VPS checkout must be able to fetch `origin` without an interactive password.
For a private repository, install a read-only GitHub deploy key on that checkout.
The deployment user must also be allowed to run Docker without `sudo`.

Tracked edits made directly in the VPS checkout are not preserved: deployment
resets the selected branch to the exact commit that triggered the workflow.
The ignored production `.env` and Docker volumes are not removed.

## GitHub production secrets

In **Settings → Environments → production**, add:

| Secret                | Value                                           |
| --------------------- | ----------------------------------------------- |
| `VPS_HOST`            | VPS hostname or IP address                      |
| `VPS_USER`            | SSH deployment user                             |
| `VPS_SSH_PRIVATE_KEY` | Private key used only to connect to the VPS     |
| `VPS_SSH_HOST_KEY`    | Complete trusted `known_hosts` line for the VPS |
| `VPS_DEPLOY_PATH`     | Repository path, normally `/opt/dental-erp`     |
| `VPS_PORT`            | Optional SSH port; defaults to `22`             |

Generate a dedicated key pair locally and append its public half to the
deployment user's `~/.ssh/authorized_keys`:

```bash
ssh-keygen -t ed25519 -C dental-erp-github-deploy -f dental-erp-vps-deploy
```

Obtain `VPS_SSH_HOST_KEY` from a trusted VPS console or compare the result of
`ssh-keyscan` with the server's `/etc/ssh/ssh_host_ed25519_key.pub`. Do not trust
an unverified key gathered over the same network path the workflow will use.

## Deployment behavior

Deployments are serialized so two pushes cannot run Compose simultaneously.
GitHub Actions and the VPS both retain diagnostic output if a build, migration,
container startup, or readiness check fails. The workflow can also be rerun
manually from the Actions tab.

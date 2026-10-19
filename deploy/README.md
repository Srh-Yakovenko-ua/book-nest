# Deploy (Hetzner, single box)

Production lives on one Hetzner server (`nest-book`, `46.224.83.71`). Two environments share the box:

| Env  | URL                 | Branch | Services                          |
| ---- | ------------------- | ------ | --------------------------------- |
| prod | `book-nest.net`     | `prod` | `api-prod`, `web-prod`, `db-prod` |
| dev  | `dev.book-nest.net` | `dev`  | `api-dev`, `web-dev`, `db-dev`    |

`caddy` is shared: it terminates TLS (auto Let's Encrypt) and routes by host — `*/api/*` → the env's API, everything else → the env's web. Each env has its **own Postgres** in a separate named volume; the two never share data. App images are built in CI and pulled from GHCR; the box never builds.

## How config reaches the server (automated)

The server (`~/booknest`) is **not** a git checkout and you do **not** edit files there by hand. On every deploy, `.github/workflows/deploy.yml` (job "Sync stack files + secrets, then deploy over SSH"):

1. **renders `~/booknest/.env`** from **GitHub repo Secrets** (`DEV/PROD_JWT_*`, `DEV/PROD_POSTGRES_PASSWORD`, `PROD_SMTP_PASS`, `DEV/PROD_R2_*`) plus non-secret constants, and `scp`s it over;
2. **syncs `docker-compose.yml`, `Caddyfile`, `deploy.sh`, `maintenance.sh` and `maintenance/`** from this repo to `~/booknest/`;
3. runs `deploy.sh <env>`.

So the source of truth is: **code/compose → this repo**, **secrets → GitHub Secrets**. To change a secret, update it in `Settings → Secrets → Actions` (mirror from Bitwarden) and re-deploy. To add a NEW env var: add it to `docker-compose.yml`, add the secret in GitHub, add its line to the render block in `deploy.yml`. Never SSH-edit `.env`/`compose` by hand.

## Files

- `docker-compose.yml` — the whole stack (caddy + both envs). Synced from repo by CI. It also carries the per-container log rotation (`json-file`, 10m x 5), the 30 s stop grace for the APIs so an in-flight request or queue job can finish before Docker sends SIGKILL, and a `pids_limit` on the app containers. Keeping these in the file means a rebuilt box gets them without anyone remembering `daemon.json`.
- `Caddyfile` — routing + TLS + the Mailpit basic-auth. Synced from repo by CI. To change the Mailpit password, regenerate the hash with `docker run --rm caddy:2-alpine caddy hash-password --plaintext '<password>'` and replace it in the file.
- `/api/metrics` is answered with a 404 at the edge on both hosts. The endpoint stays reachable inside the docker network for a future scraper.
- `.env.example` — documents the shape; the real `.env` is CI-rendered from GitHub Secrets. **Never commit a real `.env`.**
- `deploy.sh prod|dev|all` — `docker compose pull` → `up -d` → `docker image prune -f`. On **prod** it also raises the maintenance page around the swap (see below).
- `maintenance/maintenance.html` — the static page Caddy serves while prod is down. Self-contained on purpose: the web container is stopped when it is needed, so it may not reference a single external font, stylesheet or image.
- `maintenance.sh on|off|status` — raise or drop the prod maintenance page by hand, without a deploy.
- `systemd/docker-prune.{service,timer}` — weekly image + build-cache cleanup.

## First-time setup (on the server)

```sh
docker login ghcr.io            # so the box can pull private images
```

That's it — the first push to `dev`/`prod` renders `.env`, syncs the stack files, and `up -d`s everything (APIs self-migrate on boot). Make sure the GitHub Secrets above are set.

## Deploying a new version

Push to `dev` or `prod`. CI builds + pushes the `:dev`/`:prod` image to GHCR, syncs stack files + renders `.env` on the server, then runs `./deploy.sh <env>` — pulls the new image, recreates only that env's containers, prunes dangling images. The API container runs `prisma migrate deploy` on boot, so the DB is brought up to date automatically.

## Maintenance page (prod only)

During a prod deploy the `api-prod` and `web-prod` containers are recreated, so for a few seconds there is nothing to answer requests. Caddy stays up throughout, so the maintenance response lives there — nowhere else can cover that window.

Two things trigger it, and both land on the same response:

1. **Planned** — `deploy.sh prod` creates the flag file `~/booknest/maintenance/prod.on` before pulling images and removes it once `api-prod` reports healthy. A `trap` on `EXIT HUP INT TERM` removes it on a failed deploy, a rollback, or the SSH session dying when a workflow is cancelled. A `SIGKILL` would still strand it — `maintenance.sh off` clears it, and `handle_errors` means a genuinely dead app shows the same page anyway.
2. **Unplanned** — if an upstream is simply dead, `reverse_proxy` fails and `handle_errors` catches the 502/504. Users see the maintenance page instead of Caddy's bare gateway error.

The response is **503 with `Retry-After: 120` and `X-Maintenance: 1`** — HTML for page loads, JSON (`{"code":"MAINTENANCE",...}`) for `/api/*`. 503 is deliberate: Google treats it as "temporarily unavailable, come back" and keeps the pages indexed, which a 200 stub or a 502 would not. The frontend keys off the `X-Maintenance` header, **not** the bare status, because the API returns a plain 503 for media-upload backpressure and that must stay an ordinary error.

`/api/metrics` and `/api/metrics/` both keep answering 404, including while maintenance is up. The trailing-slash form used to fall through to the API — Caddy's bare `handle /api/metrics` is an exact match and Express resolves the slashed form to the same controller, so the Prometheus registry was publicly readable. It is a named `path` matcher now, covering both forms.

To take prod down by hand (a long migration, an incident):

```sh
cd ~/booknest && ./maintenance.sh on     # page goes up immediately, no restart needed
./maintenance.sh status
./maintenance.sh off
```

`dev` is deliberately untouched by all of this — its deploys behave exactly as before.

## Cleanup (automatic)

- **Per deploy** — `deploy.sh` runs `docker image prune -f` (removes the old untagged image left behind by the pull).
- **Weekly** — install the timer once:

  ```sh
  sudo cp systemd/docker-prune.* /etc/systemd/system/
  sudo systemctl enable --now docker-prune.timer
  ```

  It runs `docker image prune -af --filter until=168h` + `docker builder prune` every Sunday 04:00.

> **Never** run `docker system prune --volumes` (or any `--volumes` prune): the Postgres data lives in volumes and would be deleted. Image/build-cache pruning is safe; volume pruning is not.

## Common ops

```sh
docker compose ps                       # status of all containers
docker compose logs -f api-prod         # tail one service
docker compose restart web-dev          # restart one service
docker compose exec db-prod psql -U booknest   # open a psql shell on prod DB
```

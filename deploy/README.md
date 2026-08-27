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

- `docker-compose.yml` — the whole stack (caddy + both envs). Synced from repo by CI.
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

## Query visibility

Three things tell you where the database spends its time, and they are all free.

1. **`pg_stat_statements`** aggregates every statement by normalized text with call counts and total, mean and max time. The compose file preloads it and turns on `track_io_timing` on both Postgres containers. The preload only takes effect when the container is recreated, so after the first deploy that syncs this compose file, recreate the database containers (a few seconds of downtime each) and create the extension once per database:

   ```sh
   cd ~/booknest
   docker compose up -d db-prod db-dev
   docker compose exec -T db-prod psql -U booknest -d booknest -c 'create extension if not exists pg_stat_statements;'
   docker compose exec -T db-dev  psql -U booknest -d booknest -c 'create extension if not exists pg_stat_statements;'
   ```

   Then, whenever something feels slow:

   ```sh
   docker compose exec -T db-prod psql -U booknest -d booknest -c "
     select calls, round(total_exec_time::numeric, 1) as total_ms, round(mean_exec_time::numeric, 2) as mean_ms,
            round(max_exec_time::numeric, 1) as max_ms, rows, left(query, 90) as query
     from pg_stat_statements order by total_exec_time desc limit 15;"
   ```

   Sort by `mean_exec_time` for the slowest single statements and by `calls` for the chattiest. `select pg_stat_statements_reset();` clears the counters when you want a fresh window.

2. **`log_min_duration_statement=500`** makes Postgres log every statement that takes over half a second, with its text, into the container log: `docker compose logs db-prod | grep 'duration:'`.

3. **The API side.** Prisma emits a query event per statement; the API records each one in the `db_query_duration_seconds` histogram (visible on `/api/metrics` from inside the docker network) and logs a `slow query` warning with the SQL for anything at or above `SLOW_QUERY_THRESHOLD_MS` milliseconds (default 200). `docker compose logs api-prod | grep 'slow query'` lists them; the query event carries no request id, so pair a slow line with the request log by its timestamp.

Read them together: the Postgres log says which statement was slow, `pg_stat_statements` says whether it is slow every time or once, and the API histogram says how much of a request's time the database accounts for.

## Common ops

```sh
docker compose ps                       # status of all containers
docker compose logs -f api-prod         # tail one service
docker compose restart web-dev          # restart one service
docker compose exec db-prod psql -U booknest   # open a psql shell on prod DB
```

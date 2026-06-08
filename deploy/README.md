# Deploy (Hetzner, single box)

Production lives on one Hetzner server (`nest-book`, `46.224.83.71`). Two environments share the box:

| Env  | URL                 | Branch | Services                          |
| ---- | ------------------- | ------ | --------------------------------- |
| prod | `book-nest.net`     | `prod` | `api-prod`, `web-prod`, `db-prod` |
| dev  | `dev.book-nest.net` | `dev`  | `api-dev`, `web-dev`, `db-dev`    |

`caddy` is shared: it terminates TLS (auto Let's Encrypt) and routes by host — `*/api/*` → the env's API, everything else → the env's web. Each env has its **own Postgres** in a separate named volume; the two never share data. App images are built in CI and pulled from GHCR; the box never builds.

## How config reaches the server (automated)

The server (`~/booknest`) is **not** a git checkout and you do **not** edit files there by hand. On every deploy, `.github/workflows/deploy.yml` (job "Sync stack files + secrets, then deploy over SSH"):

1. **renders `~/booknest/.env`** from **GitHub repo Secrets** (`DEV/PROD_JWT_*`, `DEV/PROD_POSTGRES_PASSWORD`, `PROD_SMTP_PASS`) plus non-secret constants, and `scp`s it over;
2. **syncs `docker-compose.yml`, `Caddyfile`, `deploy.sh`** from this repo to `~/booknest/`;
3. runs `deploy.sh <env>`.

So the source of truth is: **code/compose → this repo**, **secrets → GitHub Secrets**. To change a secret, update it in `Settings → Secrets → Actions` (mirror from Bitwarden) and re-deploy. To add a NEW env var: add it to `docker-compose.yml`, add the secret in GitHub, add its line to the render block in `deploy.yml`. Never SSH-edit `.env`/`compose` by hand.

## Files

- `docker-compose.yml` — the whole stack (caddy + both envs). Synced from repo by CI.
- `Caddyfile` — routing + TLS + the Mailpit basic-auth. Synced from repo by CI.
- `.env.example` — documents the shape; the real `.env` is CI-rendered from GitHub Secrets. **Never commit a real `.env`.**
- `deploy.sh prod|dev|all` — `docker compose pull` → `up -d` → `docker image prune -f`.
- `systemd/docker-prune.{service,timer}` — weekly image + build-cache cleanup.

## First-time setup (on the server)

```sh
docker login ghcr.io            # so the box can pull private images
```

That's it — the first push to `dev`/`prod` renders `.env`, syncs the stack files, and `up -d`s everything (APIs self-migrate on boot). Make sure the GitHub Secrets above are set.

## Deploying a new version

Push to `dev` or `prod`. CI builds + pushes the `:dev`/`:prod` image to GHCR, syncs stack files + renders `.env` on the server, then runs `./deploy.sh <env>` — pulls the new image, recreates only that env's containers, prunes dangling images. The API container runs `prisma migrate deploy` on boot, so the DB is brought up to date automatically.

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

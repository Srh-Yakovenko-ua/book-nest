# Deploy (Hetzner, single box)

Production lives on one Hetzner server (`nest-book`, `46.224.83.71`). Two environments share the box:

| Env  | URL                 | Branch | Services                          |
| ---- | ------------------- | ------ | --------------------------------- |
| prod | `book-nest.net`     | `prod` | `api-prod`, `web-prod`, `db-prod` |
| dev  | `dev.book-nest.net` | `dev`  | `api-dev`, `web-dev`, `db-dev`    |

`caddy` is shared: it terminates TLS (auto Let's Encrypt) and routes by host — `*/api/*` → the env's API, everything else → the env's web. Each env has its **own Postgres** in a separate named volume; the two never share data. App images are built in CI and pulled from GHCR; the box never builds.

## Files

- `docker-compose.yml` — the whole stack (caddy + both envs).
- `Caddyfile` — routing + TLS.
- `.env.example` — copy to `.env` on the server, fill the two DB passwords. **Never commit `.env`.**
- `deploy.sh prod|dev|all` — `docker compose pull` → `up -d` → `docker image prune -f`.
- `systemd/docker-prune.{service,timer}` — weekly image + build-cache cleanup.

## First-time setup (on the server)

```sh
cp .env.example .env            # then edit: set PROD_POSTGRES_PASSWORD + DEV_POSTGRES_PASSWORD
docker login ghcr.io            # so the box can pull private images
docker compose up -d            # brings up caddy + both envs; APIs self-migrate on boot
```

## Deploying a new version

CI builds + pushes `:prod` / `:dev` image tags to GHCR, then runs:

```sh
./deploy.sh prod                # or: ./deploy.sh dev
```

This pulls the new image for that env, recreates only its containers, and prunes dangling images. The API container runs `prisma migrate deploy` on boot, so the DB is brought up to date automatically.

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

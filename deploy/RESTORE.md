# Restoring the production database

`backup.sh prod` runs every night from `systemd/booknest-backup.timer`. It dumps `db-prod` with the `pg_dump` inside the container (so the version always matches), checks that `pg_restore` can read the archive, uploads it to the private R2 bucket `book-nest-backups` under `prod/`, and prunes copies older than 30 days there and older than 7 days in `~/booknest/backups/prod/`.

A backup that has never been restored is a guess. Run the drill below after any change to `backup.sh`, and at least once a quarter.

All commands run on the server in `~/booknest`. Load the environment first so the R2 credentials and the Postgres user are in scope:

```sh
cd ~/booknest
set -a; . ./.env; set +a
```

The `rclone` helper used below is the same container invocation `backup.sh` uses:

```sh
rclone() {
  docker run --rm -v "$PWD/backups:/backups" \
    -e RCLONE_CONFIG_R2_TYPE=s3 -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
    -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID" \
    -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY" \
    -e RCLONE_CONFIG_R2_ENDPOINT="$BACKUP_R2_ENDPOINT" \
    -e RCLONE_CONFIG_R2_REGION=auto -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true \
    rclone/rclone:1.75 "$@"
}
```

## The drill: restore into a scratch database

This never touches the live `booknest` database. It proves the newest dump is readable and complete.

```sh
rclone lsl "r2:$BACKUP_R2_BUCKET/prod/"                       # pick the newest file
latest=$(rclone lsf "r2:$BACKUP_R2_BUCKET/prod/" | sort | tail -n 1)
rclone copy "r2:$BACKUP_R2_BUCKET/prod/$latest" /backups/restore/

docker compose exec -T db-prod createdb -U "$PROD_POSTGRES_USER" booknest_restore_check
docker compose exec -T db-prod pg_restore -U "$PROD_POSTGRES_USER" -d booknest_restore_check \
  --no-owner --no-privileges < "backups/restore/$latest"

docker compose exec -T db-prod psql -U "$PROD_POSTGRES_USER" -d booknest_restore_check -c \
  "select (select count(*) from users) as users, (select count(*) from books) as books, (select max(finished_at) from _prisma_migrations) as last_migration;"

docker compose exec -T db-prod dropdb -U "$PROD_POSTGRES_USER" booknest_restore_check
rm -rf backups/restore
```

Compare the counts with the live database (`docker compose exec db-prod psql -U booknest -c "select count(*) from books"`). They should match the night the dump was taken. Record the date and the numbers in the release notes or a commit message so the next person knows the drill happened.

## A real restore

Only for data loss or a corrupted volume. Everyone is logged out afterwards, and anything written after the dump was taken is gone.

```sh
./maintenance.sh on                         # users see the maintenance page from now on
docker compose stop api-prod                # nothing writes while we work

latest=$(rclone lsf "r2:$BACKUP_R2_BUCKET/prod/" | sort | tail -n 1)
rclone copy "r2:$BACKUP_R2_BUCKET/prod/$latest" /backups/restore/

docker compose exec -T db-prod psql -U "$PROD_POSTGRES_USER" -d postgres -c \
  "drop database if exists booknest_broken; alter database $PROD_POSTGRES_DB rename to booknest_broken;"
docker compose exec -T db-prod createdb -U "$PROD_POSTGRES_USER" "$PROD_POSTGRES_DB"
docker compose exec -T db-prod pg_restore -U "$PROD_POSTGRES_USER" -d "$PROD_POSTGRES_DB" \
  --no-owner --no-privileges < "backups/restore/$latest"

docker compose start api-prod               # boots, runs prisma migrate deploy, reports healthy
docker compose ps api-prod
curl -fsS https://book-nest.net/api/health
./maintenance.sh off
```

Renaming the broken database instead of dropping it keeps the evidence. Drop `booknest_broken` once the restored site has been checked.

The API container runs `prisma migrate deploy` on boot. The dump includes `_prisma_migrations`, so a dump taken before a later deploy simply gets the newer migrations applied on start. A dump taken after the current image's migrations is also fine: deploy sees nothing pending.

## Restoring a prod copy into dev

Useful before a risky migration: restore last night's prod into `db-dev` and let `api-dev` migrate it.

```sh
docker compose stop api-dev
docker compose exec -T db-dev psql -U "$DEV_POSTGRES_USER" -d postgres -c \
  "drop database if exists $DEV_POSTGRES_DB; create database $DEV_POSTGRES_DB;"
docker compose exec -T db-dev pg_restore -U "$DEV_POSTGRES_USER" -d "$DEV_POSTGRES_DB" \
  --no-owner --no-privileges < "backups/restore/$latest"
docker compose start api-dev
```

## What to check when a backup fails

```sh
systemctl list-timers booknest-backup.timer
systemctl status booknest-backup.service
journalctl -u booknest-backup.service --since yesterday
ls -la ~/booknest/backups/prod/
```

The script stops at the first failing step, so the last `>>>` line in the journal names the stage: dump, verify, upload, or prune. An empty `BACKUP_R2_*` value means the GitHub secret is missing and the deploy rendered a blank `.env` line.

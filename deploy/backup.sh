#!/bin/sh
set -eu

cd "$(dirname "$0")"

ENV="${1:-}"
case "$ENV" in
	prod | dev) ;;
	*)
		echo "usage: backup.sh prod|dev" >&2
		exit 1
		;;
esac

if [ -f .env ]; then
	set -a
	. ./.env
	set +a
fi

case "$ENV" in
	prod)
		pg_user="${PROD_POSTGRES_USER:-booknest}"
		pg_db="${PROD_POSTGRES_DB:-booknest}"
		;;
	dev)
		pg_user="${DEV_POSTGRES_USER:-booknest}"
		pg_db="${DEV_POSTGRES_DB:-booknest}"
		;;
esac

: "${BACKUP_R2_ACCESS_KEY_ID:?set BACKUP_R2_ACCESS_KEY_ID in .env}"
: "${BACKUP_R2_SECRET_ACCESS_KEY:?set BACKUP_R2_SECRET_ACCESS_KEY in .env}"
: "${BACKUP_R2_ENDPOINT:?set BACKUP_R2_ENDPOINT in .env}"
bucket="${BACKUP_R2_BUCKET:-book-nest-backups}"
provider="${BACKUP_S3_PROVIDER:-Cloudflare}"
local_keep_days="${BACKUP_LOCAL_KEEP_DAYS:-7}"
remote_keep_days="${BACKUP_REMOTE_KEEP_DAYS:-30}"
rclone_image="rclone/rclone:1.75"

db_service="db-$ENV"
dir="$PWD/backups/$ENV"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="booknest-$ENV-$stamp.dump"
file="$dir/$name"

mkdir -p "$dir"
find "$dir" -name '*.partial' -delete

rclone() {
	docker run --rm \
		-v "$dir:/backups:ro" \
		-e RCLONE_CONFIG_R2_TYPE=s3 \
		-e RCLONE_CONFIG_R2_PROVIDER="$provider" \
		-e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID" \
		-e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY" \
		-e RCLONE_CONFIG_R2_ENDPOINT="$BACKUP_R2_ENDPOINT" \
		-e RCLONE_CONFIG_R2_REGION=auto \
		-e RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true \
		"$rclone_image" "$@"
}

echo ">>> dumping $db_service ($pg_db) to $file"
docker compose exec -T "$db_service" \
	pg_dump -U "$pg_user" -d "$pg_db" --format=custom --no-owner --no-privileges \
	> "$file.partial"

docker compose exec -T "$db_service" pg_restore --list < "$file.partial" > /dev/null
mv "$file.partial" "$file"
echo ">>> dump verified, $(wc -c < "$file") bytes"

echo ">>> uploading to r2:$bucket/$ENV/$name"
rclone copy "/backups/$name" "r2:$bucket/$ENV/"
rclone lsl "r2:$bucket/$ENV/$name" | grep -q "$name"
echo ">>> upload verified"

echo ">>> pruning remote copies older than ${remote_keep_days}d and local copies older than ${local_keep_days}d"
rclone delete "r2:$bucket/$ENV/" --min-age "${remote_keep_days}d"
find "$dir" -name '*.dump' -mtime +"$local_keep_days" -delete

echo ">>> backup done: $name"

#!/bin/sh
set -e

ENV="${1:-}"
case "$ENV" in
	dev)
		SVC=db-dev
		PORT=5433
		;;
	prod)
		SVC=db-prod
		PORT=5434
		;;
	*)
		echo "usage: scripts/copy-remote-db.sh dev|prod" >&2
		exit 1
		;;
esac

SERVER="deploy@46.224.83.71"
KEY="$HOME/.ssh/id_ed25519_hetzner"
REMOTE_COMPOSE="docker compose -f ~/booknest/docker-compose.yml"
CONTAINER="booknest-${ENV}-copy"
DUMP="/tmp/booknest_${ENV}_dump.sql"

echo "==> dumping '$ENV' database from server"
ssh -i "$KEY" -o BatchMode=yes "$SERVER" "$REMOTE_COMPOSE exec -T $SVC pg_dump -U booknest booknest" > "$DUMP"

echo "==> (re)creating local copy container '$CONTAINER' on port $PORT"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
	-e POSTGRES_USER=booknest \
	-e POSTGRES_PASSWORD=booknest_dev_2026 \
	-e POSTGRES_DB=booknest \
	-p "127.0.0.1:${PORT}:5432" \
	postgres:17-alpine >/dev/null

echo "==> waiting for Postgres"
until docker exec "$CONTAINER" pg_isready -U booknest -d booknest >/dev/null 2>&1; do sleep 1; done

echo "==> loading dump into the copy"
docker exec -i "$CONTAINER" psql -U booknest -d booknest -q < "$DUMP"

echo ""
echo "Done. '$ENV' copy is running:"
echo "  host=localhost  port=$PORT  user=booknest  password=booknest_dev_2026  db=booknest"
echo "  remove when done:  docker rm -f $CONTAINER"

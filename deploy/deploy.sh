#!/bin/sh
set -e

cd "$(dirname "$0")"

MODE="${1:-}"
if [ "$MODE" = "rollback" ]; then
	ENV="${2:-}"
else
	ENV="$MODE"
fi
case "$ENV" in
	prod)
		services="api-prod web-prod"
		api="api-prod"
		;;
	dev)
		services="api-dev web-dev"
		api="api-dev"
		;;
	all)
		services=""
		api=""
		;;
	*)
		echo "usage: deploy.sh prod|dev|all | deploy.sh rollback prod|dev" >&2
		exit 1
		;;
esac

image_ref="ghcr.io/srh-yakovenko-ua/booknest-api:${ENV}"
maintenance_flag="maintenance/prod.on"

maintenance_on() {
	[ "$ENV" = "prod" ] || return 0
	mkdir -p maintenance
	: > "$maintenance_flag"
	echo ">>> maintenance page is up"
}

maintenance_off() {
	[ "$ENV" = "prod" ] || return 0
	rm -f "$maintenance_flag"
	echo ">>> maintenance page is down"
}

previous_image_file=".previous-api-image.${ENV}"

wait_until_healthy() {
	cid="$(docker compose ps -q "$1")"
	i=0
	while [ "$i" -lt 40 ]; do
		st="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)"
		if [ "$st" = "healthy" ]; then
			return 0
		fi
		i=$((i + 1))
		sleep 3
	done
	return 1
}

roll_back_api() {
	target="$1"
	if [ -z "$target" ]; then
		echo ">>> no previous image recorded for $api, nothing to roll back to" >&2
		return 1
	fi
	echo ">>> rolling back $api to previous image $target" >&2
	docker tag "$target" "$image_ref"
	docker compose up -d --no-deps "$api"
	if wait_until_healthy "$api"; then
		echo ">>> rollback done, $api is healthy again" >&2
		return 0
	fi
	echo ">>> rollback finished but $api is still not healthy" >&2
	return 1
}

if [ "$MODE" = "rollback" ]; then
	[ -n "$api" ] || {
		echo "rollback needs prod or dev" >&2
		exit 1
	}
	roll_back_api "$(cat "$previous_image_file" 2>/dev/null || true)"
	exit $?
fi

prev_image=""
if [ -n "$api" ]; then
	cur_cid="$(docker compose ps -q "$api" 2>/dev/null || true)"
	if [ -n "$cur_cid" ]; then
		prev_image="$(docker inspect -f '{{.Image}}' "$cur_cid" 2>/dev/null || true)"
	fi
	if [ -n "$prev_image" ]; then
		printf '%s\n' "$prev_image" > "$previous_image_file"
	fi
fi

docker compose up -d --no-deps caddy
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null || docker compose up -d --force-recreate --no-deps caddy

trap maintenance_off EXIT HUP INT TERM
maintenance_on

docker compose pull $services
docker compose up -d $services

docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null || docker compose up -d --force-recreate --no-deps caddy

if [ -n "$api" ]; then
	if ! wait_until_healthy "$api"; then
		echo ">>> $api did not become healthy after deploy" >&2
		docker compose logs --no-color --tail=40 "$api" || true
		roll_back_api "$prev_image" || true
		docker image prune -f || true
		exit 1
	fi
fi

docker image prune -f || true

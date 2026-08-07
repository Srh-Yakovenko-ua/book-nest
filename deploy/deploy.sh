#!/bin/sh
set -e

cd "$(dirname "$0")"

ENV="${1:-}"
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
		echo "usage: deploy.sh prod|dev|all" >&2
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

prev_image=""
if [ -n "$api" ]; then
	cur_cid="$(docker compose ps -q "$api" 2>/dev/null || true)"
	if [ -n "$cur_cid" ]; then
		prev_image="$(docker inspect -f '{{.Image}}' "$cur_cid" 2>/dev/null || true)"
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
	cid="$(docker compose ps -q "$api")"
	healthy=""
	i=0
	while [ "$i" -lt 40 ]; do
		st="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)"
		if [ "$st" = "healthy" ]; then
			healthy=yes
			break
		fi
		i=$((i + 1))
		sleep 3
	done

	if [ -z "$healthy" ]; then
		echo ">>> $api did not become healthy after deploy" >&2
		docker compose logs --no-color --tail=40 "$api" || true
		if [ -n "$prev_image" ]; then
			echo ">>> rolling back $api to previous image $prev_image" >&2
			docker tag "$prev_image" "$image_ref"
			docker compose up -d --no-deps "$api"
			echo ">>> rollback done" >&2
		else
			echo ">>> no previous image to roll back to (first deploy?)" >&2
		fi
		docker image prune -f || true
		exit 1
	fi
fi

docker image prune -f || true

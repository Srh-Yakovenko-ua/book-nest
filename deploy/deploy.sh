#!/bin/sh
set -e

cd "$(dirname "$0")"

ENV="${1:-}"
case "$ENV" in
	prod) services="api-prod web-prod" ;;
	dev) services="api-dev web-dev" ;;
	all) services="" ;;
	*)
		echo "usage: deploy.sh prod|dev|all" >&2
		exit 1
		;;
esac

docker compose pull $services
docker compose up -d $services
docker image prune -f

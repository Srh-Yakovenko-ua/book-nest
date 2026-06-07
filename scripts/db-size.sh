#!/bin/sh
set -e

SERVER="deploy@46.224.83.71"
KEY="$HOME/.ssh/id_ed25519_hetzner"

ssh -i "$KEY" -o BatchMode=yes "$SERVER" 'cd ~/booknest && bash -s' <<'REMOTE'
echo ""
echo "  ┌─ book-nest · server nest-book ──────────────────"
echo "  │"
df -h / | awk 'NR==2 {printf "  │  DISK   used %s of %s (%s used), %s free\n", $3, $2, $5, $4}'
echo "  │"
echo "  │  DATABASE        volume (disk)   data (logical)"
for env in prod dev; do
	vol=$(docker system df -v 2>/dev/null | awk -v e="$env" '$1=="booknest_db-"e"-data" {print $3}')
	dat=$(docker compose exec -T "db-$env" psql -U booknest -d booknest -tAc "SELECT pg_size_pretty(pg_database_size('booknest'));" 2>/dev/null | tr -d '[:space:]')
	printf "  │  %-14s %-15s %s\n" "$env" "${vol:-?}" "${dat:-down}"
done
echo "  │"
echo "  └─────────────────────────────────────────────────"
echo ""
REMOTE

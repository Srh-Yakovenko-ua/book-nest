#!/bin/sh
set -e

SERVER="deploy@46.224.83.71"
KEY="$HOME/.ssh/id_ed25519_hetzner"

ssh -i "$KEY" -o BatchMode=yes "$SERVER" 'cd ~/booknest && bash -s' <<'REMOTE'
echo ""
echo "  book-nest · server nest-book — containers"
echo ""
docker compose ps --all --format "table   {{.Name}}\t{{.Service}}\t{{.Status}}"
echo ""
echo "  running: $(docker ps -q | wc -l | tr -d ' ')"
echo ""
REMOTE

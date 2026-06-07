#!/bin/sh
set -e

SERVER="deploy@46.224.83.71"
KEY="$HOME/.ssh/id_ed25519_hetzner"

ssh -i "$KEY" -o BatchMode=yes "$SERVER" 'bash -s' <<'REMOTE'
echo ""
echo "  book-nest · server nest-book — resources"
echo ""
echo "  RAM:"
free -h | awk '/^Mem:/{printf "    used %s of %s · free %s · cache %s\n", $3, $2, $4, $6}'
echo ""
echo "  DISK:"
df -h / | awk 'NR==2{printf "    used %s of %s (%s)\n", $3, $2, $5}'
echo ""
echo "  per container (CPU · MEM):"
docker stats --no-stream --format "    {{.Name}}  ·  {{.CPUPerc}}  ·  {{.MemUsage}}"
echo ""
REMOTE

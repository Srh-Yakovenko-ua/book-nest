#!/bin/sh
set -e

SERVICE="${1:-}"
LINES="${2:-100}"
SERVER="deploy@46.224.83.71"
KEY="$HOME/.ssh/id_ed25519_hetzner"

ssh -i "$KEY" -o BatchMode=yes "$SERVER" "cd ~/booknest && docker compose logs --no-color --tail=$LINES $SERVICE"

#!/usr/bin/env bash
set -u

command -v jq >/dev/null 2>&1 || echo "WARNING: jq is not on PATH. The .claude/hooks/*.sh hooks parse their input with jq, so right now guard-bash and guard-files allow every command and file, claims-check never blocks, and subagents start without the report envelope or the no-tooling rules. Install jq (winget install jqlang.jq, brew install jq), then restart the app the terminal runs in, because a terminal keeps the PATH it started with. Until then follow the hook rules in CLAUDE.md §9 by hand and tell the user."

INPUT="$(cat)"
SOURCE="$(printf '%s' "$INPUT" | jq -r '.source // empty')"
SESSION_ID="$(printf '%s' "$INPUT" | jq -r '.session_id // empty')"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
STATE_ROOT="$PROJECT_DIR/.claude/state"
cd "$PROJECT_DIR" || exit 0

port_open() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

if [ -d "$STATE_ROOT" ]; then
  find "$STATE_ROOT" -type f -mtime +7 -delete 2>/dev/null
  find "$STATE_ROOT" -mindepth 1 -type d -empty -delete 2>/dev/null
fi

DOWN=""
port_open 5432 || DOWN="$DOWN postgres:5432"
port_open 6379 || DOWN="$DOWN redis:6379"
port_open 1025 || DOWN="$DOWN mailpit:1025"
[ -n "$DOWN" ] && echo "Local stack down:$DOWN. API tests and data endpoints need all three: docker compose up -d db redis mailpit."

port_open 5533 && echo "WARNING: an SSH tunnel to the live PROD database is open on :5533. Anything pointed at that port reads and writes real user data."
port_open 5532 && echo "WARNING: an SSH tunnel to the live DEV server database is open on :5532."

CLIENT="apps/api/src/generated/prisma/client.ts"
if [ ! -f "$CLIENT" ] || [ apps/api/prisma/schema.prisma -nt "$CLIENT" ]; then
  echo "Prisma client is older than schema.prisma: run pnpm --filter @app/api db:generate before trusting a typecheck."
fi

SHARED_DIST="packages/shared/dist/index.js"
if [ ! -f "$SHARED_DIST" ] || [ -n "$(find packages/shared/src -name '*.ts' -newer "$SHARED_DIST" 2>/dev/null | head -1)" ]; then
  echo "packages/shared/dist is older than its src: new exports read as undefined in local vitest until pnpm --filter @app/shared build."
fi

SNAPSHOT="$STATE_ROOT/$SESSION_ID/compact-snapshot.md"
if [ "$SOURCE" = "compact" ] && [ -n "$SESSION_ID" ] && [ -f "$SNAPSHOT" ]; then
  cat "$SNAPSHOT"
fi
exit 0

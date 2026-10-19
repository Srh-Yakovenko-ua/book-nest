#!/usr/bin/env bash
set -u

usage() {
  echo "usage: .claude/scripts/ux-lookup.sh <ux|chart|icons|react|shadcn> \"<query>\"" >&2
  exit 1
}

[ $# -eq 2 ] || usage
TOPIC="$1"
QUERY="$2"
case "$QUERY" in "" | -*) usage ;; esac
case "$TOPIC" in
  ux | chart | icons | react) MODE="-d" ;;
  shadcn) MODE="-s" ;;
  *) usage ;;
esac

PLUGIN_ROOT="$(ls -d "$HOME"/.claude/plugins/cache/ui-ux-pro-max-skill/ui-ux-pro-max/*/ 2>/dev/null | sort -V | tail -1)"
SEARCH="${PLUGIN_ROOT}.claude/skills/ui-ux-pro-max/scripts/search.py"
if [ ! -f "$SEARCH" ]; then
  echo "ui-ux-pro-max is not installed on this machine; continue without the lookup."
  exit 0
fi

python3 -B -E -s "$SEARCH" "$QUERY" "$MODE" "$TOPIC" -n 3
echo "Input, not authority: CLAUDE.md, the Terracotta tokens and the scale-token rule win where this disagrees (raw hex colors, memoization advice, server-side data fetching)."

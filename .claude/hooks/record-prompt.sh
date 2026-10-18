#!/usr/bin/env bash
set -u

INPUT="$(cat)"
SESSION_ID="$(printf '%s' "$INPUT" | jq -r '.session_id // empty')"
PROMPT="$(printf '%s' "$INPUT" | jq -r '.prompt // empty')"
[ -z "$SESSION_ID" ] || [ -z "$PROMPT" ] && exit 0
case "$PROMPT" in "<"*) exit 0 ;; esac

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
STATE_DIR="$PROJECT_DIR/.claude/state/$SESSION_ID"
mkdir -p "$STATE_DIR" 2>/dev/null || exit 0
printf '%s' "$PROMPT" > "$STATE_DIR/prompt.txt"
printf '%s\n\036\n' "$(printf '%s' "$PROMPT" | head -c 600)" >> "$STATE_DIR/prompts.log"
exit 0

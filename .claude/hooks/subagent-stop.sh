#!/usr/bin/env bash
set -u

INPUT="$(cat)"
[ "$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
AGENT_TYPE="$(printf '%s' "$INPUT" | jq -r '.agent_type // empty')"
AGENT_ID="$(printf '%s' "$INPUT" | jq -r '.agent_id // empty')"
MESSAGE="$(printf '%s' "$INPUT" | jq -r '.last_assistant_message // empty')"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

[ -z "$AGENT_TYPE" ] || [ -z "$AGENT_ID" ] || [ -z "$MESSAGE" ] && exit 0
[ "$AGENT_TYPE" = "general-purpose" ] || [ -f "$PROJECT_DIR/.claude/agents/$AGENT_TYPE.md" ] || exit 0

FIRST_LINE="$(printf '%s\n' "$MESSAGE" | grep -v '^[[:space:]]*$' | head -1)"
case "$FIRST_LINE" in "{"* | "["*) exit 0 ;; esac
printf '%s' "$FIRST_LINE" | grep -qE '^[[:space:]*_#`>]*STATUS:' && exit 0

MARK_DIR="$PROJECT_DIR/.claude/state/envelope"
mkdir -p "$MARK_DIR" 2>/dev/null || exit 0
[ -f "$MARK_DIR/$AGENT_ID" ] && exit 0
: > "$MARK_DIR/$AGENT_ID"

echo "Your final report must start with 'STATUS: DONE|PARTIAL|BLOCKED|NEEDS_DECISION' and follow the envelope sections given at the start of this task. Re-emit the report in that shape now. Do not redo or re-verify any work." >&2
exit 2

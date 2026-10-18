#!/usr/bin/env bash
set -u

INPUT="$(cat)"
SESSION_ID="$(printf '%s' "$INPUT" | jq -r '.session_id // empty')"
[ -z "$SESSION_ID" ] && exit 0
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
STATE_DIR="$PROJECT_DIR/.claude/state/$SESSION_ID"
mkdir -p "$STATE_DIR" 2>/dev/null || exit 0
cd "$PROJECT_DIR" || exit 0

{
  echo "## State before compaction"
  echo "branch: $(git branch --show-current 2>/dev/null)"
  echo "### git status --short"
  git status --short 2>/dev/null | head -30
  if [ -f "$STATE_DIR/edited.log" ]; then
    echo "### files edited this session, most recent last"
    awk '{ last[$0] = NR } END { for (f in last) print last[f] "\t" f }' "$STATE_DIR/edited.log" \
      | sort -n | tail -20 | cut -f2- | sed "s#^$PROJECT_DIR/##"
  fi
  if [ -f "$STATE_DIR/prompts.log" ]; then
    echo "### last user prompts, oldest first"
    awk 'BEGIN { RS = "\n\036\n" } { prompts[NR] = $0 } END { start = NR > 3 ? NR - 2 : 1; for (i = start; i <= NR; i++) print "> " prompts[i] }' "$STATE_DIR/prompts.log"
  fi
} > "$STATE_DIR/compact-snapshot.md"
exit 0

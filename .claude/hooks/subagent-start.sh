#!/usr/bin/env bash
set -u

INPUT="$(cat)"
AGENT_TYPE="$(printf '%s' "$INPUT" | jq -r '.agent_type // empty')"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

[ -z "$AGENT_TYPE" ] && exit 0
[ "$AGENT_TYPE" = "general-purpose" ] || [ -f "$PROJECT_DIR/.claude/agents/$AGENT_TYPE.md" ] || exit 0

ENVELOPE="$(cat <<'TEXT'
## Report envelope (the main loop parses it)
Your final message starts with exactly one line:
STATUS: DONE | PARTIAL | BLOCKED | NEEDS_DECISION
then these sections, each left out when empty:
CHANGED: files you wrote, one path per line
VERIFIED: what you observed yourself, with the file:line or output that proves it
NOT_VERIFIED: every check you did not run, one per line: `MAIN: <exact command>` for a non-test gate the main loop runs, `CI: <test file>` for each test you wrote or that covers your change (tests run only in CI, never on this machine), `EXTERNAL: <what>` for anything that needs a human, a browser or a server
FINDINGS: for reviews and audits, one line each: `<severity> <file:line> <claim> (basis: doc|rule|smell|bug)`
QUESTION: only with NEEDS_DECISION: one decision, its options, your recommendation
NEXT: one line, only for PARTIAL or BLOCKED

Write for a reader who already knows the brief: no recap, no pasted file contents, no narration of steps. PARTIAL and BLOCKED are honest outcomes; DONE over an unrun check is not.
TEXT
)"

RULES="$(cat <<'TEXT'
## Hard rules in this repo
- Do not run typecheck, lint, format, vitest, build, knip, prisma, codegen, dev servers or package installs. A hook denies them, so do not route around it through npx, node_modules/.bin or a script. Record each one as a MAIN: line instead.
- Never commit, push, stage, switch branches, or create, edit or merge a PR.
- Do not drive a browser. The main loop checks the UI once through Chrome MCP; list it as `EXTERNAL: browser <route>, <state>, 375 and 1280 wide`.
- Before you report that something does not exist, run the same search for a string you know exists. An empty result from a broken search reads exactly like absence.
- Before you report DONE on code you wrote, re-read your own diff once as its reviewer and fix what you find: a state left unhandled (loading, error, empty, pending, null), a caller of a changed signature you did not open, a key missing from one locale, a test that would still pass with your change reverted. The first plausible version is where defects hide; the reviewer after you costs a full round. Do not polish beyond the brief.
- Where your agent definition contradicts this block or CLAUDE.md (old stack names, "run all gates" checklists), this block and CLAUDE.md win.
TEXT
)"

if [ "$AGENT_TYPE" = "release-manager" ]; then
  CONTEXT="$ENVELOPE"
else
  CONTEXT="$ENVELOPE

$RULES"
fi

jq -n --arg c "$CONTEXT" '{hookSpecificOutput:{hookEventName:"SubagentStart",additionalContext:$c}}'
exit 0

#!/usr/bin/env bash
set -u

[ "${BOOKNEST_CLAIMS_CHECK:-1}" = "0" ] && exit 0
command -v jq >/dev/null 2>&1 || exit 0

INPUT="$(cat 2>/dev/null)" || exit 0
printf '%s' "$INPUT" | jq -e '.stop_hook_active == true' >/dev/null 2>&1 && exit 0

TRANSCRIPT="$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)"
[ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ] || exit 0

MESSAGE="$(printf '%s' "$INPUT" | jq -r '.last_assistant_message // empty' 2>/dev/null)"
if [ -z "$MESSAGE" ]; then
  MESSAGE="$(tail -n 200 "$TRANSCRIPT" | jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text' 2>/dev/null | tail -c 3000)"
fi
[ -n "$MESSAGE" ] || exit 0

CLAIM='\b(done|fixed|verified|passes|passed|completed)\b|(Г|г)отово|(С|с)делано|(С|с)делал|(П|п)ровер(ил|ено|ен)|(И|и)справ(ил|лено|лен)|(П|п)очинил|(З|з)роблено|(З|з)робив|(В|в)иправ(ив|лено)|(П|п)еревір(ив|ено)'
SPLIT='NOT_VERIFIED|Missing|[Nn]ot verified|[Uu]nverified|(Н|н)е провер|(Н|н)е запуск|(Н|н)е перевір|CI-only|CI:|MAIN:|EXTERNAL:'
printf '%s' "$MESSAGE" | grep -qiE "$CLAIM" || exit 0
printf '%s' "$MESSAGE" | grep -qE "$SPLIT" && exit 0

CHECKS='gates\.sh|test-hooks\.sh|eslint|vitest|curl\s|gh\s+run\s+(view|watch)|pnpm\s+(typecheck|lint|test|build|knip)|tsc\s|bash\s+-n\s|prisma\s+(validate|migrate\s+status)'

TURN="$(tail -n 600 "$TRANSCRIPT" | jq -cs --arg checks "$CHECKS" '
  def text_of: if type == "string" then . elif type == "array" then (map(select(.type == "text") | .text) | join("\n")) else "" end;
  def is_notif: .type == "user" and ((.message.content | type) == "string") and (.message.content | startswith("<task-notification>"));
  def is_prompt: .type == "user" and (.isMeta != true) and (.isCompactSummary != true)
    and (((.message.content | type) == "string") or any(.message.content[]?; .type == "text"));
  def is_none: gsub("[*_`]"; "") | sub("^[ \\t-]+"; "") | ascii_downcase | test("^(none|nothing)?([ ]*[.;:,(—–-].*)?$");
  def is_key: test("^[ *_>#-]*(STATUS|CHANGED|VERIFIED|NOT_VERIFIED|FINDINGS|QUESTION|NEXT)[ *_]*:");
  def take_until(f): reduce .[] as $x ({out: [], stop: false}; if .stop or ($x | f) then .stop = true else .out += [$x] end) | .out;
  def section($name):
    split("\n") as $l
    | ([range(0; $l | length) | select($l[.] | test("^[ *_>#-]*" + $name + "[ *_]*:"))] | first) as $k
    | if $k == null then []
      else ([$l[$k] | sub("^[ *_>#-]*" + $name + "[ *_]*:"; "")] + ($l[$k + 1:] | take_until(is_key)))
        | map(select(test("\\S")) | select(is_none | not))
      end;
  def is_code_path: test("\\.md$|/memory/|^/private/tmp/|^/tmp/|/\\.claude/state/") | not;
  def first_path: gsub("[`*]"; "") | sub("^[ \\t>-]+"; "") | split(" ")[0];
  map(select(.type == "user" or .type == "assistant")) as $m
  | ([$m | to_entries[] | select(.value | is_prompt) | .key] | last // 0) as $i0
  | def back: if . > 0 and ($m[. - 1] | is_notif) then (. - 1 | back) else . end;
    (if ($m[$i0] | is_notif) then ($i0 | back) else $i0 end) as $i
  | $m[$i:] as $w
  | [$w[] | select(.type == "assistant") | .message.content[]? | select(.type == "tool_use")] as $calls
  | ([$w[] | select(.type == "user") | .message.content | select(type == "array") | .[] | select(.type == "tool_result")
      | {(.tool_use_id // "-"): (.content | text_of)}] | add // {}) as $res
  | ([$calls[] | select(.name == "Agent")
      | {name: ((.input.subagent_type // "general-purpose") + (if .input.description then " (\(.input.description))" else "" end)),
         text: ($res[.id] // "")}]
     + [$w[] | select(is_notif) | .message.content
        | {name: ((capture("<summary>Agent \"(?<s>[^\"]*)\"").s) // (capture("<summary>(?<s>[^<]*)</summary>").s) // "a background agent"),
           text: ((capture("<result>(?<r>[\\s\\S]*?)(</result>|$)").r) // "")}]) as $runs
  | {main_edits: [$calls[] | select(.name == "Edit" or .name == "Write" or .name == "NotebookEdit")
                  | (.input.file_path // .input.notebook_path // "") | select(is_code_path)],
     agent_edits: [$runs[] | select([.text | section("CHANGED")[] | first_path | select(is_code_path)] | length > 0) | .name],
     checks: (([$calls[] | select(.name == "Bash") | (.input.command // "") | select(test($checks))] | length)
              + ([$calls[] | select(.name | startswith("mcp__claude-in-chrome__"))] | length)),
     open_nv: [$runs[] | select((.text | section("NOT_VERIFIED")) | length > 0) | .name] | unique}' 2>/dev/null)"
[ -n "$TURN" ] || exit 0

REASONS=""
add_reason() { REASONS="${REASONS:+$REASONS

}$1"; }

OPEN_NV="$(printf '%s' "$TURN" | jq -r '.open_nv | join(", ")')"
[ -n "$OPEN_NV" ] && add_reason "The returns of $OPEN_NV carry a NOT_VERIFIED that this message leaves out. Relay each item under NOT_VERIFIED or Missing (its MAIN:, CI: and EXTERNAL: lines), so an unchecked part is never read as a checked one."

if printf '%s' "$TURN" | jq -e '((.main_edits | length) + (.agent_edits | length)) > 0 and .checks == 0' >/dev/null 2>&1; then
  add_reason "This turn changed code and ends on a claim with no check behind it (a read or a grep is not one). Run the cheap check that shows the change works (eslint on the file, a curl, the one Chrome MCP pass, test-hooks.sh for a hook), or end with NOT_VERIFIED / Missing: what was not run and where it runs (CI: <test file>, MAIN: <gate at commit>)."
fi

[ -n "$REASONS" ] || exit 0
jq -n --arg r "$REASONS" '{decision: "block", reason: $r}'
exit 0

#!/usr/bin/env bash
set -u
set -f

INPUT="$(cat)"
RAW="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)"
[ -z "$RAW" ] && exit 0
AGENT_ID="$(printf '%s' "$INPUT" | jq -r '.agent_id // empty' 2>/dev/null)"
AGENT_TYPE="$(printf '%s' "$INPUT" | jq -r '.agent_type // empty' 2>/dev/null)"
SESSION_ID="$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)"
CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

CODE="$(printf '%s' "$RAW" | perl -0777 -pe '
  s/<<-?\s*([\x27"]?)(\w+)\1([^\n]*)\n.*?\n[ \t]*\2[ \t]*(?=\n|$)/<<$2$3/gs;
  s/\x27[^\x27]*\x27/\x27\x27/g;
  s/"(?:[^"\\]|\\.)*"/""/gs;
')"

DENY=""
ASK=""
deny() { [ -z "$DENY" ] && DENY="$1"; return 0; }
ask() { [ -z "$ASK" ] && ASK="$1"; return 0; }
in_code() { printf '%s' "$CODE" | grep -qE -- "$1"; }
in_raw() { printf '%s' "$RAW" | grep -qE -- "$1"; }
in_raw_i() { printf '%s' "$RAW" | grep -qiE -- "$1"; }

Q="[\"']?"
S='(^|[;&|(`]|\$\()[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*'
G='git([[:space:]]+(-C|-c)[[:space:]]+[^[:space:]]+|[[:space:]]+--no-pager|[[:space:]]+--(git-dir|work-tree)[= ][^[:space:]]+)*[[:space:]]+'
A='([^|;&]*[[:space:]])?'
PNPM_OPTS='([[:space:]]+(-w|-r|-s|--recursive|--workspace-root|--silent|--filter[= ][^[:space:]]+|-F[[:space:]]+[^[:space:]]+|-C[[:space:]]+[^[:space:]]+|--dir[= ][^[:space:]]+))*'

IS_COMMIT=0
IS_PROSE=0
in_code "${G}commit([[:space:]]|$)" && IS_COMMIT=1
in_code "gh[[:space:]]+(pr|issue|release)[[:space:]]+(create|edit|comment|review)|${G}tag[[:space:]]+${A}-[amF]|${G}merge[[:space:]]+${A}-m" && IS_PROSE=1

check_server_databases() {
  local server_port="(:553[23]([^0-9]|$)|-p[[:space:]]*553[23]([^0-9]|$)|PGPORT=${Q}553[23]|port=553[23])"
  local server_env="APP_ENV=${Q}(prod|dev)${Q}([[:space:]]|$)"
  local db_write='(db:migrate(:deploy|:reset)?([[:space:]]|$)|db:test:clean|migrate[[:space:]]+(deploy|dev|reset|resolve)|db[[:space:]]+(push|execute)|seed)'
  local sql_write='(^|[^A-Za-z_])(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|COPY)[[:space:]]'
  local server_env_file='\.env\.(prod|dev|stage)(\.readonly)?([^.A-Za-z]|$)'

  if in_raw "$server_env" && in_raw "$db_write"; then
    deny "APP_ENV=prod|dev points prisma at the live server database through the tunnel. Migrations and seeds reach prod only through the API container boot (docker-entrypoint.sh). For a pre-flight use pnpm db:copy:prod with APP_ENV=prodcopy."
  fi
  if in_raw "$server_port" && { in_raw_i "$sql_write" || in_raw "$db_write"; }; then
    deny "Port 5532/5533 is the SSH tunnel to the live dev/prod database. Writes there never run from this machine. Read-only queries are fine; a data fix goes through a reviewed migration, or the user runs it."
  fi
  if in_code "$server_env_file" || { [ "$IS_COMMIT" = 0 ] && [ "$IS_PROSE" = 0 ] && in_raw "$server_env_file"; }; then
    deny "That file holds live server credentials. Ask the user for the specific value you need."
  fi
  if in_code "${S}ssh[[:space:]]" || in_code "${S}pnpm${PNPM_OPTS}[[:space:]]+(run[[:space:]]+)?(server:ssh|tunnel:(prod|dev))([[:space:]]|$)"; then
    ask "Opens a shell or tunnel to the production server (46.224.83.71). Read-only status lives in pnpm server:ps|stats|logs|health."
  fi
  if in_code "${S}pnpm${PNPM_OPTS}[[:space:]]+(run[[:space:]]+)?dev:(api|web):(prod|dev)([[:space:]]|$)"; then
    ask "Starts a local app wired to the live server database. Every request it serves reads and writes real user data."
  fi
}

check_local_data() {
  if in_code "(prisma[[:space:]]+db[[:space:]]+push|db:push)"; then
    deny "prisma db push bypasses the reviewed-migration flow and can drop columns silently. Use pnpm --filter @app/api db:migrate --name <snake_case> (create-only), review the SQL, then db:migrate:deploy."
  fi
  if in_code "(migrate[[:space:]]+reset|db:migrate:reset)"; then
    ask "prisma migrate reset drops and recreates the local database, losing every local row."
  fi
  if in_code "docker[[:space:]]+compose[[:space:]]${A}down${A}(-v|--volumes)([[:space:]]|$)" \
    || in_code "docker[[:space:]]+volume[[:space:]]+(rm|prune)" \
    || in_code "docker[[:space:]]+system[[:space:]]+prune"; then
    ask "Removes Docker volumes: the local Postgres, Redis, MinIO and Mailpit data go with them."
  fi
  if in_raw_i 'redis-cli.*(flushall|flushdb)' || in_code "${S}dropdb[[:space:]]"; then
    ask "Wipes a local datastore outright."
  fi
  if in_raw '(psql|db[[:space:]]+execute|docker[[:space:]]+exec)'; then
    if in_raw_i 'DROP[[:space:]]+(DATABASE|SCHEMA|TABLE)|TRUNCATE[[:space:]]' \
      || { in_raw_i 'DELETE[[:space:]]+FROM' && ! in_raw_i 'WHERE[[:space:]]'; }; then
      ask "Destructive SQL (DROP / TRUNCATE / DELETE without WHERE) against a database."
    fi
  fi
}

check_git() {
  if in_code "${G}reset[[:space:]]+${A}--hard"; then
    deny "git reset --hard discards uncommitted work with no undo. Use git stash, or a new branch."
  fi
  if in_code "${G}clean[[:space:]]+${A}(-[a-zA-Z]*f|--force)"; then
    deny "git clean -f deletes untracked files outright (new migrations, local notes, .claude/state)."
  fi
  if in_code "${G}checkout[[:space:]]+${A}(--[[:space:]]+)?\.([[:space:]]|$)" \
    || in_code "${G}(checkout|switch)[[:space:]]+${A}(-f|--force|--discard-changes)([[:space:]]|$)"; then
    deny "That discards every uncommitted change in the tree."
  fi
  if in_code "${G}restore[[:space:]]+${A}\.([[:space:]]|$)" && ! in_code "${G}restore[[:space:]]+${A}(--staged|-S)([[:space:]]|$)"; then
    deny "git restore . discards every uncommitted change. git restore --staged . only unstages and is fine."
  fi
  if in_code "${G}branch[[:space:]]+${A}(-[a-zA-Z]*D|--delete[[:space:]]+--force|--force[[:space:]]+--delete)([[:space:]]|$)"; then
    deny "git branch -D force-deletes commits that may exist nowhere else. git branch -d checks the merge first."
  fi
  if in_code "${G}stash[[:space:]]+(clear|drop)"; then
    ask "Drops stashed work permanently."
  fi
  if in_code "${G}add[[:space:]]+${A}(-f|--force)([[:space:]]|$)"; then
    deny "git add -f stages a gitignored file, which is how .env secrets and the generated client end up committed."
  fi
  if in_code "${G}commit[[:space:]]+${A}--no-verify" || { in_raw '(^|[[:space:]])HUSKY=0' && [ "$IS_COMMIT" = 1 ]; }; then
    deny "Skipping the commit hooks skips commitlint and lint-staged. Fix what the hook reports instead."
  fi
  if in_code "${G}push([[:space:]]|$)"; then
    check_push
  fi
  if in_code "gh[[:space:]]+repo[[:space:]]+(delete|archive|edit|rename)" \
    || in_code "gh[[:space:]]+api[[:space:]]+${A}(-X|--method)[[:space:]]*DELETE" \
    || in_code "gh[[:space:]]+release[[:space:]]+delete"; then
    deny "Repository settings, deletions and releases are changed by the user, not from a session."
  fi
  if in_code "gh[[:space:]]+pr[[:space:]]+merge${A}--admin"; then
    ask "Merges a PR past branch protection (--admin)."
  elif in_code "gh[[:space:]]+pr[[:space:]]+merge"; then
    ask "Merges a PR. Merging is the user's call."
  fi
}

check_push() {
  local push_args positional arg branch
  push_args="$(printf '%s' "$CODE" | grep -oE "${G}push([[:space:]][^|;&]*)?" | head -1 | sed -E 's/^.*[[:space:]]push//')"
  if in_code "${G}push[[:space:]]+${A}(--force|--force-with-lease|--force-if-includes|-f|--mirror|\+[^[:space:]]+)([[:space:]]|$|=)"; then
    printf '%s' "$push_args" | grep -qE '(promote-(prod|stage)|release/)' \
      || deny "Force push rewrites published history. It is allowed only for the promote-prod / promote-stage / release/* branches that release-manager rebuilds."
  fi
  positional=0
  for arg in $push_args; do
    case "$arg" in
      -*) ;;
      *)
        positional=$((positional + 1))
        if [ "$positional" -ge 2 ] && printf '%s' "$arg" | grep -qE '^\+?([^:]*:)?(refs/heads/)?(prod|stage)$'; then
          deny "Direct pushes go only to dev. prod and stage change through a promote PR (release-manager)."
        fi
        ;;
    esac
  done
  if [ "$positional" -lt 2 ]; then
    branch="$(git -C "${CWD:-$PROJECT_DIR}" branch --show-current 2>/dev/null)"
    case "$branch" in prod | stage) deny "The current branch is $branch, so a bare push lands on it. Direct pushes go only to dev." ;; esac
  fi
}

check_ux_lookup_wrapper() {
  if in_raw 'ui-ux-pro-max' && in_raw 'search\.py'; then
    deny "Call .claude/scripts/ux-lookup.sh <ux|chart|icons|react|shadcn> \"<query>\" instead. The raw script can write design-system files into the repo, and its color and Next.js advice contradicts the Terracotta tokens and CLAUDE.md."
  fi
}

check_subagent_limits() {
  [ -z "$AGENT_ID" ] && return 0
  [ "$AGENT_TYPE" = "release-manager" ] && return 0
  local tooling="(${S}pnpm${PNPM_OPTS}[[:space:]]+(run[[:space:]]+|exec[[:space:]]+|dlx[[:space:]]+)?(typecheck|lint|format|test|build|knip|vitest|tsc|eslint|prettier|prisma|storybook|turbo|tsx|db|seed|gen|generate|backfill|dev|start|install|add|remove|update)([[:space:]:]|$)|${S}(npx|pnpx|bunx|npm|yarn)[[:space:]]|${S}(\./)?(node_modules/\.bin/)?(turbo|vitest|tsc|eslint|prettier|prisma|knip|tsx)([[:space:]]|$)|node[[:space:]]+${A}--import[[:space:]]+@swc-node|${S}((ba)?sh[[:space:]]+)?([^[:space:];&|]*/)?gates\.sh([[:space:]]|$))"
  local vcs_write="(${G}(commit|push|pull|merge|rebase|reset|checkout|switch|restore|stash|cherry-pick|revert|tag|am|add|clean)([[:space:]]|$)|${G}branch[[:space:]]+${A}(-[dDmMcCf]|--delete|--move|--copy|--force)|${G}worktree[[:space:]]+(remove|prune)|gh[[:space:]]+(pr|issue|release|repo|workflow|run)[[:space:]]+(create|merge|edit|close|reopen|comment|review|delete|rerun|cancel|run|enable|disable|ready)|gh[[:space:]]+api[[:space:]]+${A}(-X|--method)[[:space:]]*(POST|PATCH|PUT|DELETE))"
  if in_code "$tooling"; then
    deny "Subagents do not run gates, builds, codegen or package-manager tasks. Do not retry another way. Finish the edit, then list the check in your report under NOT_VERIFIED as 'MAIN: <exact command>'; the main loop runs it."
  fi
  if in_code "$vcs_write"; then
    deny "Subagents never commit, push, stage, switch branches or touch PRs. Leave the working tree as you changed it and list CHANGED files; the main loop owns git."
  fi
}

check_main_loop_gates() {
  [ -n "$AGENT_ID" ] && return 0
  local gate="(${S}(pnpm${PNPM_OPTS}[[:space:]]+(run[[:space:]]+|exec[[:space:]]+)?(typecheck|lint|format|test|knip|vitest|tsc|eslint|build|storybook)([[:space:]:]|$)|(npx[[:space:]]+)?(vitest|tsc|eslint|knip)([[:space:]]|$)|turbo[[:space:]]+run[[:space:]]+(test|typecheck|lint|build))|${S}((ba)?sh[[:space:]]+)?([^[:space:];&|]*/)?gates\.sh([[:space:]]|$))"
  local full_suite="${S}(pnpm([[:space:]]+(-w|-r|--recursive))*[[:space:]]+(run[[:space:]]+)?test|turbo[[:space:]]+run[[:space:]]+test|pnpm[[:space:]]+--filter[= ]@app/(api|web)[[:space:]]+(run[[:space:]]+)?test|pnpm[[:space:]]+knip)[[:space:]]*($|[;&|)])"
  local prompt_file="$PROJECT_DIR/.claude/state/${SESSION_ID:-none}/prompt.txt"
  in_code "$gate" || return 0
  [ -f "$prompt_file" ] || return 0
  local last
  last="$(cat "$prompt_file")"
  local test_run="${S}(pnpm${PNPM_OPTS}[[:space:]]+((run|exec)[[:space:]]+)?(test|vitest|test:storybook)([[:space:]:]|$)|(npx[[:space:]]+)?vitest([[:space:]]|$))|--with-tests"
  local test_words='тест|test|vitest|storybook'
  if in_code "$full_suite"; then
    refused_by_prompt "$last" "$test_words|knip" \
      && { ask "The user's last message says not to run tests. CI runs them."; return 0; }
    printf '%s' "$last" | grep -qiE 'полн|весь|все тест|всех тест|full|whole|suite|pnpm test|knip' \
      || ask "Full test suite (~7 min, pins the machine). Tests run in CI: every PR into dev/prod, every push to dev/prod, or gh workflow run ci.yml --ref <branch>. Locally only when the user asks for the full run."
    return 0
  fi
  if in_code "$test_run"; then
    refused_by_prompt "$last" "$test_words" \
      && { ask "The user's last message says not to run tests. CI runs them."; return 0; }
    printf '%s' "$last" | grep -qiE 'тест|(^|[^a-z])tests?([^a-z]|$)|vitest|storybook|красн|(^|[^a-z])red([^a-z]|$)|воспроизв|відтвор|repro' && return 0
    in_code '\.test\.tsx?([[:space:]]|$)' \
      && printf '%s' "$last" | grep -qiE 'баг|(^|[^a-z])bugs?([^a-z]|$)|не работа|не працю|слома|злама|пада|ошибк|помилк|(^|[^0-9])5[0-9]{2}([^0-9]|$)|crash|broken|fail|flaky|регресс|регрес' \
      && return 0
    ask "Tests run in CI, not on this machine (they saturate it). Locally only when the user asks for a test run, reports a bug (one test file as the repro), or to reproduce a red CI test."
    return 0
  fi
  local refused
  refused="$(refused_gate_families "$last")"
  if [ -n "$refused" ]; then
    ask "The user's last message says not to run: ${refused}. Run only the checks it asked for."
    return 0
  fi
  printf '%s' "$last" | grep -qiE '(^|[[:space:]])/[a-z]|commit|push|коммит|коміт|пуш|прогон|прогна|gate|гейт|typecheck|lint|линт|лінт|тест|test|knip|vitest|ревью|review|релиз|реліз|release|build|билд|білд|провер|перевір|check|verify|ci([^a-z]|$)' \
    || ask "No gates during development: they run once, when the user says commit / push / прогони. Approve to run this one anyway."
}

refused_by_prompt() {
  printf '%s' "$1" | perl -CSDA -Mutf8 -e '
    my $words = shift @ARGV;
    local $/;
    my $prompt = <STDIN> // "";
    $prompt =~ s/(не\s+забудь\S*|не\s+забут\S*|don.?t\s+forget)//gi;
    my ($asked, $refused) = (0, 0);
    for my $sentence (split /[.!?;\n]+/, $prompt) {
      next unless $sentence =~ /($words)/i;
      if ($sentence =~ /(^|[\s,(])(не|ні|без|never|without|no|don.?t|do\s+not)(\s|$)/i) { $refused = 1 } else { $asked = 1 }
    }
    exit(($refused && !$asked) ? 0 : 1);
  ' "$2"
}

refused_gate_families() {
  local prompt="$1" family words names=""
  for family in typecheck:'typecheck|tsc|типи|типы|тайпчек' lint:'lint|линт|лінт' format:'format|prettier|формат' build:'build|билд|білд|сборк|збірк' knip:'knip'; do
    words="${family#*:}"
    family="${family%%:*}"
    case "$family" in
      typecheck) in_code "(typecheck|tsc|gates\.sh)" || continue ;;
      lint) in_code "(lint|eslint|gates\.sh)" || continue ;;
      format) in_code "(format|prettier|gates\.sh)" || continue ;;
      build) in_code "build" || continue ;;
      knip) in_code "knip" || continue ;;
    esac
    refused_by_prompt "$prompt" "$words" && names="${names:+$names, }$family"
  done
  printf '%s' "$names"
}

commit_message() {
  local file
  file="$(printf '%s' "$CODE" | grep -oE '(-F|--file|--body-file)([[:space:]]+|=)[^[:space:]]+' | head -1 | sed -E 's/^[^[:space:]=]+([[:space:]]+|=)//')"
  if printf '%s' "$RAW" | grep -qE "<<-?[[:space:]]*${Q}[A-Za-z_]+"; then
    printf '%s' "$RAW" | perl -0777 -ne 'print $3 if /<<-?\s*([\x27"]?)(\w+)\1[^\n]*\n(.*?)\n[ \t]*\2[ \t]*(\n|$)/s'
  elif [ -n "$file" ] && [ -f "${CWD:-.}/$file" ]; then
    cat "${CWD:-.}/$file"
  elif [ -n "$file" ] && [ -f "$file" ]; then
    cat "$file"
  else
    printf '%s' "$RAW" | perl -0777 -ne '
      my @parts;
      while (/(?:^|\s)(?:-[a-zA-Z]*m|--message|--title|--body)(?:=|\s+)(?:"((?:[^"\\]|\\.)*)"|\x27([^\x27]*)\x27|(\S+))/gs) {
        push @parts, defined $1 ? $1 : defined $2 ? $2 : $3;
      }
      print join("\n\n", @parts);'
  fi
}

check_commit_text() {
  [ "$IS_COMMIT" = 0 ] && [ "$IS_PROSE" = 0 ] && return 0
  local msg scan subject types
  msg="$(commit_message)"
  scan="$(printf '%s\n%s' "$RAW" "$msg")"
  if printf '%s' "$scan" | LC_ALL=C grep -qiE 'co-authored-by|generated (with|by) .*(claude|ai)|claude[ -]code|noreply@anthropic|claude\.ai/code' \
    || printf '%s' "$scan" | LC_ALL=C grep -q $'\xf0\x9f\xa4\x96'; then
    deny "The text carries an assistant marker (Co-Authored-By / Generated with / Claude Code / robot emoji). Everything published from this repo reads as the developer's own. Drop it and retry."
  fi
  if printf '%s' "$scan" | LC_ALL=C grep -q -e $'\xe2\x80\x94' -e $'\xe2\x80\x93'; then
    deny "The text contains an em or en dash. Use a comma, colon, full stop or brackets (a plain hyphen for ranges)."
  fi
  [ "$IS_COMMIT" = 1 ] && [ -n "$msg" ] || return 0
  subject="$(printf '%s\n' "$msg" | sed -E 's/^[[:space:]]+//' | grep -v '^$' | head -1)"
  case "$subject" in
    "Merge "* | "Revert \""* | "Release to "* | "fixup! "* | "squash! "* | "amend! "*) return 0 ;;
  esac
  types='feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert'
  printf '%s' "$subject" | grep -qE "^($types)(\([^)]+\))?!?: [^[:space:]]" \
    || deny "Commit subject '$subject' fails commitlint. Format: <type>(<scope>): <summary>, types: ${types//|/, } (there is no 'ops'). A rejected commit also unstages lint-staged's changes, so fix it before committing."
  [ "${#subject}" -gt 100 ] && deny "Commit subject is ${#subject} characters; commitlint caps it at 100. Move the detail to the body."
  return 0
}

check_server_databases
check_local_data
check_git
check_ux_lookup_wrapper
check_subagent_limits
check_main_loop_gates
check_commit_text

if [ -n "$DENY" ]; then
  jq -n --arg r "$DENY" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
elif [ -n "$ASK" ]; then
  jq -n --arg r "$ASK" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:$r}}'
fi
exit 0

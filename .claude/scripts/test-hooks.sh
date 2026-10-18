#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOKS="$ROOT/.claude/hooks"
SID="hooktest-$$"
STATE="$ROOT/.claude/state/$SID"
export CLAUDE_PROJECT_DIR="$ROOT"
PASS=0
FAIL=0

cleanup() { [ -d "$STATE" ] && find "$STATE" -delete; }
trap cleanup EXIT
mkdir -p "$STATE"

user_said() { printf '%s' "$1" > "$STATE/prompt.txt"; }

decision_of() {
  local out="$1" code="$2"
  [ "$code" = 2 ] && { echo deny; return; }
  [ -z "$out" ] && { echo allow; return; }
  printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecision // "allow"'
}

check() {
  local want="$1" got="$2" label="$3"
  if [ "$want" = "$got" ]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL [$label] want=$want got=$got"
  fi
}

bash_case() {
  local want="$1" cmd="$2" extra="${3:-}"
  local out code
  [ -z "$extra" ] && extra='{}'
  out="$(jq -n --arg c "$cmd" --arg s "$SID" --arg cwd "$ROOT" --argjson e "$extra" \
    '{tool_name:"Bash",tool_input:{command:$c},session_id:$s,cwd:$cwd} + $e' | "$HOOKS/guard-bash.sh")"
  code=$?
  check "$want" "$(decision_of "$out" "$code")" "bash: $cmd"
}

file_case() {
  local want="$1" tool="$2" path="$3"
  local out code
  out="$(jq -n --arg t "$tool" --arg p "$path" '{tool_name:$t,tool_input:{file_path:$p}}' | "$HOOKS/guard-files.sh")"
  code=$?
  check "$want" "$(decision_of "$out" "$code")" "$tool: $path"
}

grep_case() {
  local want="$1" path="$2"
  local out
  out="$(jq -n --arg p "$path" '{tool_name:"Grep",tool_input:{pattern:"x",path:$p}}' | "$HOOKS/guard-files.sh")"
  check "$want" "$(decision_of "$out" 0)" "Grep: $path"
}

edit_case() {
  local want="$1" path="$2" old="$3" new="$4"
  jq -n --arg p "$ROOT/$path" --arg o "$old" --arg n "$new" --arg s "$SID" \
    '{tool_name:"Edit",tool_input:{file_path:$p,old_string:$o,new_string:$n},session_id:$s}' \
    | node "$HOOKS/post-edit-check.mjs" 2>/dev/null
  local code=$?
  local got=allow
  [ "$code" = 2 ] && got=flag
  check "$want" "$got" "post-edit: $path :: $new"
}

AGENT='{"agent_id":"a1","agent_type":"frontend-engineer"}'
RELEASE='{"agent_id":"a2","agent_type":"release-manager"}'
NL=$'\n'
TASK_PROMPT='Проаналізуй актуальний локальний dev. Не запускай тести, typecheck, ESLint або інші перевірки всього проєкту.
Після змін перевір diff. Лише наприкінці перед комітом запусти ESLint для зміненого файлу.
Зроби один коміт і коротко повідом результат.'

user_said "почини баг в списке"

bash_case deny  "APP_ENV=prod pnpm --filter @app/api db:migrate:deploy"
bash_case deny  "APP_ENV=dev pnpm --filter @app/api seed:genres"
bash_case deny  'psql -h localhost -p 5533 -U booknest -c "DELETE FROM users"'
bash_case deny  'DATABASE_URL=postgresql://u:p@localhost:5533/booknest pnpm --filter @app/api db:migrate:deploy'
bash_case deny  "cat apps/api/.env.prod"
bash_case deny  "grep DATABASE apps/api/.env.prod.readonly"
bash_case deny  "pnpm --filter @app/api exec prisma db push"
bash_case deny  "git reset --hard HEAD~1"
bash_case deny  'git -C "/tmp/some path" reset --hard'
bash_case deny  "cd apps/api && git checkout -- ."
bash_case deny  "git restore ."
bash_case deny  "git clean -fdx"
bash_case deny  "git branch -D feat/x"
bash_case deny  "git push --force origin dev"
bash_case deny  "git push origin dev --force-with-lease"
bash_case deny  "git push origin HEAD:prod"
bash_case deny  "git push origin dev:stage"
bash_case deny  "git add -f apps/api/.env.local"
bash_case deny  'git commit --no-verify -m "feat: x"'
bash_case deny  'git commit -m "feat(api): add thing — fast"'
bash_case deny  'git commit -m "update stuff"'
bash_case deny  'git commit -m "ops: tweak deploy"'
bash_case deny  "git commit -m \"\$(cat <<'EOF'${NL}feat(web): add list${NL}${NL}Co-Authored-By: Claude <noreply@anthropic.com>${NL}EOF${NL})\""
bash_case deny  'gh pr create --title "feat(web): list" --body "Adds a list — nice"'
bash_case deny  "gh repo delete owner/book-nest"
bash_case deny  'python3 ~/.claude/plugins/cache/ui-ux-pro-max-skill/ui-ux-pro-max/2.15.0/.claude/skills/ui-ux-pro-max/scripts/search.py "saas" -ds --persist'
bash_case allow 'bash .claude/scripts/ux-lookup.sh ux "empty state"' "$AGENT"

bash_case ask   "ssh -i ~/.ssh/id_ed25519_hetzner deploy@46.224.83.71"
bash_case ask   "pnpm tunnel:prod"
bash_case ask   "pnpm dev:api:prod"
bash_case ask   "pnpm --filter @app/api db:migrate:reset"
bash_case ask   "docker compose down -v"
bash_case ask   "redis-cli FLUSHALL"
bash_case ask   'docker exec booknest-local-db psql -U booknest -c "TRUNCATE users"'
bash_case ask   "gh pr merge 12 --squash"
bash_case ask   "git stash drop"
bash_case ask   "pnpm typecheck"
bash_case allow "cd apps/api && pnpm exec vitest run src/modules/books/books.service.test.ts"
bash_case ask   "pnpm --filter @app/api exec vitest run"

bash_case allow "APP_ENV=prodcopy pnpm --filter @app/api db:migrate:deploy"
bash_case allow "pnpm db:copy:prod"
bash_case allow "pnpm server:health"
bash_case allow 'psql -h localhost -p 5533 -U booknest_ro -c "SELECT count(*) FROM users"'
bash_case allow "git push origin promote-prod --force"
bash_case allow "git push origin dev"
bash_case allow "git push -u origin feat/lists"
bash_case allow 'git commit -m "feat(api): add thing"'
bash_case allow "git commit -m \"\$(cat <<'EOF'${NL}fix(web): handle an empty list${NL}${NL}The list rendered a stray divider.${NL}EOF${NL})\""
bash_case allow 'git commit -m "docs: explain why reset --hard is denied"'
bash_case allow 'git commit-tree "origin/dev^{tree}" -p origin/prod -m "Release to prod: lists"'
bash_case allow "git log --oneline -5"
bash_case allow "git restore --staged ."
bash_case allow 'echo "git reset --hard"'
bash_case allow "ls apps/api/.env.prod.example"
bash_case allow "test -f package.json && echo ok"
bash_case allow "docker compose down"

user_said "прогони гейты и закоммить"
bash_case allow "pnpm typecheck"
bash_case ask   "pnpm --filter @app/api exec vitest run src/x.test.ts"
bash_case ask   "bash .claude/scripts/gates.sh --with-tests"
bash_case ask   "pnpm --filter @app/web test:storybook"
user_said "прогони тест books.service"
bash_case allow "pnpm --filter @app/api exec vitest run src/x.test.ts"
bash_case allow "bash .claude/scripts/gates.sh --with-tests"
bash_case ask   "pnpm test"
user_said "CI красный, воспроизведи"
bash_case allow "VITEST_MAX_WORKERS=1 pnpm exec vitest run src/a.test.ts"
user_said "прогони гейты и закоммить"
bash_case ask   "pnpm test"
user_said "прогони полный тест перед релизом"
bash_case allow "pnpm test"
bash_case allow "VITEST_MAX_WORKERS=2 pnpm test"
user_said "$TASK_PROMPT"
bash_case allow "pnpm exec eslint apps/web/src/a.tsx"
bash_case ask   "pnpm typecheck"
bash_case ask   "pnpm --filter @app/web exec vitest run src/a.test.tsx"
bash_case ask   "bash .claude/scripts/gates.sh"
bash_case allow "git add apps/web/src/a.tsx"
user_said "не забудь прогнать typecheck и закоммить"
bash_case allow "pnpm typecheck"
user_said "не надо тесты, просто закоммить"
bash_case ask   "pnpm exec vitest run src/a.test.ts"
bash_case allow "pnpm lint"
user_said "на странице книги не работает кнопка сохранить, падает 500"
bash_case allow "cd apps/api && VITEST_MAX_WORKERS=1 pnpm exec vitest run src/modules/books/a.test.ts"
bash_case allow "cd apps/web && VITEST_MAX_WORKERS=1 pnpm exec vitest --project unit run src/a.test.tsx"
bash_case ask   "pnpm --filter @app/web exec vitest run"
bash_case ask   "pnpm test"
bash_case allow "curl -sS -i http://localhost:4000/api/health"
bash_case allow "gh run view 123 --log-failed"
user_said "/blast-radius"
bash_case ask   "pnpm exec vitest run src/a.test.ts"
bash_case allow "bash .claude/scripts/gates.sh"
user_said "почини баг в списке"
bash_case ask   "bash .claude/scripts/gates.sh"
bash_case ask   ".claude/scripts/gates.sh origin/dev"
bash_case allow "cat .claude/scripts/gates.sh"
bash_case deny  "bash .claude/scripts/gates.sh" "$AGENT"
bash_case allow "cat .claude/scripts/gates.sh" "$AGENT"

bash_case deny  "pnpm typecheck" "$AGENT"
bash_case deny  "pnpm --filter @app/web exec vitest run src/x.test.tsx" "$AGENT"
bash_case deny  "npx tsc --noEmit" "$AGENT"
bash_case deny  "cd apps/api && pnpm exec prisma generate" "$AGENT"
bash_case deny  "./node_modules/.bin/vitest run" "$AGENT"
bash_case deny  "turbo run test" "$AGENT"
bash_case deny  "pnpm format" "$AGENT"
bash_case deny  'git commit -m "feat: x"' "$AGENT"
bash_case deny  "git stash" "$AGENT"
bash_case deny  "git checkout dev" "$AGENT"
bash_case deny  'gh pr create --title "feat: x" --body y' "$AGENT"
bash_case allow "git diff --stat" "$AGENT"
bash_case allow "git log -5 --oneline" "$AGENT"
bash_case allow "git branch --show-current" "$AGENT"
bash_case allow "grep -rn useBooks apps/web/src" "$AGENT"
bash_case allow "pnpm why zod" "$AGENT"
bash_case allow "curl -s http://localhost:4000/api/health" "$AGENT"
bash_case allow 'DATABASE_URL=postgresql://booknest:x@localhost:5434/booknest APP_ENV=prodcopy pnpm --filter @app/api db:migrate:deploy' "$RELEASE"
bash_case allow "git push origin promote-prod --force" "$RELEASE"
bash_case deny  "git push --force origin dev" "$RELEASE"

file_case deny  Read  "$ROOT/apps/api/.env.prod"
file_case deny  Read  "$ROOT/apps/api/.env.prod.readonly"
file_case deny  Read  "$ROOT/apps/web/.env.dev"
file_case deny  Read  "$HOME/.ssh/id_ed25519_hetzner"
grep_case deny  "$ROOT/apps/api/.env.dev"
file_case deny  Edit  "$ROOT/apps/api/.env.local"
file_case deny  Write "$ROOT/apps/api/.env"
file_case deny  Write "$ROOT/apps/web/src/shared/api/generated/books.ts"
file_case deny  Edit  "$ROOT/apps/api/src/generated/prisma/client.ts"
file_case deny  Edit  "$ROOT/pnpm-lock.yaml"
COMMITTED_MIGRATION="$(git -C "$ROOT" ls-files 'apps/api/prisma/migrations/*/migration.sql' | head -1)"
[ -n "$COMMITTED_MIGRATION" ] && file_case deny Edit "$ROOT/$COMMITTED_MIGRATION"
file_case allow Edit  "$ROOT/apps/api/prisma/migrations/29990101000000_new/migration.sql"
file_case allow Read  "$ROOT/apps/api/.env.local"
file_case allow Read  "$ROOT/apps/api/.env.prod.example"
file_case allow Edit  "$ROOT/apps/api/.env.prod.example"
file_case allow Edit  "$ROOT/apps/api/src/modules/books/application/books.service.ts"

SVC="apps/api/src/modules/books/application/hooktest.service.ts"
WEB="apps/web/src/features/books/components/hooktest-card.tsx"
edit_case flag  "$SVC" "" "// load the books"
edit_case flag  "$SVC" "" "const row = payload as any;"
edit_case flag  "$SVC" "" "return this.prisma.book.findMany();"
edit_case flag  "$SVC" "" "const title = book!.title;"
edit_case flag  "$SVC" "" "console.log(book);"
edit_case flag  "$SVC" "" "const age = now.getTime() - createdAt.getTime();"
edit_case flag  "$SVC" "" "const ttl = 24 * 60 * 60 * 1000;"
edit_case flag  "$SVC" "" "const url = process.env.API_URL;"
edit_case flag  "$WEB" "" '<p className="text-[10px] text-muted-foreground">x</p>'
edit_case flag  "$WEB" "" "const sorted = useMemo(() => sort(books), [books]);"
edit_case flag  "$WEB" "" "<p>Книги</p>"
edit_case flag  "$WEB" "" 'const res = await fetch("/api/books");'
edit_case allow "$SVC" "// keep this one${NL}const a = 1;" "// keep this one${NL}const a = 2;"
edit_case allow "$SVC" "" "// eslint-disable-next-line no-restricted-syntax"
edit_case allow "$SVC" "" 'throw new NotFoundError("as any other book");'
edit_case allow "$SVC" "" "if (!book) return null;"
edit_case allow "$SVC" "" "const isSame = a !== b;"
edit_case allow "$WEB" "" '<p className="text-sm text-muted-foreground">{t("empty")}</p>'
edit_case allow "$WEB" "" '<div className="max-w-[65ch] grid-cols-[1fr_auto]">'
edit_case allow "$WEB" '<p className="text-[10px] uppercase">' '<p className="text-[10px] uppercase tracking-[0.22em]">'
edit_case allow "$SVC" "" 'const isDev = process.env.NODE_ENV !== "production";'
edit_case allow "apps/api/src/modules/books/api/books.fixtures.ts" "" "prisma: PrismaService;"

t_prompt() { jq -nc --arg c "$1" '{type:"user",message:{role:"user",content:$c}}'; }
t_meta() { jq -nc --arg c "$1" '{type:"user",isMeta:true,message:{role:"user",content:[{type:"text",text:$c}]}}'; }
t_call() { jq -nc --arg id "$1" --arg n "$2" --argjson i "$3" '{type:"assistant",message:{content:[{type:"tool_use",id:$id,name:$n,input:$i}]}}'; }
t_result() { jq -nc --arg id "$1" --arg c "$2" '{type:"user",message:{content:[{type:"tool_result",tool_use_id:$id,content:[{type:"text",text:$c}]}]}}'; }
t_notify() { t_prompt "<task-notification>${NL}<summary>Agent \"$1\" finished</summary>${NL}<result>$2</result>${NL}</task-notification>"; }

stop_case() {
  local want="$1" msg="$2" label="$3" extra="${4:-}"
  shift 4
  [ -z "$extra" ] && extra='{}'
  printf '%s\n' "$@" > "$STATE/transcript.jsonl"
  local out got=allow
  out="$(jq -n --arg t "$STATE/transcript.jsonl" --arg m "$msg" --argjson e "$extra" \
    '{transcript_path:$t,last_assistant_message:$m} + $e' | "$HOOKS/claims-check.sh")"
  [ -n "$out" ] && got="$(printf '%s' "$out" | jq -r '.decision // "allow"')"
  check "$want" "$got" "stop: $label"
}

WEB_EDIT="$(t_call e1 Edit "{\"file_path\":\"$ROOT/apps/web/src/features/x.tsx\"}")"
DOC_EDIT="$(t_call e2 Edit "{\"file_path\":\"$ROOT/docs/x.md\"}")"
ESLINT_RUN="$(t_call b1 Bash '{"command":"cd apps/web && pnpm exec eslint src/features/x.tsx"}')"
CHROME_SHOT="$(t_call c1 mcp__claude-in-chrome__computer '{"action":"screenshot"}')"
ENGINEER="$(t_call a1 Agent '{"subagent_type":"backend-engineer","description":"Fix loan reminder"}')"
ENGINEER_DONE="$(t_result a1 "STATUS: DONE${NL}CHANGED:${NL}apps/api/src/modules/loans/application/loans.service.ts${NL}NOT_VERIFIED:${NL}MAIN: bash .claude/scripts/gates.sh${NL}CI: apps/api/src/modules/loans/loans.service.test.ts")"
CURATOR="$(t_call a2 Agent '{"subagent_type":"feature-context-curator","description":"Loans doc"}')"
CURATOR_DONE="$(t_result a2 "STATUS: DONE${NL}CHANGED: docs/features/loans.md${NL}NOT_VERIFIED: none")"

stop_case allow "Запустил агента, жду его отчёт." "no claim" "" "$(t_prompt 'почини')" "$WEB_EDIT"
stop_case allow "Готово." "stop_hook_active" '{"stop_hook_active":true}' "$(t_prompt 'почини')" "$WEB_EDIT"
stop_case block "Готово, кнопка снова сохраняет." "code edit, no check, no split" "" "$(t_prompt 'почини')" "$WEB_EDIT"
stop_case block "Зроблено." "ukrainian claim" "" "$(t_prompt 'виправ')" "$WEB_EDIT"
stop_case allow "Готово. NOT_VERIFIED: CI: x.test.tsx" "code edit with split" "" "$(t_prompt 'почини')" "$WEB_EDIT"
stop_case allow "Готово, eslint чистый." "code edit with eslint" "" "$(t_prompt 'почини')" "$WEB_EDIT" "$ESLINT_RUN"
stop_case allow "Готово, на 375 и 1280 ок." "code edit with chrome pass" "" "$(t_prompt 'почини')" "$WEB_EDIT" "$CHROME_SHOT"
stop_case allow "Готово." "docs-only edit" "" "$(t_prompt 'обнови доку')" "$DOC_EDIT"
stop_case allow "Готово." "edit in previous turn" "" "$(t_prompt 'почини')" "$WEB_EDIT" "$(t_prompt 'что дальше?')"
stop_case block "Готово." "meta text keeps the turn" "" "$(t_prompt 'почини')" "$WEB_EDIT" "$(t_meta 'Base directory for this skill')"
stop_case block "Готово, сервис исправлен." "agent NOT_VERIFIED dropped" "" "$(t_prompt 'почини')" "$ENGINEER" "$ENGINEER_DONE"
stop_case allow "Готово. Missing: гейты при коммите, CI: loans.service.test.ts" "agent NOT_VERIFIED relayed" "" "$(t_prompt 'почини')" "$ENGINEER" "$ENGINEER_DONE"
stop_case allow "Готово." "docs agent, nothing open" "" "$(t_prompt 'опиши фичу')" "$CURATOR" "$CURATOR_DONE"
stop_case block "Готово." "notification NOT_VERIFIED dropped" "" "$(t_notify 'Loans tests' "STATUS: DONE${NL}NOT_VERIFIED:${NL}CI: apps/api/src/modules/loans/loans.service.test.ts")"

echo "hooks: $PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]

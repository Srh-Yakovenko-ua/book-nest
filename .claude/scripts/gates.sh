#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1
WITH_TESTS=0
BASE=HEAD
for arg in "$@"; do
  case "$arg" in
    --with-tests) WITH_TESTS=1 ;;
    *) BASE="$arg" ;;
  esac
done
LOGS="$(mktemp -d)"
trap 'find "$LOGS" -delete' EXIT
FAILED=0

changed_files() {
  { git diff --name-only "$BASE" -- apps packages; git ls-files --others --exclude-standard -- apps packages; } \
    | sort -u | while IFS= read -r file; do [ -f "$file" ] && printf '%s\n' "$file"; done
}

tests_for() {
  local app="$1"
  printf '%s\n' "$CHANGED" | grep -E "^apps/$app/src/" | while IFS= read -r file; do
    case "$file" in
      *.test.ts | *.test.tsx) printf '%s\n' "${file#apps/$app/}" ;;
      *.ts | *.tsx)
        for candidate in "${file%.*}.test.ts" "${file%.*}.test.tsx"; do
          [ -f "$candidate" ] && printf '%s\n' "${candidate#apps/$app/}"
        done
        ;;
    esac
  done | sort -u
}

run_step() {
  local name="$1"
  shift
  local log="$LOGS/$name.log"
  local started=$SECONDS
  if "$@" >"$log" 2>&1; then
    echo "ok   $name ($((SECONDS - started))s)"
  else
    FAILED=1
    echo "FAIL $name ($((SECONDS - started))s)"
    grep -vE '^\s*$|^(> |turbo |• |  Tasks:|  Cached:|  Time:|cache (hit|miss|bypass))' "$log" | tail -40 | sed 's/^/     /'
  fi
}

CHANGED="$(changed_files)"
LINTABLE="$(printf '%s\n' "$CHANGED" | grep -E '\.(ts|tsx|js|jsx|mjs|cjs)$' | grep -v '/generated/' || true)"
WEB_LINTABLE="$(printf '%s\n' "$LINTABLE" | grep '^apps/web/' | sed 's#^apps/web/##' || true)"
OTHER_LINTABLE="$(printf '%s\n' "$LINTABLE" | grep -v '^apps/web/' || true)"
API_TESTS="$(tests_for api)"
WEB_TESTS="$(tests_for web)"

STAMP="$(git rev-parse --git-path booknest-gates-ok)"

checked_tree() {
  local index="$LOGS/index"
  cp "$(git rev-parse --git-path index)" "$index" \
    && GIT_INDEX_FILE="$index" git add -u \
    && git ls-files --others --exclude-standard | GIT_INDEX_FILE="$index" git update-index --add --stdin \
    && GIT_INDEX_FILE="$index" git write-tree
  rm -f "$index"
}

stamp_blocker() {
  local base paths
  base="$(git merge-base HEAD origin/dev 2>/dev/null || git rev-parse HEAD)"
  paths="$({ git diff --name-only "$base"; git ls-files --others --exclude-standard; } | sort -u)"
  printf '%s\n' "$paths" | grep -m1 -E '(^|/)(eslint\.config\.[cm]?js|package\.json|tsconfig[^/]*\.json)$|^(pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json)$' && return 0
  printf '%s\n' "$paths" | grep -vE '^(apps|packages|\.claude)/' | grep -m1 -E '\.(ts|tsx|js|jsx|mjs|cjs)$'
}

rm -f "$STAMP"
TREE_BEFORE="$(checked_tree)"
echo "base $BASE, $(printf '%s' "$CHANGED" | grep -c . ) changed files under apps/ and packages/"
run_step typecheck pnpm typecheck
if [ -n "$WEB_LINTABLE" ]; then
  run_step lint-web sh -c "cd apps/web && pnpm exec eslint --max-warnings=0 $(printf '%s ' $WEB_LINTABLE)"
fi
if [ -n "$OTHER_LINTABLE" ]; then
  run_step lint pnpm exec eslint --max-warnings=0 $OTHER_LINTABLE
fi
if [ -n "$CHANGED" ]; then
  run_step format pnpm exec prettier --check --ignore-unknown $CHANGED
fi
if [ "$WITH_TESTS" = 1 ] && [ -n "$API_TESTS" ]; then
  run_step "api-tests[$(printf '%s\n' "$API_TESTS" | grep -c .)]" sh -c "cd apps/api && pnpm exec vitest run $(printf '%s ' $API_TESTS)"
fi
if [ "$WITH_TESTS" = 1 ] && [ -n "$WEB_TESTS" ]; then
  run_step "web-tests[$(printf '%s\n' "$WEB_TESTS" | grep -c .)]" sh -c "cd apps/web && pnpm exec vitest --project unit run $(printf '%s ' $WEB_TESTS)"
fi
if [ "$WITH_TESTS" = 0 ] && [ -n "$API_TESTS$WEB_TESTS" ]; then
  echo "skip tests: $(printf '%s\n' $API_TESTS $WEB_TESTS | grep -c .) related test files run in CI (pass --with-tests to run them here)"
fi
if printf '%s\n' "$CHANGED" | grep -qE '^(packages/shared/|apps/api/prisma/|apps/api/src/core/)|repository\.ts$|\.service\.ts$|input-dto/'; then
  echo "note contract-shaped change: run /blast-radius, and prefer a PR into dev over a direct push so CI tests it before any deploy"
fi
SECURITY_SHAPED="$({ git diff --name-only "$BASE"; git ls-files --others --exclude-standard; } | sort -u | bash "$ROOT/.claude/scripts/security-shaped.sh")"
if [ -n "$SECURITY_SHAPED" ]; then
  echo "note security-shaped change ($(printf '%s\n' "$SECURITY_SHAPED" | grep -c .) files: $(printf '%s\n' "$SECURITY_SHAPED" | head -5 | paste -sd, -)): run security-reviewer on the diff before committing; the commit hook asks for any such file it has not seen"
fi
if [ "$FAILED" = 0 ]; then
  BLOCKER="$(stamp_blocker || true)"
  TREE_AFTER="$(checked_tree)"
  if [ -n "$BLOCKER" ]; then
    echo "no stamp: $BLOCKER changes what lint sees in files this run did not lint, so pre-push keeps its full typecheck and lint"
  elif [ -z "$TREE_BEFORE" ] || [ "$TREE_AFTER" != "$TREE_BEFORE" ]; then
    echo "no stamp: the tree changed while the gates ran, so pre-push keeps its full typecheck and lint"
  else
    printf '%s\n' "$TREE_AFTER" > "$STAMP"
    echo "stamp gates passed on tree ${TREE_AFTER:0:12}: pre-push skips typecheck and lint when the pushed commit has exactly this tree"
  fi
fi
exit "$FAILED"

---
name: check
description: Run the local gates once over the working-tree diff (typecheck, lint, prettier) and report one line per gate. Use when the user says "прогони", "проверь", "гейты", "check", "run the gates", or before any commit or push. Tests are not run here; CI runs them.
---

# Check

During development no gate runs (CLAUDE.md §9). This is the one moment they do, and it must cost one script call and one short report, not a dozen tool calls and pasted logs.

**Tests run in CI, not on this machine.** A local vitest run on the API spins up Nest apps against Postgres, Redis and Mailpit and saturates the dev machine; CI runs the same suite sharded on every PR into dev/prod and every push to dev/prod. Locally the gates are the cheap static ones, which turbo caches.

## Steps

1. Collect the `MAIN:` lines from every subagent report of this task (their NOT_VERIFIED sections). Keep the non-test ones that step 2 does not cover, such as `db:generate` or `gen:api`. Test lines go to CI.
2. Run `bash .claude/scripts/gates.sh` from the repo root. It diffs the working tree against `HEAD` (pass another base, e.g. `origin/dev`, to check a whole branch) and runs `pnpm typecheck`, eslint on changed code files and prettier on changed files. Each gate prints `ok` or `FAIL` with the last 40 lines of its log, and it prints how many related test files it left to CI.
3. Run the leftover `MAIN:` lines from step 1.
4. If the script prints the contract-shaped note, run `/blast-radius`, and tell the user that this change should reach dev through a PR (CI tests it, nothing deploys) rather than a direct push, where a red test blocks the dev deploy. That is how `dev` went red on 2026-08-08.
5. Report in one block: one line per gate (`typecheck ok`, `lint FAIL 2 errors in x.ts`), the count of tests left to CI, then each failure with its `file:line` and a one-line cause. Do not paste green output.

## Running tests here anyway

Only when the user asks for a test run, or to reproduce a test that CI reported red. Then run the narrowest thing: `bash .claude/scripts/gates.sh --with-tests` for the diff's related tests, or one file with `VITEST_MAX_WORKERS=1`. A hook asks before any other local test run. CI on a branch without deploying: `gh workflow run ci.yml --ref <pushed-branch>`, which needs the user's consent to push.

## On a failure

- **Fix it and rerun the script once.** Do not loop gate by gate by hand; the script is cheaper than separate calls.
- **A failure you did not cause** (pre-existing lint debt, the known flakes in memory: `reference_ioredis_teardown_exit1`, `reference_delivery_read_midnight_flake`, `reference_storybook_flake`) is reported as such with the evidence, never fixed in passing and never hidden.
- **New `@app/shared` export reads as `undefined`** while typecheck is green: the dist is stale, `pnpm --filter @app/shared build`.
- **A red CI test you reproduce locally times out at 30s:** Redis or Mailpit is down, not your change. `docker compose up -d db redis mailpit`.

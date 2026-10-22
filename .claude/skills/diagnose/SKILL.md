---
name: diagnose
description: The bug chain, report to committed fix, for frontend and backend alike. Use when something is broken, throwing, failing intermittently, slow, a CI test is red, or it behaves differently in CI than locally, and whenever a fix attempt has already failed once. Also when the user says "не работает", "не працює", "падает", "ошибка", "помилка", "почему", "баг", "500", "красный CI", "flaky", "медленно", "debug this".
---

# Diagnose

A bug goes through a fixed chain: a read-only hunter finds the mechanism, the path owner fixes it, a test proves it. The hunters cannot edit, run tests or drive a browser, so every hand-off below is the main loop's job; skip one and the chain silently ends at a diagnosis nobody applied.

## The chain

1. **Route by where the symptom lives.**
   - Browser-visible (render, state, console, hydration, interaction) → `frontend-bug-hunter`.
   - Server-side (500, wrong response, Prisma or Postgres error, hang, a log stack trace) → `backend-bug-hunter`.
   - A red CI test → `gh run view <run-id> --log-failed`, then route by the test's path: `apps/api/**` backend, `apps/web/**` frontend. The failing assertion goes into the brief verbatim.
   - Unclear side (the UI shows wrong data) → `frontend-bug-hunter` first. It curls the request through the web proxy and splits client from server.
2. **Brief the hunter.** The symptom in the user's words, the route or endpoint, the steps, the dev log path, and for a regression the last commit where it worked. If reproducing needs a running app, start `pnpm dev` in the background with output to a file in the scratchpad first, because the hunter may not start servers.
3. **Close its open lines, then resume the same hunter.** A `PARTIAL` with `EXTERNAL:` or `MAIN:` lines means the hunter needs observations only the main loop can make: run the one Chrome MCP pass, the one-file repro test, the restart. Then send the raw output back with `SendMessage` to that hunter, whose context is still live. A fresh hunter repeats the whole read.
   - When `frontend-bug-hunter` reports the server is wrong, launch `backend-bug-hunter` with its curl evidence verbatim.
4. **Confirm before fixing.** Open the cited `file:line` yourself, one Read. A root cause whose basis is not `bug` or `measured`, or that no loop ever turned red, is a guess. Send it back, or tell the user it could not be reproduced.
5. **Fix and regression test, in one turn, in parallel.**
   - The path owner (`backend-engineer` or `frontend-engineer`) gets the FINDINGS line verbatim plus "fix exactly this, change nothing else".
   - The matching test engineer gets the hunter's drafted repro (path, `it(...)` body, the assertion that must go red).
6. **Prove it red, then green.** Run that one test file locally. This is the one local test run the repo allows on a bug.
   - api: `cd apps/api && VITEST_MAX_WORKERS=1 pnpm exec vitest run <file>`
   - web: `cd apps/web && VITEST_MAX_WORKERS=1 pnpm exec vitest --project unit run <file>`
     It must be green with the fix. Then `git stash push -- <fixed source files>`, run it again (it must be red), and `git stash pop`. A test that passes without the fix proves nothing; send it back to the test engineer.
7. **Review and gates.** `code-reviewer` on the fix diff, `/fix-loop` if it finds something, `/blast-radius` if the fix touched a contract, `/check` at commit. Commit and push only when the user asked.

Report to the user: the mechanism at `file:line`, the fix, the red/green evidence, and whatever was left unverified.

## Inside the loop

**Phase 1 is the skill. Everything after it is mechanical.** If you have a tight pass/fail signal that goes red on _this_ bug, you will find the cause — bisection, hypothesis testing and instrumentation all just consume that signal. Without one, more staring at code will not save you, and neither will a third guess. The hunters follow these phases; so do you when you debug inline.

### Phase 1 — Build the loop

Spend disproportionate effort here. Be aggressive, be creative, refuse to give up.

Ways to build one, roughly in order of preference in this repo:

1. **A failing test** at whatever seam reaches the bug, one file, run from the app's directory with the commands in step 6 of the chain, never from the repo root. This is the one local test run the repo allows (tests otherwise run only in CI); the guard hook allows a single test file when the user's message reports a bug or asks for a repro, and denies it otherwise.
2. **A curl against the running dev server.** `pnpm dev:api`, then hit the endpoint. Capture the full response including `x-request-id`, and grep the server log for that id.
3. **A direct Prisma query** in a throwaway script, to separate "the query is wrong" from "the service is wrong".
4. **Direct SQL** via `docker exec booknest-local-db psql -U <user> -d booknest_dev -c "..."` — the only way to see what the database actually holds versus what Prisma reports.
5. **Chrome MCP** for a browser symptom, reading DOM, console and network rather than judging a screenshot.
6. **A replayed payload.** Save the real request body to disk, replay it through the code path alone.
7. **A differential loop.** Same input through two branches, two configs, or two commits; diff the outputs.
8. **A bisection harness.** If it worked at a known commit, automate "boot at X, check, repeat" and let `git bisect run` do the search.
9. **A repetition loop** for anything intermittent. `for i in $(seq 1 20); do ...; done` — a bug that reproduces 1 time in 5 is not reproduced until you have run it 20 times.

#### Then tighten it

Treat the loop as a product, not a chore:

- **Faster.** Narrow the test file, skip unrelated setup, drop to the smallest seam that still fails.
- **Sharper.** Assert on the specific symptom, not "did not crash". A loop that goes red for two different reasons will lie to you.
- **More deterministic.** Pin the clock, seed randomness, truncate tables between runs, isolate the port.

A loop that takes 20 seconds and fails for exactly one reason is worth an hour of building.

### Phase 2 — Establish what is actually true

Before theorising, collect facts the loop can confirm. In this repo the usual liars are:

- **A stale `packages/shared/dist`.** New exports read as `undefined` at runtime while typecheck stays green. Fix: `pnpm --filter @app/shared build`.
- **A stale generated Prisma client.** Run `pnpm --filter @app/api db:generate` after any schema change.
- **A stale generated API client.** Run `pnpm gen:api` after any contract change.
- **Migrations not applied locally.** `pnpm --filter @app/api db:migrate:status`.
- **A pre-existing failure you are about to blame on your diff.** Stash your changes and run the same loop on a clean tree. If it is still red, you are chasing someone else's bug.

Write down what you have proven, separately from what you suspect.

### Phase 3 — One hypothesis at a time

State the hypothesis as a sentence that the loop can falsify: "the tab counters ignore the genre filter". Then change exactly one thing and run the loop.

Two changes at once means a green loop tells you nothing about which one mattered.

When a hypothesis survives, keep going until you can name the **mechanism** — the specific line and the specific reason. "Adding the await fixed it" is not a diagnosis; "the promise was not awaited, so the transaction committed before the write" is.

### Phase 4 — Fix, then prove the fix

- Make the smallest change that addresses the mechanism.
- Run the loop: it must go green.
- **Revert the fix and confirm the loop goes red again.** A fix you have not seen fail is a fix you have not verified.
- Keep the loop as a test if it is worth keeping. A bug that shipped once will ship again.
- Then run `/blast-radius` if the fix touched a contract.

### Reporting

Report the mechanism, not the symptom, and back every claim with the observation that supports it: the failing assertion, the curl output, the log line, the SQL result. If a step was skipped, say which and why.

If the loop could not be built, say that plainly and describe what you tried. "I could not get a reliable reproduction" is a real and useful answer; a confident guess dressed as a diagnosis is not.

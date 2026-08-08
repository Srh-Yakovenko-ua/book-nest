---
name: diagnose
description: Build a tight pass/fail feedback loop before hunting a bug's cause. Use when something is broken, throwing, failing intermittently, slow, or behaving differently in CI than locally — and whenever a fix attempt has already failed once. Also use when the user says "не работает", "падает", "почему", "баг", "flaky", "медленно", "debug this".
---

# Diagnose

A discipline for bugs that did not fall to the first read of the code.

**Phase 1 is the skill. Everything after it is mechanical.** If you have a tight pass/fail signal that goes red on _this_ bug, you will find the cause — bisection, hypothesis testing and instrumentation all just consume that signal. Without one, more staring at code will not save you, and neither will a third guess.

Delegation still applies: a server-side symptom goes to `backend-bug-hunter`, a browser-side one to `frontend-bug-hunter`. This skill is what they and you should do once there.

## Phase 1 — Build the loop

Spend disproportionate effort here. Be aggressive, be creative, refuse to give up.

Ways to build one, roughly in order of preference in this repo:

1. **A failing test** at whatever seam reaches the bug. `cd apps/api && pnpm exec vitest run <file>` — from `apps/api`, never the repo root.
2. **A curl against the running dev server.** `pnpm dev:api`, then hit the endpoint. Capture the full response including `x-request-id`, and grep the server log for that id.
3. **A direct Prisma query** in a throwaway script, to separate "the query is wrong" from "the service is wrong".
4. **Direct SQL** via `docker exec booknest-local-db psql -U <user> -d booknest_dev -c "..."` — the only way to see what the database actually holds versus what Prisma reports.
5. **A Playwright script** for a browser symptom, asserting on DOM, console, or network rather than on a screenshot.
6. **A replayed payload.** Save the real request body to disk, replay it through the code path alone.
7. **A differential loop.** Same input through two branches, two configs, or two commits; diff the outputs.
8. **A bisection harness.** If it worked at a known commit, automate "boot at X, check, repeat" and let `git bisect run` do the search.
9. **A repetition loop** for anything intermittent. `for i in $(seq 1 20); do ...; done` — a bug that reproduces 1 time in 5 is not reproduced until you have run it 20 times.

### Then tighten it

Treat the loop as a product, not a chore:

- **Faster.** Narrow the test file, skip unrelated setup, drop to the smallest seam that still fails.
- **Sharper.** Assert on the specific symptom, not "did not crash". A loop that goes red for two different reasons will lie to you.
- **More deterministic.** Pin the clock, seed randomness, truncate tables between runs, isolate the port.

A loop that takes 20 seconds and fails for exactly one reason is worth an hour of building.

## Phase 2 — Establish what is actually true

Before theorising, collect facts the loop can confirm. In this repo the usual liars are:

- **A stale `packages/shared/dist`.** New exports read as `undefined` at runtime while typecheck stays green. Fix: `pnpm --filter @app/shared build`.
- **A stale generated Prisma client.** Run `pnpm --filter @app/api db:generate` after any schema change.
- **A stale generated API client.** Run `pnpm gen:api` after any contract change.
- **Migrations not applied locally.** `pnpm --filter @app/api db:migrate:status`.
- **A pre-existing failure you are about to blame on your diff.** Stash your changes and run the same loop on a clean tree. If it is still red, you are chasing someone else's bug.

Write down what you have proven, separately from what you suspect.

## Phase 3 — One hypothesis at a time

State the hypothesis as a sentence that the loop can falsify: "the tab counters ignore the genre filter". Then change exactly one thing and run the loop.

Two changes at once means a green loop tells you nothing about which one mattered.

When a hypothesis survives, keep going until you can name the **mechanism** — the specific line and the specific reason. "Adding the await fixed it" is not a diagnosis; "the promise was not awaited, so the transaction committed before the write" is.

## Phase 4 — Fix, then prove the fix

- Make the smallest change that addresses the mechanism.
- Run the loop: it must go green.
- **Revert the fix and confirm the loop goes red again.** A fix you have not seen fail is a fix you have not verified.
- Keep the loop as a test if it is worth keeping. A bug that shipped once will ship again.
- Then run `/blast-radius` if the fix touched a contract.

## Reporting

Report the mechanism, not the symptom, and back every claim with the observation that supports it: the failing assertion, the curl output, the log line, the SQL result. If a step was skipped, say which and why.

If the loop could not be built, say that plainly and describe what you tried. "I could not get a reliable reproduction" is a real and useful answer; a confident guess dressed as a diagnosis is not.

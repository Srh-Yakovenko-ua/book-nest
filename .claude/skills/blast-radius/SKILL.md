---
name: blast-radius
description: Find everything a change actually breaks, not just the files you edited, and route it so CI tests it before any deploy. Use after changing anything in packages/shared, a Prisma schema or migration, a repository or service signature, a DI constructor, or an endpoint's request/response contract — and before any commit that touches those. Also use when the user says "что сломается", "кто это использует", "проверь зависимости", "blast radius", "who consumes this".
---

# Blast radius

Tests run only in CI (CLAUDE.md §9), so the local defence is the compiler plus reading. Both share one blind spot: **they only ever cover the files you already thought of.** A contract change breaks callers you did not open, and you find out from a red deploy.

This skill closes that gap without running the suite here. It answers one question: _given this diff, which files can no longer be assumed correct?_

## When it earns its keep

Run it when the change is **contract-shaped** — anything another file compiles or asserts against:

- a Zod schema, type, or constant in `packages/shared`
- a repository or service method signature, or a Nest constructor gaining a dependency
- a response body: a new required field, a renamed field, a widened enum
- a request body becoming stricter (a union, a new required key, a tightened bound)
- `prisma/schema.prisma` or a migration
- a shared helper in `apps/api/src/core/**`

Skip it for a change with no consumers: a new endpoint nothing calls yet, a comment, a test-only edit, a purely internal rename inside one file.

## The loop

### 1. Name the changed surface

From the diff, list the **exported symbols** whose shape changed — not the files. A file can change with no consumer impact; an exported type cannot.

```bash
git diff --stat
git diff -U0 -- packages/shared apps/api/src/core | grep -E "^[+-](export|  [a-z].*:)" | head -40
```

Write the list down. Three renamed fields is three searches, not one.

### 2. Find the consumers

For each symbol, search the whole monorepo — all three packages, including tests and fixtures:

```bash
grep -rn "<SymbolName>" apps packages --include='*.ts' --include='*.tsx' | grep -v "/generated/"
```

Two consumer classes get missed most often, so look for them by name:

- **Test fixtures and factories.** `*.fixtures.ts`, `makeX()` builders, and seed helpers construct the full object literal, so a new required field breaks them even though no production code changed.
- **The generated client.** `apps/web/src/shared/api/generated/**` is regenerated, never hand-edited — but the hand-written code that _calls_ it is not. After `pnpm gen:api`, the root typecheck is what surfaces those callers.

### 3. Let the compiler do the work it can

```bash
pnpm --filter @app/shared build   # or new exports resolve as undefined at runtime
pnpm gen:api                       # if the OpenAPI surface moved
pnpm typecheck                     # all three packages, not just @app/api
```

The root typecheck catches every _type-level_ consumer for free. Treat its output as a to-do list, not an obstacle. It does **not** catch runtime-only breakage — a request body that now fails Zod validation still compiles fine on both sides.

### 4. Fix the tests the compiler cannot reach

A test that sends a literal request body, or asserts on a literal response shape, compiles perfectly and fails at runtime. Find them and update them now, by reading; do not run them here.

```bash
grep -rln "<endpoint path or symbol>" apps/api/src --include='*.test.ts'
grep -rn '"<fieldName>"\|<fieldName>:' apps/api/src apps/web/src --include='*.test.ts' --include='*.test.tsx' | head -20
```

### 5. Route it through CI before anything deploys

A direct push to `dev` deploys, and a red test there blocks the deploy. A contract change goes up as a branch with a PR into `dev`: `ci.yml` runs the full suite on the PR and nothing deploys until it is green and merged. Pushing needs the user's consent, so say this in the report rather than doing it. If the user wants the tests run here instead, run only the files from steps 2 and 4, from `apps/api` (the root picks the wrong vitest config), with `VITEST_MAX_WORKERS=1`.

## Gate

Do not call a contract change ready until:

- every consumer found in steps 2 and 4 has been read and updated,
- `bash .claude/scripts/gates.sh` is green, and
- the report says it ships through a PR into `dev`, listing the consumer test files CI will exercise.

"Typecheck is green" is not enough on its own for a contract change.

## Why this exists

On 2026-08-08 a discriminated-union request body and a computed display rank shipped after the touched-file tests passed. Six tests in two untouched files broke, plus one hand-written frontend caller, and CI on `dev` went red. Every one of them was reachable by a `grep` for the changed symbol. The spec audit had even asserted there were no frontend consumers — the assertion was wrong, and the grep would have said so.

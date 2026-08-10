---
name: blast-radius
description: Find and run everything a change actually breaks, not just the files you edited. Use after changing anything in packages/shared, a Prisma schema or migration, a repository or service signature, a DI constructor, or an endpoint's request/response contract — and before any commit that touches those. Also use when the user says "что сломается", "кто это использует", "проверь зависимости", "blast radius", "who consumes this".
---

# Blast radius

`pnpm test` costs ~7 minutes and CI runs it anyway, so the local habit is `vitest run <path/to/the.test.ts>` on the files you touched. That habit is correct and it has one blind spot: **it only ever runs the tests you already thought of.** A contract change breaks callers you did not open, and you find out from a red deploy.

This skill closes that gap without paying for the full suite. It answers one question: _given this diff, which files can no longer be assumed correct?_

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

### 4. Run the tests the compiler cannot reach

This is the step the habit skips. A test that sends a literal request body, or asserts on a literal response shape, compiles perfectly and fails at runtime.

```bash
cd apps/api
grep -rln "<endpoint path or symbol>" src --include='*.test.ts'
pnpm exec vitest run <each file from that list>
```

Run from `apps/api`, never the repo root — the root picks the wrong vitest config and env validation fails.

If the changed surface is a **request body or a response field**, also grep the test tree for the literal:

```bash
grep -rn '"<fieldName>"\|<fieldName>:' src --include='*.test.ts' | grep -v "$(git diff --name-only | tr '\n' '|')" | head -20
```

### 5. Decide honestly whether the narrow run was enough

Ask one question: _did I change something every module could be using?_ Prisma client regeneration, a `core/**` helper, a DI graph change, or a shared type with more than a handful of consumers all say yes. Then run the whole backend suite once and take the 7 minutes:

```bash
cd apps/api && VITEST_MAX_WORKERS=4 pnpm exec vitest run
```

Seven minutes beats a red deploy and a second push.

## Gate

Do not commit a contract change until either:

- every file found in steps 2 and 4 has been run and is green, **or**
- the full backend suite has been run and is green.

State in the commit which of the two you did. "Ran the files I touched" is not one of the options for a contract change.

## Why this exists

On 2026-08-08 a discriminated-union request body and a computed display rank shipped after the touched-file tests passed. Six tests in two untouched files broke, plus one hand-written frontend caller, and CI on `dev` went red. Every one of them was reachable by a `grep` for the changed symbol. The spec audit had even asserted there were no frontend consumers — the assertion was wrong, and the grep would have said so.

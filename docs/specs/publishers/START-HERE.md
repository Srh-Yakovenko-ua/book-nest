# START HERE — BookNest Publishers refactor

This is the single self-contained execution package for Claude Code. It covers the approved `/publishers` archive refactor and `/publishers/:id` detail refactor in one sequence: **archive/shared foundation first, detail second**.

Targets:

- `/publishers`
- `/publishers/:id`

Audited source:

- repository: `Srh-Yakovenko-ua/book-nest`
- branch: `dev`
- commit: `e5587ba5b395e7e4a99e3fc9e63f190838314b1e`
- audit date: 2026-09-22

Repository `CLAUDE.md` is authoritative and must be followed.

## Minimal read strategy

Do **not** load the whole package into context before coding.

At startup read only:

1. repository `CLAUDE.md`;
2. this file;
3. `IMPLEMENTATION-PLAN.md`;
4. `CHANGE-MAP.md`.

Then execute the plan phase by phase. At the start of each phase, read only the spec file/sections named by that phase. Do **not** preload all three spec files. At each test checkpoint, read only the matching `ACCEPTANCE.md` section(s). Read the full `ACCEPTANCE.md` once at final verification.

The authoritative product/API specification is split for context locality:

- `specs/01-ARCHIVE.md` — `/publishers` archive;
- `specs/02-DETAIL-OVERVIEW.md` — Publisher Details shell, stats, Overview, edit/delete and detail states/a11y;
- `specs/03-DETAIL-BOOKS-INTEGRATION.md` — contextual Books reuse, scoped Books APIs, cache sync and cross-feature guards.

`IMPLEMENTATION-PLAN.md` defines order only. `CHANGE-MAP.md` limits repository exploration. `ACCEPTANCE.md` proves completion and intentionally does not repeat every spec detail.

Do not search for or reconstruct older Publisher packages/prompts. This package is self-contained.

## Cheap drift guard

Before repository exploration:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
```

If HEAD is exactly the audited commit, **skip baseline rediscovery and skip a pre-implementation `/spec-to-ship`**. Follow `CHANGE-MAP.md` directly.

If HEAD differs, inspect only relevant drift:

```bash
git diff --name-only e5587ba5b395e7e4a99e3fc9e63f190838314b1e...HEAD -- \
  packages/shared/src/publishers.ts \
  packages/shared/src/books.ts \
  apps/api/src/modules/publishers \
  apps/api/src/modules/books \
  apps/web/src/features/publishers \
  apps/web/src/features/books \
  apps/web/src/features/books-to-buy \
  apps/web/src/features/series \
  apps/web/src/components/ui/stat-card.tsx \
  apps/web/src/components/ui/year-picker.tsx \
  apps/web/src/messages
```

If relevant drift exists, reconcile only that drift, then run **one** preflight `/spec-to-ship`. Do not re-audit unrelated areas or reopen approved product decisions.

## Execution budget

- Open only phase-relevant files from `CHANGE-MAP.md`.
- Batch all shared/API contract changes before generated-client refresh.
- Run `pnpm gen:api` **once at API CONTRACT FREEZE**. It is not a final-gate command.
- Run `/blast-radius` **once**, immediately after that generated-client refresh.
- Run focused tests at exactly three planned checkpoints unless a failing test requires a local rerun.
- Run `/spec-to-ship` **once at the end**; the only additional run is the conditional drift preflight above.
- Never hand-edit `apps/web/src/shared/api/generated/**`.
- Do not add speculative DB indexes/migrations; measure first.
- Do not perform unrelated cleanup/refactors.
- Preserve local uncommitted work; reconcile rather than overwrite.

If an implementation blocker discovered after API CONTRACT FREEZE genuinely requires an API/schema change, make the smallest spec-consistent correction and regenerate immediately. Do not mechanically rerun generation again at final verification.

## Regression boundary

Contextual Books extensions are required for Publisher Details, but their parameters/defaults must preserve existing behavior when the Publisher context is absent. Do not change the visible semantics of `/books`, `/my-library`, `/books-to-buy`, Series, Lists, Notes, Quotes or Characters except for the narrow approved shared extensions in this package.

## Definition of done

The work is done only when:

- the three focused checkpoints pass;
- the final repository gates from `IMPLEMENTATION-PLAN.md` pass, or unrelated pre-existing failures are explicitly reported;
- responsive/interaction smoke checks pass;
- the final `ACCEPTANCE.md` checklist is satisfied;
- the final `/spec-to-ship` reports no unmet approved requirement.

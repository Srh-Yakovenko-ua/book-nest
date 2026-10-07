# Book Nest — Characters tab / CharacterCard refactor

## Goal

Refactor **Book Details → Персонажі** so roster cards are compact, resilient to long names, and have correct browser click behavior without changing the existing Characters domain logic.

## Baseline

Analyzed against `dev` at:

- HEAD: `e8034f54ee827fec44803862f1e7f71855179363`
- latest merge at analysis time: `#244 refactor/character-edit-layout`

**Before editing, fetch/re-read current `dev`.** If HEAD moved, treat current code as the source of truth and preserve the product contract in this package rather than applying stale line-level assumptions.

## Read order

1. `00-README-AND-BASELINE.md`
2. `01-FINAL-PRODUCT-CONTRACT.md`
3. `02-INTERACTION-AND-IMPLEMENTATION.md`
4. `03-TESTS-AND-ACCEPTANCE.md`
5. `tasks.json`

## Relevant current files

Primary change candidates:

- `apps/web/src/features/characters/components/character-card.tsx`
- `apps/web/src/components/ui/character-card.tsx`
- `apps/web/src/features/characters/components/book-characters-tab.tsx`
- `apps/web/src/features/characters/components/character-card.test.tsx`
- `apps/web/src/features/characters/components/book-characters-tab.test.tsx`

Reference patterns only unless current code requires otherwise:

- `apps/web/src/features/books/components/book-row.tsx`
- `apps/web/src/components/ui/book-card.tsx`
- `apps/web/src/features/publishers/components/publisher-card.tsx`
- `apps/web/src/features/timeline/components/truncated-text.tsx`
- `apps/web/src/components/tooltip-hint.tsx`

Important consumer:

- `apps/web/src/features/characters/components/character-edit-preview.tsx` uses the shared `ui/character-card.tsx` primitive after PR #244. Shared primitive changes must not unintentionally change the edit preview.

## Current bug to fix

The roster feature currently combines a sibling full-card overlay link (`absolute inset-0 z-10`) with actions rendered inside a card that receives a CSS transform on hover. The transform creates a stacking context, so action `z-index` inside that card cannot reliably outrank the sibling overlay during real browser hit-testing.

Observed result: clicking `⋮` can navigate to Character Details instead of opening the menu.

JSDOM unit tests are insufficient proof for this specific regression because they do not model real browser hit-testing/stacking.

## In scope

- roster card navigation and action priority;
- card density and visual hierarchy;
- long display-name handling;
- conditional overflow tooltip;
- metadata placement;
- redundant total-count summary chip;
- focused unit/browser regression coverage.

## Preserve exactly

Do not redesign or replace the working Characters data/query behavior:

- server roster search;
- shared 300 ms debounce and min-2-character commit behavior;
- trim/normalization;
- current server sort options shown on this tab (`importance`, `name`);
- spoiler-safe reading context;
- infinite scroll, page size 20;
- optimistic **global** Favorite mutation;
- Add Character link/create/suggestion/duplicate-check flow;
- unlink semantics: remove this book appearance, keep the global character;
- existing empty/error/load-more behavior;
- Book Details Characters tab count.

## Out of scope / guardrails

Do not change unless strictly required to keep the focused frontend patch compiling:

- backend controllers/services/repositories;
- Prisma/schema;
- `@app/shared` character schemas/DTOs;
- generated API client;
- Character Details/Edit business logic;
- global Characters catalog UX;
- relationships/graphs/groups/theories;
- new server quick filters;
- manual sort/reordering UI;
- dependencies;
- unrelated cleanup.

Do not use `stopPropagation()` as the primary architecture fix if the DOM/link structure can solve the problem cleanly.

## Visual references

`reference/current-characters-tab.png` is the current roster baseline. `reference/long-name-problem.png` shows the pathological long-name row-height problem. These images are context only; the written contract and current design tokens/components take priority.

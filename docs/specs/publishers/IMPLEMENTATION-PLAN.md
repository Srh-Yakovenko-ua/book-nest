# IMPLEMENTATION PLAN — Single-pass execution order

This file defines **order**, not product semantics. For exact behavior, read only the cited file/sections under `specs/` when entering each phase. Do not reread the full package between phases.

## Phase 0 — Preflight

1. `CLAUDE.md` + cheap drift guard from `START-HERE.md`.
2. If audited HEAD matches, start Phase 1 immediately.
3. If relevant drift exists, reconcile it narrowly and run one preflight `/spec-to-ship`.

No broad repository audit. No package reread.

## Phase 1 — Archive/shared contract foundation

Read: `specs/01-ARCHIVE.md` §§2–8, 11–12, 15–18.

Implement/confirm only the archive/shared contracts needed before UI work:

- Publishers archive summary/list/query contracts;
- Publisher `readCount = finished + rereading`;
- Publisher `readingCount = reading + rereading`;
- active-Series-only publisher series semantics;
- approved wishlist terminology;
- narrow Books `publisherPresence` backend/frontend contract needed by archive insight deep-linking.

Do not generate the client yet.

## Phase 2 — Detail/API contract batch

Read only the contract-relevant sections:

- `specs/02-DETAIL-OVERVIEW.md` §§22–25 and only the Country contract inside §34;
- `specs/03-DETAIL-BOOKS-INTEGRATION.md` §§27–28, 30, 37.

Do not read Hero/layout/Edit UI or mutation-cache sections yet.

Implement the complete remaining shared/API batch:

- publisher-root `library-detail`, including visible zero-book publishers;
- detail-only `wishlistWithoutPriceCount`;
- compact `library-overview` DTO/controller/service/repository/mapper;
- publisher-scoped Books overview counts;
- publisher-scoped Author/Genre facets;
- required contextual search switch that excludes publisher identity only when Publisher Details passes that context; default global search remains unchanged;
- shared ISO alpha-2 validation/reference after one bounded reuse search.

Update focused backend/shared tests.

### API CONTRACT FREEZE

When the complete contract batch is stable:

```bash
pnpm gen:api
```

Never hand-edit generated output. From this point, treat API schemas as frozen unless a real implementation blocker proves a spec-consistent correction is necessary.

Then run `/blast-radius` exactly once.

### Checkpoint A — backend/shared

Run only the focused Publishers API/shared tests plus Books contextual-search/overview/facets regression tests. Rerun only failing suites after fixes.

## Phase 3 — Publishers archive frontend

Read: `specs/01-ARCHIVE.md` §§1–18.

Implement the final archive from the approved spec:

- header + four summary cards;
- q/search, semantic sort, quick/Advanced filters;
- chips/counter;
- infinite list + explicit Load More;
- cards/rows;
- sidebar/mobile insights;
- empty/error/loading states;
- responsive composition;
- Books `publisherPresence` deep link.

Do not touch Publisher Details here except already-planned shared primitives.

### Checkpoint B — archive

Run only Publishers archive model/component tests and the narrow Books `publisherPresence` regression tests.

## Phase 4 — Detail shell, URL, Hero, stats, gate states

Read: `specs/02-DETAIL-OVERVIEW.md` §§19–23, 33, 36.

Implement:

- exactly two tabs: Overview + Books;
- canonical clean Overview URL and Books query state;
- legacy `tab=toBuy` normalization;
- final Hero;
- exactly four detail stat cards;
- initial loading/error/not-found gate;
- successful zero-book state.

## Phase 5 — Publisher Overview

Read: `specs/02-DETAIL-OVERVIEW.md` §§24–26, 33, 36.

Implement:

- Overview hook/key;
- fetch only when Overview is active and `booksCount > 0`;
- latest/reading/wishlist/series compact sections;
- local skeleton/error/retry;
- mobile semantic order + independent desktop columns;
- no full BookView/Wishlist-page embedding and no view-all CTAs.

## Phase 6 — Contextual Books tab

Read:

- `specs/03-DETAIL-BOOKS-INTEGRATION.md` §§27–32, 37;
- `specs/02-DETAIL-OVERVIEW.md` §36 only for page-level accessibility/responsive constraints.

Refactor/reuse the **inner canonical Books archive core**, not the page-level shell. Implement:

- immutable publisher API scope derived from route id;
- canonical search with publisher identity excluded only in this context;
- all canonical sorts, quick filters and Advanced Filters except Publisher;
- publisher-scoped counts and Author/Genre facets;
- default-preserving shared option to hide redundant publisher metadata;
- canonical per-book/bulk actions, selection, cover viewer, Grid/List, Load More and states;
- no second `h1`.

## Phase 7 — Edit/Delete + cache synchronization

Read:

- `specs/02-DETAIL-OVERVIEW.md` §34;
- `specs/03-DETAIL-BOOKS-INTEGRATION.md` §35.

Implement:

- shared `CountrySelect` only if the bounded reuse search found none;
- existing `YearPicker`;
- current dirty/discard + validation behavior;
- zero-book destructive delete and linked-books blocked state;
- `router.replace('/publishers')` after successful delete;
- `publisherKeys.overview` + one publisher-root invalidation helper;
- relevant book/reading/ownership/queue/store-link/series invalidations only;
- no manual optimistic patching of aggregate Publisher stats/Overview.

## Phase 8 — i18n, accessibility, narrow cleanup

Read:

- `specs/01-ARCHIVE.md` §§16–18;
- `specs/02-DETAIL-OVERVIEW.md` §36;
- `specs/03-DETAIL-BOOKS-INTEGRATION.md` §37.

Finish:

- uk/en keys;
- one `h1`, section headings, tab aria label, website new-tab label;
- keyboard/focus/reduced-motion/mobile dialog behavior;
- one exact reference search before deleting obsolete Publisher-only components such as `PublisherToBuyTab`.

### Checkpoint C — detail/shared integration

Run only Publisher detail/view/edit/delete/Overview tests, embedded Books contextual tests, mutation invalidation tests and the explicit global Books/Wishlist/Series regression tests affected by shared changes.

## Phase 9 — Final verification

Read the **full `ACCEPTANCE.md` once**.

Cross-contract scenarios to verify explicitly:

- visible zero-book publisher;
- archive/detail/Books totals consistency;
- KSD → Vivat book move;
- want_to_buy → owned transition;
- StoreLink price update;
- Series rename/status/delete;
- global Books search still includes publisher;
- global Books quick `Прочитано` remains finished-only;
- global Wishlist best-offer behavior unchanged.

Run final gates once:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

If repository guidance defines a different complete/affected test command, use it and report exactly what ran. Do not fix unrelated pre-existing failures.

Visual check at approximately 390 px, 900 px and 1440–1536 px for archive + detail, including Overview, Books, Edit and Delete.

Minimal interaction smoke:

- archive search/filter/sort/view/load more;
- open Publisher Details;
- Overview/Books + browser back/forward;
- legacy `tab=toBuy` normalization;
- Books search/filter/quick/view/load more;
- Add Book preselected publisher;
- edit custom publisher;
- blocked delete + zero-book delete;
- no browser console errors.

Finally run `/spec-to-ship` once and report any unmet item instead of silently widening scope.

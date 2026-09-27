# CHANGE MAP — Phase-bounded repository access

Use this file to avoid repository-wide exploration. For each phase, open **OPEN FIRST** files only. Open **ONLY IF NEEDED** files when types, implementation, compile errors or focused tests point there. Do not recursively search every file containing “publisher”.

The phase-specific spec file/section is named in `IMPLEMENTATION-PLAN.md`. Do not open a different spec file merely for background context unless the plan explicitly names it or a real blocker requires the cross-reference.

Generated API files are output only:

- `apps/web/src/shared/api/generated/**` — **never hand-edit**.

## Phase 1 — Archive/shared contract foundation

### OPEN FIRST

- `packages/shared/src/publishers.ts`
- `apps/api/src/modules/publishers/api/publishers.controller.ts`
- `apps/api/src/modules/publishers/application/publishers.service.ts`
- `apps/api/src/modules/publishers/domain/publisher-library.mapper.ts`
- `apps/api/src/modules/publishers/infrastructure/publishers.repository.ts`
- `apps/api/src/modules/publishers/api/publishers.controller.library.test.ts`
- `apps/api/src/modules/publishers/api/publishers.controller.summary.test.ts`
- `apps/api/src/modules/publishers/application/publishers.service.library.test.ts`
- `apps/api/src/modules/publishers/domain/publisher-library.mapper.test.ts`

### ONLY IF NEEDED

- `packages/shared/src/books.ts`
- existing Publishers input/view DTO files under `apps/api/src/modules/publishers/api/**`
- Books `publisherPresence` query plumbing directly referenced by the archive deep link.

Do not inspect detail components yet.

## Phase 2 — Detail/API contract batch

### OPEN FIRST

- `packages/shared/src/publishers.ts`
- relevant Books shared query/facet schemas under `packages/shared/src/books.ts` or the exact adjacent file referenced by types
- `apps/api/src/modules/publishers/api/publishers.controller.ts`
- `apps/api/src/modules/publishers/application/publishers.service.ts`
- `apps/api/src/modules/publishers/domain/publisher-library.mapper.ts`
- `apps/api/src/modules/publishers/infrastructure/publishers.repository.ts`
- `apps/api/src/modules/publishers/publishers.module.ts`
- `apps/api/src/modules/publishers/api/publishers.controller.detail.test.ts`
- `apps/api/src/modules/books/application/book-library-read.service.ts`
- `apps/api/src/modules/books/infrastructure/book-library-read.repository.ts`
- `apps/api/src/modules/books/infrastructure/book-where.ts`
- `apps/api/src/modules/books/infrastructure/book-search.ts`
- existing Books facets service/repository/DTO files reached from controller types.

### EXPECTED NEW/EXTENDED

- Publisher `library-overview` view DTO;
- publisher-overview mapper;
- focused `publishers.controller.overview.test.ts`;
- compact repository row/select types if current conventions require them.

### ONE BOUNDED SEARCH ONLY

Search once for an existing ISO country dataset/helper/component. If absent, add shared ISO alpha-2 reference data and later a shared `CountrySelect`; do not keep searching for alternatives.

### ONLY IF NEEDED

- `apps/api/src/modules/media/**` only to reuse the already-exported media view builder required by compact cover DTOs;
- canonical Wishlist helper/source only to reuse existing `bestOffer` semantics;
- canonical Series status type/helper only to reuse existing status semantics.

Do not import `BooksModule` into `PublishersModule` just to reuse heavyweight Book assemblers.

## Phase 3 — Publishers archive frontend

### OPEN FIRST

Data/model:

- `apps/web/src/features/publishers/api/publisher-keys.ts`
- `apps/web/src/features/publishers/api/use-publishers-list.ts`
- `apps/web/src/features/publishers/api/use-publisher-summary.ts`
- `apps/web/src/features/publishers/model/publisher-query.ts`
- `apps/web/src/features/publishers/model/use-publisher-query.ts`
- `apps/web/src/features/publishers/model/publisher-query.test.ts`

Components:

- `apps/web/src/features/publishers/components/all-publishers.tsx`
- `apps/web/src/features/publishers/components/all-publishers-view.tsx`
- `apps/web/src/features/publishers/components/all-publishers.test.tsx`
- `apps/web/src/features/publishers/components/publisher-toolbar.tsx`
- `apps/web/src/features/publishers/components/publishers-content.tsx`
- `apps/web/src/features/publishers/components/publisher-summary-cards.tsx`
- `apps/web/src/features/publishers/components/publisher-overview-panel.tsx`
- `apps/web/src/features/publishers/components/publisher-card.tsx`
- `apps/web/src/features/publishers/components/publisher-row.tsx`

### ONLY IF NEEDED

- `apps/web/src/features/publishers/model/publisher-format.ts`
- Publisher card/row stories/tests as directly affected;
- `apps/web/src/components/debounced-search-input.tsx` for reuse only;
- Books `publisherPresence` query/chip/reset files directly required by the deep link;
- summary/mobile/sidebar primitives only when the implementation needs a narrow reuse/extension.

Do not create a second Publishers feature slice.

## Phases 4–5 — Detail shell + Overview

### OPEN FIRST

- `apps/web/src/features/publishers/api/publisher-keys.ts`
- `apps/web/src/features/publishers/api/use-publisher-details.ts`
- `apps/web/src/features/publishers/components/publisher-details.tsx`
- `apps/web/src/features/publishers/components/publisher-details-view.tsx`
- `apps/web/src/features/publishers/components/publisher-details-hero.tsx`
- `apps/web/src/features/publishers/components/publisher-stats-grid.tsx`
- `apps/web/src/features/publishers/components/publisher-overview-tab.tsx`
- existing Publisher detail fixtures/tests.

### ONLY IF NEEDED

- `apps/web/src/components/page-tabs.tsx` — reference first; change only if a default-preserving extension is required;
- `apps/web/src/components/empty-state.tsx` — reuse only;
- `apps/web/src/components/ui/stat-card.tsx` — only for the narrow optional label presentation prop;
- existing shared Menu/Dialog primitives.

Add one Publisher Overview hook following existing query conventions; do not add a parallel data layer.

## Phase 6 — Contextual Books tab

### OPEN FIRST

- `apps/web/src/features/publishers/components/publisher-books-tab.tsx`
- `apps/web/src/features/books/components/books-library.tsx`
- `apps/web/src/features/books/components/books-library-view.tsx`
- `apps/web/src/features/books/model/library-query.ts`
- `apps/web/src/features/books/model/use-library-query.ts`
- `apps/web/src/features/books/model/library-quick-filters.ts`
- `apps/web/src/features/books/model/use-library-filter-chips.ts`
- `apps/web/src/features/books/api/use-books.ts`
- `apps/web/src/features/books/api/use-library-overview.ts`
- `apps/web/src/features/books/api/use-book-facets.ts`
- `apps/web/src/features/books/api/book-keys.ts`
- `apps/web/src/features/books/components/library-advanced-filters.tsx`
- `apps/web/src/features/books/components/library-quick-filters.tsx`
- `apps/web/src/features/books/components/library-active-filters.tsx`
- `apps/web/src/features/books/components/book-row.tsx`
- `apps/web/src/components/ui/book-card.tsx`

### ONLY IF NEEDED

- `library-search-input.tsx`, sort select/sheet, bulk bar, book-card-actions and cover viewer when wiring the reused inner core;
- selection store/actions reached from the existing archive core;
- tests for shared BookCard/BookRow only if their new default-preserving prop requires direct coverage.

Rules:

- reuse/refactor inner Books archive core;
- never mount the full page-level Books shell under Publisher Details;
- never create `PublisherBookCard`, `PublisherBookRow` or `PublisherToolbar` forks.

## Phase 7 — Edit/Delete + cache synchronization

### OPEN FIRST

- `apps/web/src/features/publishers/components/edit-publisher-dialog.tsx`
- `apps/web/src/features/publishers/components/delete-publisher-dialog.tsx`
- `apps/web/src/features/publishers/api/use-update-publisher.ts`
- `apps/web/src/features/publishers/api/use-delete-publisher.ts`
- `apps/web/src/features/publishers/api/publisher-keys.ts`
- `apps/web/src/features/books/api/use-book-mutation-sync.ts`
- `apps/web/src/features/books/api/use-create-book.ts`
- `apps/web/src/features/books/api/use-update-book.ts`
- `apps/web/src/features/books-to-buy/api/use-store-links.ts`
- `apps/web/src/features/series/api/use-update-series.ts`
- `apps/web/src/features/series/api/use-delete-series.ts`
- `apps/web/src/components/ui/year-picker.tsx`

### ONLY IF NEEDED

- exact existing delete/bulk hooks/actions reached by direct references from the canonical Books actions;
- shared CountrySelect location selected during the one bounded Phase-2 reuse search.

Do not add an event bus or manually patch aggregate Publisher statistics.

## Phase 8 — i18n/a11y/cleanup

### OPEN FIRST

- `apps/web/src/messages/uk.json`
- `apps/web/src/messages/en.json`
- only components changed in Phases 3–7.

Terminology guard:

- page/workspace noun: `Список бажань`;
- block/filter/count context: `У списку бажань`;
- never final Publisher UI `Бажані` or `До покупки`.

### ONE-REFERENCE-SEARCH CLEANUP RULE

After replacements are complete, run one exact reference search for each touched obsolete Publisher-only file. Delete it and its dedicated test/story only if no consumer remains. Typical candidates:

- `publisher-pagination.tsx`;
- `publishers-missing-banner.tsx`;
- `publisher-to-buy-tab.tsx`.

No repository-wide dead-code cleanup.

## DO NOT OPEN/REFACTOR unless a direct compile/test failure points there

- unrelated Notes/Quotes/Characters/Lists features;
- global Wishlist page/layout/pricing semantics;
- Series progress semantics;
- `/my-library` ownership scope semantics;
- authentication;
- deployment/release code;
- global design tokens;
- Prisma schema/migrations/indexes without measured need.

No database migration is expected.

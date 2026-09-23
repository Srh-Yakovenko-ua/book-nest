# ACCEPTANCE — Checkpoint and final go/no-go

Use this file only at the checkpoints named in `IMPLEMENTATION-PLAN.md`, then read it once in full at final verification. The files under `specs/` remain the source of exact labels, option order, copy and tie-breakers; this checklist verifies the high-value invariants instead of repeating the specification.

## Checkpoint A — Shared/API contracts

### Publishers archive API

- [ ] `/api/publishers/library/summary` and `/api/publishers/library` satisfy `specs/01-ARCHIVE.md` §§2–8 and 11–18.
- [ ] Publisher `readCount = finished + rereading` and `readingCount = reading + rereading` everywhere in the Publisher domain.
- [ ] Publisher series counts/having semantics include active Series only.
- [ ] Archive search remains publisher identity/name only; sort/filter semantics and deterministic tie-breakers match SPEC.
- [ ] Whole-library summary/insight data is computed server-side, not from loaded archive pages.
- [ ] Archive remains represented-publishers-only; a visible publisher with zero user books does not appear in `/publishers` archive.

### `library-detail`

- [ ] Visible global publisher with zero user books -> 200 with zero/null stats.
- [ ] Own custom publisher with zero user books -> 200 with zero/null stats.
- [ ] Foreign custom publisher and missing publisher -> 404.
- [ ] `booksCount` includes all active current-user books for the publisher, including `want_to_buy`.
- [ ] `readCount = finished + rereading`; `readingCount = reading + rereading`.
- [ ] average rating ignores null ratings; `ratedBooksCount` is correct.
- [ ] `wishlistWithoutPriceCount` is based on absence of a priced canonical StoreLink, not `purchaseInfo.expectedPrice`.
- [ ] `seriesCount` includes active Series only.
- [ ] Publisher-root LEFT JOIN cannot count a synthetic zero-book row as a book.
- [ ] Common archive/detail stats agree for represented publishers.

### `library-overview`

- [ ] `GET /api/publishers/:id/library-overview` exists and returns compact DTOs, not full BookView/Wishlist rows.
- [ ] Visible zero-book publisher returns `latestBook: null` and empty arrays with 200.
- [ ] Latest book, active-reading, wishlist and series eligibility/order/limits exactly match `specs/02-DETAIL-OVERVIEW.md` §§24–25.
- [ ] Active-reading rank uses reading-specific activity, not generic `Book.updatedAt`.
- [ ] Wishlist preview reuses canonical best-offer/currency priority.
- [ ] Soft-deleted Series are not exposed through latest/series preview.
- [ ] Overview is assembled from bounded queries/selects; no heavyweight full Book relations are required solely for compact blocks.

### Canonical Books contextual extensions

- [ ] Existing `/api/books` remains the books list source; no `/publishers/:id/books` endpoint exists.
- [ ] Books overview endpoint accepts Publisher context; absence preserves current behavior; Publisher Details requests it.
- [ ] Books facets endpoint accepts Publisher context; absence preserves current behavior; Publisher Details requests it.
- [ ] Publisher-context Author/Genre facets are scoped to current user + fixed publisher.
- [ ] Canonical search can exclude publisher identity when Publisher Details requests that context.
- [ ] Global `/books` search still includes publisher identity.
- [ ] No Publisher-specific quick-count/facet/search endpoint was created.
- [ ] Shared ISO country validation accepts real ISO alpha-2 codes/null and rejects invalid two-letter pseudo-codes.

### Checkpoint A regression boundary

- [ ] `/books` and `/my-library` quick `Прочитано` remains finished-only.
- [ ] Global Wishlist best-offer/sort/filter semantics are unchanged.
- [ ] Series progress/finished semantics are unchanged.
- [ ] `/my-library` ownership scope is unchanged.
- [ ] Generated API files were regenerated, not hand-edited.

## Checkpoint B — Publishers archive frontend

All exact visible labels/options/order come from `specs/01-ARCHIVE.md` §§1–18.

### Header/summary/query controls

- [ ] Header has only approved title/subtitle/Add Book action.
- [ ] Exactly four approved archive summary cards; whole-library, non-clickable, correct fallback states.
- [ ] Canonical search URL is `q` with shared debounce/min-length/clear/back-forward behavior.
- [ ] One semantic sort control uses the approved 12 values; no canonical frontend `order` URL state remains.
- [ ] Quick filter uses `filter`, approved values/order and no counts **on `/publishers` archive**.
- [ ] Advanced Filters use local draft and one Apply batch; draft edits do not refetch.
- [ ] Search + quick + Advanced filters combine with server-side AND semantics.
- [ ] Active chips, filter badge and Clear/Clear All behavior match SPEC.

### Results/load-more/items

- [ ] Archive uses `useInfiniteQuery`, page size 24 and explicit Load More; no numbered pagination or auto infinite scroll.
- [ ] New q/filter/sort starts a fresh page-1 sequence without showing old-query cards as new results.
- [ ] View change preserves loaded pages.
- [ ] Flattened pages are deduped by publisher id.
- [ ] Next-page failure preserves loaded cards/counter and retries locally.
- [ ] Grid/List hierarchy, source marker rules, rating/last-added fallbacks and mobile behavior match SPEC.

### Insights/states/responsive

- [ ] Desktop/tablet insight order and eligibility match SPEC; insight rows use whole-library backend data.
- [ ] Mobile Overview reuses the existing panel pattern and does not create a separate insight endpoint.
- [ ] True-empty, search-only zero, filtered zero, initial error, new-query loading and next-page error are distinct.
- [ ] Books `publisherPresence=missing` deep link works; it has the approved chip/reset behavior and no new Advanced control.
- [ ] Mobile/tablet/desktop layout rules in `specs/01-ARCHIVE.md` §14 are met.
- [ ] Archive has no duplicate missing-publisher banner, old numbered pagination or obsolete order toggle.

## Checkpoint C — Publisher Details + shared frontend integration

### Tabs/URL/Hero/stats

- [ ] Exactly two tabs: `Огляд`, `Книги`; no Publisher Wishlist/toBuy tab.
- [ ] Overview canonical URL is clean; Books uses `?tab=books` + canonical Books query state.
- [ ] Fixed publisher comes only from route id and is never removable URL/filter state.
- [ ] Books -> Overview strips Books list params; Overview -> Books starts canonical default Books state.
- [ ] browser Back/Forward restores actual historical URLs.
- [ ] legacy `tab=toBuy` normalizes via replace to Books + canonical want-to-buy ownership state; invalid tab normalizes to clean Overview.
- [ ] Exactly one page `h1`, publisher name.
- [ ] Hero has no internal back link or `Власне` badge; missing metadata renders nothing.
- [ ] Add Book preselects publisher; global publisher has no management menu; custom publisher has `⋯` with Edit/Delete.
- [ ] Exactly four non-clickable detail stat cards with semantics/microfacts from `specs/02-DETAIL-OVERVIEW.md` §22.

### Detail state hierarchy

- [ ] `library-detail` gates the page; initial loading uses final-layout skeleton.
- [ ] Detail 404 replaces the whole page.
- [ ] Initial non-404 detail error has Retry + back action.
- [ ] Cached detail is not discarded by background refetch failure.
- [ ] `booksCount=0` is a successful state, not 404/error.
- [ ] Direct Books tab does not eagerly fetch Publisher Overview.
- [ ] Revisited tab can render cached data immediately.

### Overview UI

- [ ] `booksCount=0` uses the approved single empty state and skips the Overview request.
- [ ] Empty individual blocks are hidden, not replaced by placeholders.
- [ ] Latest/reading/wishlist/series blocks expose only approved compact information and links.
- [ ] Wishlist block uses canonical price or `Без ціни`, with no aggregate money.
- [ ] No Overview `Усі`, `Ще N` or view-all CTAs.
- [ ] Mobile semantic order is latest -> reading -> wishlist -> series.
- [ ] Desktop uses independent columns: latest/series left, reading/wishlist right.
- [ ] Overview loading/error/retry is local to its panel.

### Contextual Books tab

- [ ] Reuses/refactors canonical Books inner archive core; no duplicate page shell and no second `h1`.
- [ ] Universe is all active current-user books for the fixed publisher, including `want_to_buy`.
- [ ] Unfiltered Books total equals detail `booksCount`.
- [ ] Search placeholder/behavior, all 15 canonical sorts and all 10 canonical quick filters match current Books conventions.
- [ ] Publisher-context search excludes publisher identity; global search behavior remains unchanged.
- [ ] Books quick `Прочитано` remains finished-only while Publisher summary read semantics remain finished+rereading.
- [ ] Advanced Filters are canonical minus Publisher; no Publisher-only Series selector.
- [ ] Fixed publisher is not a chip, filter badge contribution or clearable dimension.
- [ ] Author/Genre facets and quick counts are Publisher-scoped.
- [ ] Shared BookCard/BookRow are reused; publisher metadata is hidden only in this fixed context and remains visible globally.
- [ ] Canonical per-book actions, Selection Mode, bulk actions, cover viewer, Grid/List and Load More remain available.
- [ ] True-empty/search-zero/filter-zero/load-more-error states remain distinct and local.

### Edit/Delete/cache

- [ ] Edit is custom-only; fields are Name, Country, Website, Founded year in approved order.
- [ ] Country uses shared searchable CountrySelect; year uses shared YearPicker.
- [ ] Clearing optional values persists null; dirty close asks for discard confirmation.
- [ ] Duplicate 409 is a Name field error; generic server errors are form-level.
- [ ] Successful save closes, toasts and updates cache without reload.
- [ ] Zero-book delete uses destructive confirmation.
- [ ] Linked-books delete shows the blocked explanation + Books-tab action; server 409 maps to the same state.
- [ ] Successful delete uses `router.replace('/publishers')`.
- [ ] `publisherKeys.overview(id)` and one publisher-root invalidation helper exist.
- [ ] Relevant book/reading/ownership/queue/store-link/series mutations invalidate Publisher-derived data; favorite/tag/list-only changes do not add pointless Publisher invalidation.
- [ ] Aggregate Publisher stats/Overview are invalidated/refetched, not hand-patched.

### Responsive/a11y/shared regression

- [ ] Mobile Hero keeps primary CTA visible; summary is 2 columns mobile / 4 desktop.
- [ ] Tabs/controls/dialogs preserve current keyboard/focus/reduced-motion behavior.
- [ ] Website announces new-tab behavior accessibly.
- [ ] Advanced Sheet/mobile Books controls reuse canonical behavior; no Publisher-specific mobile toolbar.
- [ ] Global BookCard/BookRow still show publisher.
- [ ] Global Advanced Filters still include Publisher.
- [ ] No unrelated Notes/Quotes/Characters/Lists redesign or speculative DB migration/index.

## Final cross-contract invariants

- [ ] For an unfiltered represented publisher: `archive item.stats.booksCount == library-detail.stats.booksCount == /api/books?publisher=id totalCount == /api/books/overview?publisher=id summary.total`.
- [ ] `library-detail.stats.wantToBuyCount == scoped Books overview wantToBuy == scoped Books list with owner=want_to_buy total`.
- [ ] Latest Overview book aligns with canonical unfiltered `created_desc` first result and `lastBookAddedAt`.
- [ ] Moving a book KSD -> Vivat updates both Publishers-derived data and the scoped list without reload.
- [ ] `want_to_buy -> owned` keeps the book in Publisher Books but removes it from wishlist subset/count/preview.
- [ ] Adding/removing StoreLink price updates `wishlistWithoutPriceCount`/Overview price without changing `booksCount` or `wantToBuyCount`.
- [ ] Series rename/status/delete updates Publisher Overview/seriesCount without changing global Series progress semantics.

## Final verification

- [ ] Checkpoints A, B and C passed.
- [ ] `pnpm gen:api` was run at API CONTRACT FREEZE; it was not rerun mechanically at final gates.
- [ ] `/blast-radius` ran once after the complete contract batch/generated refresh.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm format:check` passes.
- [ ] Required complete/affected test command passes, or unrelated pre-existing failures are explicitly documented.
- [ ] Visual checks passed at ~390 / ~900 / ~1440–1536 for archive and detail.
- [ ] Minimal interaction smoke from `IMPLEMENTATION-PLAN.md` passes with no browser console errors.
- [ ] If audited HEAD had relevant drift, the single preflight `/spec-to-ship` was completed; otherwise it was intentionally skipped.
- [ ] Final `/spec-to-ship` reports no unmet approved requirement.

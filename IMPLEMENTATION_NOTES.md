# Publishers — Wave 1 implementation notes

Foundation + server-side LIST page only. Detail page, edit/delete dialogs and add-book prefill are Wave 2 (not built).

## Deviations from the brief

1. **Empty / no-results copy is sourced from i18n, not the `EMPTY_STATES` registry.**
   The brief said use `EMPTY_STATES.publishers` (initial empty) and `EMPTY_STATES.search`
   (no-results). Those registry entries are Ukrainian-only hardcoded strings. To stay
   locale-correct for both `uk` and `en`, the states are built as inline `EmptyStateEntry`
   objects from the `publishers.states` i18n namespace, reusing the registry's illustrations
   (`empty-publishers`, `empty-search`, `error-generic`). This mirrors how `series` and
   `dedications` build their states via `t(...)`.

2. **Per-item geography shows the country name, not the bucket.**
   The API exposes only `countryCode` per publisher (the `geography` ua/foreign/unknown enum
   is a list filter, not a per-row field). Cards/rows render the country name derived from
   `countryCode` via `Intl.DisplayNames` (`model/publisher-format.ts`), falling back to an
   "unknown country" label. No frontend geography bucketing is computed.

3. **Boolean filters are on/off chips (null ↔ true).**
   `hasBooksToBuy` / `hasRatedBooks` / `hasSeries` toggle between unset (`null`) and `true`.
   The API's `"false"` variant is not surfaced in Wave 1 (standard filter-chip UX). They go
   over the wire as the string `"true"` via `String(bool)`, matching the books pattern.

4. **Number/date formatting uses the active locale.**
   `formatNumber` / `formatDate` from `@/lib/format` + `useLocale()` (per the recent
   reading-queue "format stat card numbers with the active locale" direction), not
   `.toLocaleString()`.

5. **Toolbar collapses via responsive wrap, not a Sheet/Dialog.**
   Acceptable per the brief for Wave 1. Search reuses the shared `DebouncedSearchInput`.

6. **Classic pagination (not infinite scroll)**, per the brief — `useQuery` +
   `keepPreviousData` + page controls (mirrors `dedications`), page resets to 1 on any
   search/filter/sort change.

## Verified facts

- Generated client `publishersControllerLibraryList` / `publishersControllerLibrarySummary`
  and shared schemas `LibraryPublishersPageSchema` / `LibraryPublishersSummarySchema` exist
  in this worktree (branch `feat/publishers`).
- Banner target `/books?publisherPresence=missing` is valid: `publisherPresence` exists in
  `BooksControllerListParams` (shared `PublisherPresenceSchema` = `all | assigned | missing`).
- `request()` returns the parsed JSON body directly, so responses are validated with
  `Schema.parse(await controller(...))` (same as `books` / `dedications`).

## Not run (out of scope per brief)

- Tests (`publisher-query.test.ts` written but not executed), knip, and any browser/Playwright
  verification. Gates run and green: `typecheck`, ESLint (feature scope), Prettier.

---

# Publishers — Wave 2 implementation notes

Detail page (overview / books / to-buy tabs), edit/delete custom dialogs, and add-book prefill.

## Data sourcing (no frontend aggregates)

- **Detail + KPIs** come straight from `publishersControllerLibraryDetail` →
  `LibraryPublisherDetailSchema.parse`. The KPI grid renders `details.stats` verbatim; nothing is
  summed on the client. `seriesCount` is shown as the API value (no client series derivation).
- **Books tab** sources rows from `useLibraryBooks` (the canonical `booksControllerList`) scoped
  with a fixed `publisher: [id]` route context — a server filter, not a frontend aggregate.
  Reading-status / search / sort / view are local `nuqs` URL state; `publisherId` is never a user
  filter. Rows/actions reuse the canonical books stack (`BookCard`/`BookRow`/`BookCardActions`/
  `BookActionDialogs`) via the newly-exported `useLibraryActions`/`useLibraryBookLabels` hooks.
- **To-buy tab** fetches the whole wishlist once (`useWishlist` → `booksControllerWishlist`) and
  **filters client-side** to `book.publisher?.id === id` (same filter the existing
  `books-to-buy-toolbar` applies). Rows reuse `BooksToBuyRow`.
- **Overview tab** shows the single latest book (`useLibraryBooks`, `pageSize: 1`,
  `sort: created_desc`, first item) plus a sliced to-buy preview from the same wishlist source.

## Deviations from the brief

1. **Series tab deferred to v1.1** (per the brief). There is no endpoint returning distinct
   series-by-publisher, and deriving them across all the publisher's books on the client would be a
   forbidden frontend aggregate. Tabs are `["overview","books","toBuy"]`; the `seriesCount` KPI
   still shows the API count. No broken Series tab is rendered.

2. **Books tab is a lighter local list, not a re-mounted `BooksLibrary`.** `BooksLibrary`/
   `BooksLibraryView` hard-render a page header + global summary cards + sidebar + quick/advanced
   filters — wrong for an embedded tab, and its overview summary is library-wide (not
   publisher-scoped). Instead the tab reuses the canonical building blocks directly with a minimal
   toolbar (search + reading-status chips + sort + grid/list) and canonical row actions. Bulk
   selection and quick/advanced filters are intentionally omitted for a scoped tab.

3. **Two canonical hooks extracted from `BooksLibrary`** (`hooks/use-library-actions.ts`,
   `hooks/use-library-book-labels.ts`) — a pure, behavior-preserving extraction so the library page
   and the publisher Books tab share one source of truth for row actions + display labels (DRY on
   real second use). `BooksLibrary` now consumes them.

4. **Books feature public surface widened** (`features/books/index.ts`): `BookRow`,
   `BookCardActions`, `BookActionDialogs`, `DiscardConfirmDialog`, `useLibraryBooks`,
   `useLibraryActions`, `useLibraryBookLabels`, `toLibraryBook`, `LibraryBook`, `PendingBookAction`,
   `LibraryListParams`, and the `LIBRARY_*` constants — promoted to public API because a sibling
   feature (publishers) now renders books canonically. `books-to-buy` similarly exports
   `useWishlist` + `BooksToBuyRow`.

5. **To-buy summary totals are a client grouping over the filtered subset** (count + per-currency
   sums of `bestOffer.price`, plus a "without price" count), formatted with `publisherPriceLabel`.
   There is no per-publisher wishlist-summary endpoint; currencies are never converted. This is a
   display-time grouping of an already-client-derived list (the whole books-to-buy feature computes
   offers client-side), not a stat that belongs on the API.

6. **Edit dialog validation** uses a local RHF schema that composes the shared field schemas
   (`TaxonomyNameSchema`, `PublisherCountryCodeSchema`, `PublisherWebsiteUrlSchema`,
   `PublisherFoundedYearSchema`) via `safeParse` refinements — name required, country/site/year
   optional — so validation is not weakened. Empty optionals submit as `null`. Error mapping:
   409 → `setError("name", duplicate)`, 422/other → generic alert. Dirty-close routes through
   `DiscardConfirmDialog`.

7. **`create-book` invalidation extended** to `publisherKeys.root` + `["publishers"]` so the
   publisher list/summary/detail and the book-form picker stay fresh after creating a book
   (minimal, per the brief).

8. **`books ← publishers` import** in `create-book-form.tsx` (`usePublisherDetails`) mirrors the
   pre-existing `books ← series` import there; imported from the deep module path
   (`@/features/publishers/api/use-publisher-details`) to avoid a barrel import cycle.

## Gates (Wave 2)

- `pnpm --filter @app/web typecheck` — green.
- `pnpm lint` — 0 errors (6 pre-existing warnings in unrelated files; none in Wave 2 code).
- `pnpm format` / `prettier --check` on all changed files — green. uk/en `publishers` key parity
  verified (171 == 171, no diff).
- Not run per brief: tests, knip, browser/Playwright.

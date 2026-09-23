# VERIFY — publishers (2026-09-23)

Base: HEAD 0f4b344f, all work uncommitted. Diff: 106 tracked files changed, 5 deleted, ~75 untracked (incl. generated models).

Result: 56 done / 2 partial / T9.2 pending gates (not judged) / T9.4 partial (this audit).

## Non-done

| Task | Status  | Gap                                                                                                                                                                                                                                                                     | Proof                                                                                    |
| ---- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| T3.8 | partial | Spec 01 says "button loads/disables". The Load More button sets only `aria-busy` and shows a spinner. It is not `disabled`. Repeat clicks are blocked by an early return in `requestNextPage`.                                                                          | apps/web/src/features/publishers/components/publishers-content.tsx:162, :236             |
| T5.3 | partial | Spec 02 says "Mobile/tablet semantic order: latest→reading→wishlist→series". The DOM order is latest, series, reading, wishlist (two `contents` columns). Only CSS `order-*` reorders it on mobile, so screen-reader and Tab order stay latest→series→reading→wishlist. | apps/web/src/features/publishers/components/publisher-overview-content.tsx:12-17, :27-50 |
| T9.2 | todo    | Final gates pending (not audited).                                                                                                                                                                                                                                      | —                                                                                        |
| T9.4 | partial | Blocked by T3.8, T5.3, T9.2.                                                                                                                                                                                                                                            | —                                                                                        |

## Key proofs (done)

- T1.1/T1.2/T2.1: packages/shared/src/publishers.ts (summary fields, `filter` enum, `hasWantToRead`/`hasQueue`, `LibraryPublisherDetailStatsSchema`, `LibraryPublishersSummaryQuerySchema`).
- T1.3/T1.4: publishers.repository.ts:31-39 (PUBLISHER_STAT_SQL on PUBLISHER_BOOK_STATUSES), :571-614 (having and tie-breakers), :624 (search on p.search_text only), :695-710 (quick filter).
- T1.5: publishers.repository.ts:408-492 (summaryInsights), controller locale query with ZodQueryPipe.
- T2.2: publishers.repository.ts:264-294 (publisher-root LEFT JOIN, count(b.id), NOT EXISTS priced store link); service updateCustom returns libraryDetail (publishers.service.ts:306).
- T2.3–T2.6: packages/shared/src/publisher-overview.ts; publisher-overview.repository.ts:70-140; publisher-overview.mapper.ts:21,112,165,180; publishers.module.ts (MediaModule, no BooksModule); controller `:publisherId/library-overview`.
- T2.7–T2.9: book-library-read.service.ts buildOverviewSummary (publisherId threaded into all 13 counts); book-facets.repository.ts publisherMatches; book-search.ts includePublisher default true; books.ts `searchPublisher: z.stringbool().default(true)`.
- T2.10: countries.ts has 249 unique codes (XX/ZZ absent), `IsoCountryCodeSchema`; test apps/api/src/modules/publishers/domain/publisher-country-code.test.ts.
- T3.1/T3.2: publisher-query.ts:23-216; use-publishers-list.ts:35-50 (infinite, no keepPreviousData, dedupe select).
- T4.1: publisher-detail-url.ts:69-88 (toBuy → books + owner want_to_buy; stale params → clean overview; publisher param stripped).
- T4.4: publisher-details.tsx:24-27 (gate on data presence, retry = refetch).
- T5.1: publisher-details-view.tsx:34-36 (enabled only on overview and booksCount > 0).
- T6.2: library-query.ts toLibraryListParams/withoutPublisherFilters; use-library-query.ts; use-library-overview.ts; use-book-facets.ts.
- T6.4: BookRow `showPublisher` (book-row.tsx:32,83,352). BookCard is left unchanged, and library-archive-view.tsx:417 passes `publisher={undefined}` in context.
- T7.3/T7.5/T7.6: use-update-publisher.ts:24-31; publisher-keys.ts:20-28; call sites in use-book-mutation-sync, use-create-book, use-update-book, use-book-actions (bulk queue/delete/ownership/status, delete, queue remove), use-reading-queue, use-store-links, use-update-series, use-delete-series. Not on favorite/tags/list.
- T8.1: uk/en key parity 0 diff. The publishers namespace has no "Бажан" or "До покупки". The only new keys outside it are books.library.activeFilters.publisherPresence.*.
- T8.3: exactly 5 deletions, zero remaining references.
- T9.3: accepted from the orchestrator's smoke (34 screenshots), and detail-12bis-overview-390.png was spot-checked.

## Drift

None outside the accepted deviations (eslint boundaries exception, publisher-overview.ts, library-summary `valueKind`, stat-card `labelOverflow`, `countAdvancedFilterChips`, archive core split). Side effect: `useBookMutationSync` now also invalidates publishers for loan and delivery mutations (use-loan.ts, use-delivery.ts, loans/use-loan-actions.ts). That is harmless but was not listed in T7.6.

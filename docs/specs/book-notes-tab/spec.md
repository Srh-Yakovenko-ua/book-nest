<!-- Source: D:/IT/book-docs/new/5_BOOK_NEST_BOOK_NOTES_TAB_CLAUDE_CODE_v2_OPTIMIZED/BOOK_NEST_BOOK_NOTES_TAB_CLAUDE_CODE_v2_OPTIMIZED (00_START_HERE.md, 01..04, HANDOFF.md, prompts/01..04, CLAUDE_START_PROMPT.txt), copied verbatim 2026-10-17. Scope: the whole package, decisions 01-20, matrix NAV-01..REG-01. Branch feat/book-notes-tab off origin/dev 6b948851 at the user's request (overrides the package's no-branch-switch note). -->

---

<!-- file: 00_START_HERE.md -->

# Book Nest · Book Details → Notes tab · Claude Code package v2

**Purpose:** implement exactly the approved 20 UX decisions with minimal token consumption and maximal reuse of current project code. This is an implementation package, **not an implementation**.

**Repository:** `https://github.com/Srh-Yakovenko-ua/book-nest`  
**Audited baseline:** `dev` at `4a9a5d684cb19d783523dfc6a6ff4111b64ceb16` (2026-10-17). This SHA is a reference, **not** a requirement to reset or checkout. Inspect the actual worktree HEAD before editing; if different, compare only affected files to the file map and update implementation choices accordingly.

## Source of truth / read order (once per task)

1. This file.
2. `01_APPROVED_DECISIONS.md` — immutable product requirements №1–20.
3. `02_TECHNICAL_CONTRACT.md` — acceptance-critical behavior and scoped engineering decisions.
4. `03_FILE_MAP.md` — targeted discovery, no repo-wide scanning unless needed.
5. `04_TEST_MATRIX.md` — required validation.

Run `prompts/01_BACKEND_DTO.md` → `02_TAB_UI.md` → `03_URL_CACHE_MUTATIONS.md` → `04_QA_FINAL.md`. Each stage must produce a short handoff following `HANDOFF.md`. No repeated long audits or copies of specs between stages.

## Worktree safety

- Work strictly in the **already selected** Book Nest working tree. Start with `pwd`, `git status --short`, `git branch --show-current`, `git rev-parse HEAD`.
- Do not switch/reset branches, pull/rebase, create a worktree, or overwrite uncommitted user changes. Do not commit/push without explicit request.
- Inspect existing patterns before changing them. Scope = Book Details notes tab + minimum shared changes/tests. No broad cleanup or new global architecture.
- On ambiguity, prefer existing code, smallest implementation, tested backward compatibility. Stop for a user decision only if approved decisions fundamentally conflict or a destructive operation is required.

## Output protocol (concise)

For each stage: `Completed | Files | Tests (pass/fail/not run) | Remaining risks | Next stage`. Keep updates short; reference files rather than pasting long source. Continue through all four stages if unblocked; do not stop merely to ask permission between stages.

## Definition of done

All items of `04_TEST_MATRIX.md` addressed; no notes data fetch on Overview; global books/series notes functionality preserved; tests/lint/typecheck pass or exact blockers documented; changed-file summary and any scope deviations reported. **Do not claim tested if not executed.**

---

<!-- file: 01_APPROVED_DECISIONS.md -->

# Approved UX decisions №1–20 · immutable

These are locked product choices. Technical implementation may adapt to current dev; **do not silently replace** any decision.

| #   | Decision                              | Exact constraint                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Dedicated Book Details tab            | Insert `Нотатки` immediately after `Огляд`; remove _entire_ Book Overview `Мої нотатки` block (including preview, add and view-all). Keep series notes behavior.                                                                                                                                           |
| 02  | Compact UI                            | Search, quick filters, category filter, sorting, one-column list, Add note. No notes summary cards, global archive overview, book/author selectors, or separate right sidebar.                                                                                                                             |
| 03  | Default page sort                     | Ascending page; null pages last; within same page newest `createdAt DESC`; stable `id` final tie-break. Pin does not override page sort. Sorting done before pagination on server.                                                                                                                         |
| 04  | Five quick filters                    | `Усі`, `Обрані`, `Закріплені`, `Без спойлерів`, `Зі спойлерами` with current archive semantics. Mobile: horizontally scrollable.                                                                                                                                                                           |
| 05  | Embedded cards, single column         | Reuse `NoteArchiveCard` layout=`embedded`. No book cover/title repeated; no grid/list toggle. Preserve all actions and full-view dialog.                                                                                                                                                                   |
| 06  | Existing server search rules          | 300ms debounce, clear, min-length behavior incl. exact page number, server search only scoped to this book; reset list upon criteria change.                                                                                                                                                               |
| 07  | URL state                             | `nuqs` and namespaced note search/filter/sort/category keys; refresh, browser navigation and deep links work; no collision with other tabs.                                                                                                                                                                |
| 08  | Restore within same Book Details page | When switching tabs on same book, preserve cached loaded notes and approximately restore same `noteId`/scroll anchor; reset list position after changing search/filter/sort. After full reload no requirement to rehydrate all pages.                                                                      |
| 09  | After create = option C               | Close dialog, standard success toast and query/count refresh; **no** auto-navigation, note-jump action or toast CTA; keep user's context if possible.                                                                                                                                                      |
| 10  | After edit/delete = option A          | Existing mutation dialogs/toasts; server reordering and filter consistency; minimize scroll jumps; no auto-jump to moved note; already loaded notes remain on page-fetch error.                                                                                                                            |
| 11  | Exactly five sort UI choices          | Page (default), newest, oldest, recently updated, pinned first. Do not offer author or book-title sorts in this tab.                                                                                                                                                                                       |
| 12  | Compact category multiselect          | Standard + custom categories, multi-select; server applied; selection in URL; clearing categories leaves other criteria intact; no book/author filter.                                                                                                                                                     |
| 13  | Server counts everywhere              | Tab badge = **unfiltered book total** (hide 0); quick chips and category options show server facets with correct self-exclusion semantics; no counts from partially loaded cards or N requests per chip.                                                                                                   |
| 14  | Contextual states                     | Reuse existing skeleton/EmptyState/NotesErrorState and `empty-notes`, `empty-search` assets; distinguish no book notes, no search results, no filter results; retry first/next page separately; loaded cards survive page-fetch error.                                                                     |
| 15  | Adaptive mobile UI                    | Vertical toolbar, horizontal chips, responsive category and sort controls, single-column cards. No sticky toolbar, FAB, nested scroll container.                                                                                                                                                           |
| 16  | Book Details count source = A         | Backend supplies `notesCount` in Book Details data contract so badge works on Overview without fetching notes list. Add only if missing; refresh on create/delete; no fake zero on error.                                                                                                                  |
| 17  | Lazy loading + TanStack Query         | Notes list and facets fetch only after first opening the Notes tab. Reuse cache on returning; background refresh doesn't remove existing cards/skeleton-flash. Badge count from book details is independent.                                                                                               |
| 18  | Cross-book state = **B**              | Do NOT specially restore scroll when leaving book A and reopening it, even via navigation history. Book B starts with its own default criteria unless explicit query params given. Same-book tab-switch restoration from #08 remains. URL criteria explicitly present and browser back/forward still work. |
| 19  | Reuse spoiler protection              | Current `NoteSpoilerGate` + `NoteFullViewDialog`; no global reveal toggle and no new inline reveal mechanism. Search and filters must never reveal spoiler content implicitly.                                                                                                                             |
| 20  | Automatic endless scroll              | Page size **20**; automatically append next 20 while active and in view; stop at end, no routine Show More button; prevent double/inactive requests; retry errors in place.                                                                                                                                |

**Non-negotiable:** all other Book Details panels, global notes archive, notes for series, note data model and spoiler business rules stay operational. User chose #18 B — do not mistakenly implement former #18 A.

---

<!-- file: 02_TECHNICAL_CONTRACT.md -->

# Engineering contract — targeted implementation decisions

## A. Data boundaries & API

- Reuse `GET /api/notes/books` (`book=[bookId]`, `pageNumber`, `pageSize=20`, `sort`, `search`, `filter`, `category`, `customCategory`) and `GET /api/notes/books/facets` with same immutable book scope. Always combine required `bookId` **outside** user-cleared filters. Both query keys and responses must be scoped to user/book/criteria. Existing backend permissions, soft-deletes, book existence and ownership must hold. Never silently widen results to all books.
- The existing `GET /api/books/:id/notes` fetches all notes for a preview. Removing its consumer from Book Overview avoids that request; do **not** globally delete entity note APIs/components used elsewhere.
- `notesCount` is **not** in current `BookViewSchema`. Guarantee a nonnegative accurate count in **Book Details response**, including when on Overview. Count only active, owned notes for the book. Avoid N+1 costs for library lists; prefer a detail-specific additive schema/DTO or a safe optional base field with a guaranteed detail contract. Do **not** make a mandatory global BookView count that forces queries across every card. Do not invent 0 for a loading/error count. No Prisma migration unless genuinely needed.
- After create/delete: invalidate/update `bookKeys.detail(bookId)` **for the affected book only** plus relevant notes queries/facets. Update without count-changing mutation need not refetch the count. Preserve existing series and global mutation side-effects; check the actual mutation implementation.

## B. Sorting and search

- Default Notes tab sort `page`: `page ASC NULLS LAST`, `createdAt DESC`, `id ASC`. Page-less notes sort by newest first. Other UI sort options: `newest`, `oldest`, `recently_updated`, `pinned_first`; do not add title/author to tab. Stable DB ordering required under offset pagination.
- Current `BOOK_NOTE_SORT_ORDER_BY.page` = book title, page, id; current `BOOK_NOTES_ORDER_BY` = pinned, page, newest, id. Neither matches #03. Implement explicit agreed book-context ordering with **minimal backward impact**. If changing global `page` order, document the intentional tie-break difference and update archive tests; prefer isolated scoped sorting if change would violate existing behavior. No untested global regressions.
- Reuse `DebouncedSearchInput` (300ms), normalization, minimum 2 characters with allowed single exact page number per archive rule. Search in the _current book_ for note text/title/chapter/custom category/page. Existing global archive also searches book metadata; avoid returning every note merely because its parent book title matches a query. Scope any special search adjustment to the Book Details context, leaving existing archive search unchanged; no new search service.
- Search/filter/sort changes reset infinite-query results to first page and move viewport back to results start. A stale page from another criteria/book must never flash on screen.

## C. Facets and URL

- Five quick filters from `NOTES_ARCHIVE.quickFilters` and existing labels, `NotesQuickChips`. Facets must be server-sourced, scoped to current book. Category facet counts exclude current category criterion (self-exclusion); quick counts should follow existing backend quick-filter conventions, applied alongside non-quick dataset criteria. Preserve search/category interaction. Reuse category selection conversion and `FacetMultiselect`. Do not count from loaded pages.
- Existing `NotesFacetsService.bookFacets` calculates book and author dimensions too; minimize unnecessary book/author aggregation in book-specific UI only if worthwhile and testable. **Do not introduce new endpoints just to optimize an unmeasured cost.** Never drop required book scope while calculating facets.
- Use namespaced URL keys, e.g. `noteQ`, `noteFilter`, `noteSort`, `noteCategory`, `noteCustomCategory`; keep `tab=notes`. Defaults `all` / `page` / no categories / empty q. Canonical clear/reset only changes note-specific criteria; it must not clear `tab`, `bookId` or other tabs' keys. When navigating to a _different_ book, do not copy previous criteria unless the destination URL explicitly supplies them; explicit deep links win. Preserve existing `nuqs` conventions (parse, serialize, back/forward).

## D. Rendering, lazy loading, scroll, errors

- Book Details uses Radix `PageTabs` and `PageTabsPanel`; mount/enable notes query only with active Notes tab. Query cache may outlive unmount; no notes list/facets requests on Overview. When cached data is available, show it while refreshing. Handle `placeholderData: keepPreviousData` so book A notes can NEVER flash in book B; use keyed mounting/placeholder gating if necessary.
- Shared card is `NoteArchiveCard layout="embedded"`; existing `NotesArchiveContent` currently models `grid|list`. Extract/reuse the **smallest** shared list/empty/error logic or extend it compatibly; no second fork of the archive and no reusable mega-framework. Never modify spoiler gate behavior.
- Automatic `IntersectionObserver` pagination only for active tab, `hasNextPage` and no already pending fetch; next-page failures keep cards + retry. Existing `NotesArchiveContent` focuses a newly loaded card (may scroll viewport unexpectedly); for automatic loads, avoid unexpected focus movement while preserving accessible announcements/keyboard usability, and preserve global archive behavior.
- #08 scroll restore: only while staying on same book page and switching tabs, keyed to bookId + effective criteria. Anchor by note id plus offset where possible; fallback to nearby stable item/scroll position. Before restoring, ensure cached pages/DOM render. #10 stabilization after mutation may anchor to neighbor if note moved or deleted. On leaving book page: clean transient restore state (#18 B), do not persist loaded pages/scroll offsets to localStorage/sessionStorage or global store. URL state persists independently.
- Initial request: skeleton, never premature empty state. Distinct empty `no notes`, `no results for search`, `no results for filters`; appropriate clear/reset/add actions. First page error: retry. Next page error: retain items and retry only next page. Do not show a 0-count badge for unknown count.
- Mobile: single column within existing details content width; no nested scroll; horizontal chips; reuse mobile sort sheet; category picker remains operable on touch and keyboard. No new art/assets.

## E. Regression boundaries & rationale

1. Keep global archive's route, controls, notes for series and `EntityNotesBlock` (series). Remove only the Book Overview `BookNotesBlock` usage and dead imports unless proven unused globally.
2. No changes to note model, authentication/ownership, spoiler policy, unrelated forms, book editing, characters, quotes, reading history or timeline.
3. No new state manager, no extra prefetch on Overview, no client-side full-fetch/count calculations.
4. Keep UI strings localized through current i18n keys. Do not hardcode Ukrainian labels in components.
5. Treat the audited commit as a map; inspect actual HEAD and adapt if code changed.

## Compact implementation checkpoints

- Must show **11 badge** without list call on Overview; 11 notes displayed in tab all at once.
- 41 notes = page requests 20 + 20 + 1 (when scrolled); no fourth request.
- Query `noteQ` of 1 alphabetic char not committed, single digit exact page follows existing archive rule.
- Search results and facets only for current book even after clear-all and switching books.
- `page` ties newest first; null pages last; stable id tie-break; pinned affects `pinned_first` only.
- Create/edit/delete update visible cards and counts without uncontrolled scroll jumps or cross-book flashes.

---

<!-- file: 03_FILE_MAP.md -->

# File map: inspect by need, not breadth

**Baseline:** `dev` @ `4a9a5d6`. All paths relative to repository root. File names/exports might change in a newer worktree; check `rg` narrowly before editing.

## Entry points (read first)

| Task                           | Files                                                                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tabs + existing Overview block | `apps/web/src/features/books/components/book-details-view.tsx`; `apps/web/src/components/page-tabs.tsx`; `apps/web/src/features/notes/components/book-notes-block.tsx`                                              |
| Current notes global UI        | `apps/web/src/features/notes/components/notes-archive-view.tsx`; `notes-archive-content.tsx`; `notes-archive-toolbar.tsx`; `note-archive-card.tsx` (same directory)                                                 |
| Search and scoped query        | `apps/web/src/features/notes/model/notes-archive-query.ts`; `notes-archive-config.ts`; `use-notes-archive-query.ts`; `apps/web/src/components/debounced-search-input.tsx`                                           |
| Infinite list & facets         | `apps/web/src/features/notes/api/use-notes-archive-list.ts`; `use-notes-facets.ts`; `notes-archive-requests.ts`; `notes-keys.ts`                                                                                    |
| Responsive/reusable controls   | `apps/web/src/features/notes/components/notes-quick-chips.tsx`; `notes-advanced-filters.tsx`; `apps/web/src/features/notes/model/notes-category-selection.ts`; `apps/web/src/components/infinite-scroll-footer.tsx` |
| Cards/dialogs/spoilers         | `apps/web/src/features/notes/components/note-archive-card.tsx`; `note-card-layout.ts`; `note-form-dialog.tsx`; `note-full-view-dialog.tsx`; `note-spoiler-gate.tsx`                                                 |
| Mutations/cache                | `apps/web/src/features/notes/api/note-mutation-effects.ts`; `use-create-note.ts`; `use-update-note.ts`; `use-delete-note.ts`; `apps/web/src/features/books/api/book-keys.ts`; `use-book.ts`                         |

## Backend and DTO

| Task                                    | Files                                                                                                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing book details DTO               | `packages/shared/src/books.ts` (`BookViewSchema`); `apps/api/src/modules/books/api/view-dto/book.view-dto.ts`                                                                                            |
| Detail read path                        | `apps/api/src/modules/books/application/books.service.ts`; `book-view-assembler.ts`; `apps/api/src/modules/books/domain/book.mapper.ts`; `apps/api/src/modules/books/infrastructure/books.repository.ts` |
| Notes DTO and API                       | `packages/shared/src/notes.ts`; `apps/api/src/modules/notes/api/notes.controller.ts`; `apps/api/src/modules/notes/application/notes.service.ts`                                                          |
| Archive fetch and sorting               | `apps/api/src/modules/notes/infrastructure/notes.repository.ts`; `apps/api/src/modules/notes/domain/note-sort.ts`; `book-notes-where.ts`                                                                 |
| Facets                                  | `apps/api/src/modules/notes/application/notes-facets.service.ts`; `apps/api/src/modules/notes/infrastructure/notes-facets.repository.ts`; `apps/api/src/modules/notes/domain/note-facets.ts`             |
| Data model (read only unless essential) | `apps/api/prisma/schema.prisma` (`Book.notes`, `Note`: page, createdAt, updatedAt, deletedAt)                                                                                                            |

## Targeted existing tests

- Web: `apps/web/src/features/notes/components/notes-archive-content.test.tsx`, `notes-archive-view.test.tsx`, `note-archive-card.test.tsx`, `note-form-dialog.test.tsx`, `book-notes-block.test.tsx`; `apps/web/src/features/notes/api/note-mutation-effects.test.ts`; `apps/web/src/features/notes/model/notes-archive-query.test.ts`.
- API: `apps/api/src/modules/notes/domain/note-sort.test.ts`, `notes-facets.service` tests if present, `apps/api/src/modules/notes/api/notes-books.controller.test.ts`, `notes-books-facets.controller.test.ts`; `apps/api/src/modules/books/application/books.service.test.ts`.
- Keep series tests and global archive tests in regression set.

**Lookup tip:** prefer `rg -n 'symbolName' specific/subtree` and fetch small surrounding ranges. Never dump all 6,884 tree paths or full app files into prompt context.

---

<!-- file: 04_TEST_MATRIX.md -->

# Acceptance / regression matrix (authoritative)

Tests should be added to the closest existing unit/component/API suite. Use fixtures; do not require a real user database for unit coverage. The user-visible UI must work in Ukrainian and existing locales.

| ID        | Expected behavior                                                                                                                                                            | Priority |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NAV-01    | `Огляд → Нотатки → Історія/Персонажі → Нотатки`; correct order of tabs, no old Overview preview and no accidental series-note removal                                        | P0       |
| NAV-02    | Deep link `?tab=notes&noteFilter=favorite` restores criteria; reload/back/forward correct; book B does not inherit book A criteria; leaving book does not restore old scroll | P0       |
| COUNT-01  | 0 hides badge, positive n displays n on every book tab; Overview does **not** fetch notes list or facets                                                                     | P0       |
| COUNT-02  | Create/delete updates badge and facets; update favorite/pin/spoiler/category updates relevant facet counts; soft-deleted/other-user notes never counted                      | P0       |
| SORT-01   | Page asc; same page `createdAt DESC`; same timestamp id deterministic; null page last; `pinned_first` only when explicitly selected                                          | P0       |
| SORT-02   | Newest/oldest/updated/pinned options correct; global archive existing sorts and series sorts regressions checked                                                             | P0       |
| SCOPE-01  | Every list/facet request scoped to immutable bookId; category/quick clear-all cannot unset scope; access checks hold                                                         | P0       |
| SCOPE-02  | Other book data never flashes when switching quickly; late responses do not overwrite current book; nonactive tab triggers no list/next-page requests                        | P0       |
| FIND-01   | Search title/text/chapter/category/page within book; 300ms debounce; min 2 chars (single-digit page accepted); clear resets correctly                                        | P1       |
| FIND-02   | Searching parent book's title alone does not spuriously match all of its notes; global archive semantics remain intact                                                       | P1       |
| FACET-01  | 5 quick chips, counts from server; standard/custom category multi-select; self-exclusion + combinations + URL persistence; no per-chip requests                              | P0       |
| PAG-01    | 0 / 1 / 11 / 20 / 21 / 40 / 41 note cases, 20-sized pages, no empty extra request, auto-load only in viewport                                                                | P0       |
| PAG-02    | Prevent duplicate fetch while pending, stop at `hasNextPage=false`, retry next-page error without losing loaded notes                                                        | P0       |
| STATE-01  | Before first fetch skeleton; empty book: add CTA; search empty: clear search; filter empty: reset only user filters; initial error retry                                     | P1       |
| UI-01     | One-column embedded cards, no book header/grid/list switch, all existing actions/dialogs, full text, no spoiler leak                                                         | P0       |
| UI-02     | Mobile vertical toolbar, horizontal chips, category/filter keyboard and touch operation, no nested scroll/sticky/FAB                                                         | P1       |
| SCROLL-01 | After same-book tab switch preserve loaded pages + note anchor; after changing search/filter/sort go to results start                                                        | P1       |
| SCROLL-02 | Create/edit/delete no auto-jump; anchor stable when edited page moves or selected filter hides/deletes a card                                                                | P1       |
| A11Y-01   | Infinite append does not unexpectedly move focus/viewport; screen reader status and keyboard interactions work                                                               | P1       |
| REG-01    | Global books notes archive, series notes, overview, book forms, character/history/timeline tabs unaffected                                                                   | P0       |

## Verification commands

Read actual root/package scripts before running. Existing repository declares:

- `pnpm --filter @app/api test` (Vitest) and targeted test paths.
- `pnpm --filter @app/web test` (Vitest `--project unit`).
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check` (as relevant).
- If changing OpenAPI-facing DTO: `pnpm gen:api` (generates API client); inspect the resulting diff carefully.

Record commands, exit status and failures. Do not silently omit a test; if environment prevents it, list as `NOT RUN` with reason.

---

<!-- file: HANDOFF.md -->

# Handoff template — one short note per stage

Use in final progress report or a small local handoff note; don't reproduce entire specs.

`Stage`: 1|2|3|4  
`Status`: completed / blocked / partial  
`Changed files`: paths only  
`Validation`: commands and PASS/FAIL/NOT RUN  
`Contracts`: any API/type changes; generated client status  
`Risks`: max 3 actionable items  
`Next`: next prompt + essential carry-over  
`Scope`: confirm no unrelated/global/series regressions or explain deviations.

At final stage include an approval matrix of IDs from `04_TEST_MATRIX.md` and a short `git diff --stat` summary. No unsupported percent-complete statements.

---

<!-- file: prompts/01_BACKEND_DTO.md -->

# Stage 1 / 4 · Backend contracts and count/sort

**Read:** `00_START_HERE.md`, `01_APPROVED_DECISIONS.md` (#3,#11,#13,#16), `02_TECHNICAL_CONTRACT.md` sections A-C, relevant files in `03_FILE_MAP.md`. Use current worktree, not presumed baseline.

1. Trace only the book details response path, shared `BookViewSchema`, note relation and notes count repo path. Implement accurate `notesCount` for Book Details without N+1 on library listings. Preserve DTO and generated API-client conventions. Do not mark an unavailable count as zero.
2. Make the page order for the new Book Notes tab `page ASC NULLS LAST, createdAt DESC, id ASC`, without untested changes to global archive or series sorting. Ensure other four supported sorts work. Verify selected approach against current Prisma/repository implementation and tests.
3. Confirm existing books archive and facets can serve one immutable `bookId` with category/custom category and all five quick filters. Optimize facets only where clearly worthwhile without adding needless endpoints or broad refactors. If current global search matches parent book title and would be wrong in scoped view, implement minimal scoped search handling without changing global semantics.
4. Add targeted backend/DTO tests for ownership, deleted notes, 0/11 counts, sortable null/ties, filter scoping. Regenerate OpenAPI/client **if needed** by actual repo workflow. Do not create DB migrations unless necessary.

**Gate:** targeted API tests + API/shared typecheck; no unintended changes to global notes/series behavior. Output short handoff per `HANDOFF.md`, then proceed to Stage 2.

---

<!-- file: prompts/02_TAB_UI.md -->

# Stage 2 / 4 · Dedicated Book Notes tab and UI

**Read:** decisions #1,#2,#4,#5,#6,#11,#12,#14,#15,#19,#20 + contract sections C-E. Discover files via `03_FILE_MAP.md`.

1. Add `notes` to `BookDetailsView` tabs immediately after `overview`, including positive-only badge from Book Details `notesCount`. Remove `<BookNotesBlock ... />` ONLY from Book Overview. Keep all other blocks unchanged and shared series note components intact.
2. Create a thin `BookNotesTab` adapter. One-column embedded `NoteArchiveCard`, current add/edit/delete/full-view/spoiler flows; new-note dialog preselects current book (reuse `NoteFormDialog` target `preselected`). No book/author search selectors or archive summary/sidebar/view toggle.
3. Compact toolbar: add button, shared debounced search, five `NotesQuickChips`, category/custom-category multi-select from shared selection conversion + facets, exactly five sort options; mobile adaptation uses current primitives. Use localized copy.
4. Reuse/factor `NotesArchiveContent` list, skeleton, empty/error state components carefully so global archive behavior remains intact. Do not duplicate entire list implementation. The actual fetch/cache/scroll lifecycle is completed in Stage 3; if not possible, wire basic first-page list first without inventing extra data flow.

**Gate:** component/unit tests for layout, tab order, button/context, empty states and spoiler gate; typecheck. Keep stage handoff succinct, proceed to Stage 3.

---

<!-- file: prompts/03_URL_CACHE_MUTATIONS.md -->

# Stage 3 / 4 · URL, lazy data, mutation refresh and scroll

**Read:** decisions #7–#10,#13,#16–#18,#20 and `02_TECHNICAL_CONTRACT.md` sections A,C,D. **Important:** decision #18 is B, not A.

1. Bind namespaced `nuqs` query to `tab=notes`; default filter=all, sort=page, book-specific immutable context enforced outside user filters. Preserve explicit deep-link state; never leak book A criteria to B via navigation.
2. Lazy-load list+facets only with Notes active; cached notes remain when switching other tabs of same book, with background refresh. Queries keyed by book+criteria. Guard `keepPreviousData` against rendering previous-book notes.
3. Implement automatic 20-item endless scroll via existing `useInfiniteQuery`/`InfiniteScrollFooter`: only when active and not fetching; no routine Show More. Errors preserve loaded cards and allow retry; no inadvertent focus jumps on observer-driven append.
4. Same-book tab switches restore last anchored note/offset after DOM is ready; after leaving Book Details do NOT intentionally restore scroll across navigation; on changed criteria reset first page/scroll. Handle mutating/deleted anchor gracefully. No new global store or persistent scroll storage.
5. Standard success toast only on create (no jump/CTA). After create/delete update count via exact `bookKeys.detail(bookId)` and list/facets using existing mutation effects. After edit/toggle preserve filters/server sort and stabilize nearby visible cards where possible. Avoid refetch storms or stale counts.

**Gate:** targeted tests for same-book vs cross-book navigation, deep links, lazy fetching, cache, mutation invalidation, scroll/append/accessibility. Short handoff, proceed to Stage 4.

---

<!-- file: prompts/04_QA_FINAL.md -->

# Stage 4 / 4 · Final QA and regression guard

**Read:** `04_TEST_MATRIX.md`, `HANDOFF.md`, relevant contract sections. Do not rediscover the whole repo.

1. Compare final diff with 20 decisions; verify no old Overview notes block, no notes fetch before Notes tab, positive-only count, proper book scope, 20-per-page pagination and no count from loaded notes.
2. Execute targeted API + web tests, root typecheck and lint; run broader existing regression suites where practical. If DTO/OpenAPI changed, validate generated client and its diff. Fix regressions within scope. Explicitly check global book notes archive and series notes.
3. Exercise/cover browser-level cases where tooling permits (same-book tab switching scroll, cross-book navigation, stale request, auto focus behavior, mobile filtering, spoiler safety). Don't claim manual validation absent a real browser run.
4. Check for unrelated files, extra API endpoints, schema migrations, duplicated components, hardcoded copy and overwritten user changes. Run `git diff --check`; summarize `git diff --stat`.
5. Produce compact final report: approved 20/20 verification, test matrix PASS/FAIL/NOT RUN IDs, changed files, known risks, any deliberate global behavior changes. Avoid blanket "all tests passed" if partial.

**No new product options or broad refactors.** Report blockers rather than silently weakening a locked decision.

---

<!-- file: CLAUDE_START_PROMPT.txt -->

У поточному worktree Book Nest виконай рефактор вкладки «Нотатки» за пакетом `BOOK_NEST_BOOK_NOTES_TAB_CLAUDE_CODE_v2_OPTIMIZED`.

1. Прочитай `00_START_HERE.md`, `01_APPROVED_DECISIONS.md`, `02_TECHNICAL_CONTRACT.md`, `03_FILE_MAP.md`, `04_TEST_MATRIX.md` у цій папці.
2. Перевір поточні `git status`, HEAD і наявні зміни. Працюй лише в цьому worktree; не перемикай гілок, не скидай мої зміни, не роби commit/push.
3. Послідовно виконай 4 етапи з `prompts/`, максимально перевикористовуючи існуючі компоненти та API Book Nest. Не запускай повторні повні аудити між етапами; читай лише потрібні файли.
4. Збережи усі 20 погоджених рішень, особливо №18 = варіант B. Не змінюй глобальний архів нотаток, нотатки серій і логіку спойлерів без обґрунтованої необхідності та тестів.
5. Після кожного етапу короткий handoff. Після четвертого — тести, typecheck, lint, матриця перевірок та короткий звіт про зміни й ризики. Не зупиняйся між етапами, якщо немає блокера.

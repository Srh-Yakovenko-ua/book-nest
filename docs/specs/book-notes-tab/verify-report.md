# Book Notes tab: VERIFY report

Run: 2026-10-17T21:37Z (UTC), follow-up 2026-10-18. Worktree `feat/book-notes-tab`, base origin/dev `6b948851`, all changes uncommitted. Diff derived from `git status --short` and `git diff --stat`, not from the plan.

## Diff summary

- Tracked: 51 files, +761 / -365 (3 deleted: `use-book-notes.ts`, `book-notes-block.tsx`, `book-notes-block.test.tsx`).
- Untracked: 19 source and test files (3069 lines) plus 51 generated Orval model files.
- No file under `apps/api/prisma/**`. No new controller route: `notes.controller.ts` gains only `@ApiQuery searchIn` (:104, :254), `books.controller.ts` only the `getById` response type (:302, :309).
- Deliberate global changes: (1) D2, `BOOK_NOTE_SORT_ORDER_BY.page` gains `newest` before `id` (`note-sort.ts:22`), so the global archive page sort now orders equal pages newest first; (2) D3, optional `searchIn` query param, default `notes_and_book` keeps archive requests identical (`packages/shared/src/notes.ts:143`).
- Evidence recorded from outside this run (not re-run): headless Chromium 17/17, live curl, typecheck exit 0, lint 0 errors, format:check clean, gen:api idempotent. `git diff --check` re-run here: clean.

## Tasks

| Task | Status  | Proof                                                                                                                                                                                                                                                              |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1   | done    | `packages/shared/src/books.ts:1195-1199`; `BookViewSchema` untouched; barrel `index.ts:7`                                                                                                                                                                          |
| T2   | done    | `books.repository.ts:627-640` (userId, bookId, entityType book, active note and active book; not in `withRelations`); `books.service.ts:216-223`; `books.controller.ts:302,309`; `view-dto/book-details.view-dto.ts`; no `modules/notes` import in `modules/books` |
| T3   | done    | `books.controller.notes-count.test.ts:74,84,102,112,132,150,162,191`; `books.service.test.ts:690-734`                                                                                                                                                              |
| T4   | done    | `note-sort.ts:22`, `:28-40` unchanged; `note-sort.test.ts:48`; `notes-books.book-scope.controller.test.ts:103,127,144,158`; tie-break documented in openDecisions D2                                                                                               |
| T5   | done    | `shared/notes.ts:90-92,143`; `book-notes-where.ts:75,81-100`; `note-archive-dataset.ts:23`; `notes.controller.ts:104,254`                                                                                                                                          |
| T6   | done    | book-scope test `:198,217,234,249,261,302,340,364,378,400`; facets test `:167,210,242,264,298`                                                                                                                                                                     |
| T7   | done    | generated diff limited to `BookDetailsViewDto` and `searchIn` (books.ts:2342, books.zod.ts:4009, notes.zod.ts:805,2075); `use-book.ts:25-27`; consumer fixtures updated in 7 test/story files                                                                      |
| T8   | done    | `use-book-mutation-sync.ts:17-26`; `use-toggle-favorite-dedication.ts:27-36`; tests `use-book-mutation-sync.test.tsx:14,27,35`, `use-toggle-favorite-dedication.test.tsx:29,50,64`                                                                                 |
| T9   | done    | `book-details-view.tsx:34,57-69,99-107`; `uk.json`/`en.json:6324` `notes.bookTab.tab`; tests `book-details-view.test.tsx:155,168,174`                                                                                                                              |
| T10  | partial | files deleted, `notes/index.ts:1` swapped; `SeriesNotesBlock`, `EntityNotesBlock`, `note.controller.ts:64` untouched. `pnpm knip` not run (doneWhen 3)                                                                                                             |
| T11  | done    | `book-notes-tab-query.ts:12-45,67-92`; `use-book-notes-tab-query.ts:40-54`; tests `book-notes-tab-query.test.ts:28-162`, `use-book-notes-tab-query.test.ts:35-74`                                                                                                  |
| T12  | done    | `notes-archive-content.tsx` (`view` adds `embedded`, `loadMoreFocus`, `emptyCopy`, `onClearSearch`); `note-archive-card.tsx:47`; new tests in `notes-archive-content.test.tsx` (embedded one column, focus opt-out, three empties)                                 |
| T13  | done    | `book-notes-toolbar.tsx:54-83` (search, category, sort, add, chips); `MobileSortSheet` `sm:hidden`; chips `overflow-x-auto` (`notes-quick-chips.tsx:22`); tests `book-notes-toolbar.test.tsx:59-149`                                                               |
| T14  | done    | `book-notes-tab.tsx:40-42,100-116`; tests `book-notes-tab.test.tsx:264,275,318,328,343,360,379`                                                                                                                                                                    |
| T15  | done    | `book-details-view.test.tsx:185`; `book-notes-tab.tsx:122`; `book-details-view.tsx:106` keyed; Radix content unmounts (`page-tabs.tsx:85`, no forceMount); tests `book-notes-tab.test.tsx:492,510,526`                                                             |
| T16  | done    | `book-details-view.test.tsx:204`; `book-notes-tab.test.tsx:543,560,578,591`                                                                                                                                                                                        |
| T17  | done    | `book-notes-tab.tsx:138-143`; `use-notes-archive-list.ts:15-16`; tests `book-notes-tab.test.tsx:394,415,430,463`; 21/40 note cases derive from `pagesCount` (API `:378,:400`), not tested explicitly                                                               |
| T18  | done    | `note-mutation-effects.ts:24,51-59`; tests `note-mutation-effects.test.ts:73,86,96`                                                                                                                                                                                |
| T19  | done    | `use-book-notes-scroll-anchor.ts:53-70,88-99`; `book-details-view.tsx:48-53`; `book-notes-scroll-anchor.ts:62`; `book-notes-tab.tsx:72-79`; tests `book-notes-tab.test.tsx:617,643,664,687,721`, `book-details-view.test.tsx:217,236`; no storage or store         |
| T20  | done    | progress.md Gates and Test runs: API 13 files, web 17 files, each green when run alone                                                                                                                                                                             |
| T21  | done    | notes-archive-view 36/36, notes-archive-content 20/20, note-archive-card 44/44, note-form-dialog 73/73; no web test exists for the series notes block, which is not in the diff                                                                                    |
| T22  | done    | browser-check 17/17 after the toolbar fix, spoiler-search-check 5/5, toolbar screenshots at 1024/1280/1920; not-run items listed in progress.md                                                                                                                    |
| T23  | done    | this report and progress.md, updated 2026-10-18                                                                                                                                                                                                                    |

## Decisions 01-20

| #   | Verdict         | Proof                                                                                                                                                         |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | PASS            | `book-details-view.tsx:34,99-107`; series notes files not in diff                                                                                             |
| 02  | PASS            | `book-notes-toolbar.tsx:54-83`; `book-notes-toolbar.test.tsx:59`                                                                                              |
| 03  | PASS            | `note-sort.ts:22`; book-scope test `:103,127,144`                                                                                                             |
| 04  | PASS, deviation | five chips via `NotesQuickChips`, horizontal scroll. Label is `Улюблені` (`uk.json:6065`), decision text says `Обрані`; assumption 0, never confirmed by user |
| 05  | PASS            | `note-archive-card.tsx:47`; `notesGridClassName` grid-only `lg:grid-cols-2`                                                                                   |
| 06  | PASS            | `debounced-search-input.tsx:11` (300ms); `book-notes-toolbar.tsx:56`; `searchIn=notes`                                                                        |
| 07  | PASS            | `book-notes-tab-query.ts:27-35`; criteria writes use nuqs default replace, same as the archive                                                                |
| 08  | PASS            | `book-details-view.tsx:48-53`; live same top card and offset                                                                                                  |
| 09  | PASS            | `book-notes-tab.tsx:112-116`; live toast, URL unchanged                                                                                                       |
| 10  | PASS            | `writeUpdatedNote` unchanged; `book-notes-tab.test.tsx:721,430`                                                                                               |
| 11  | PASS            | `book-notes-tab-query.ts:16-22`                                                                                                                               |
| 12  | PASS            | `book-notes-toolbar.tsx:87-119`; `book-notes-toolbar.test.tsx:116,129`                                                                                        |
| 13  | PASS            | badge `book-details-view.tsx:59`; chips and categories from facets; status uses server `totalCount`                                                           |
| 14  | PASS            | `use-book-notes-empty-copy.ts`; `book-notes-tab.test.tsx:318-379`                                                                                             |
| 15  | PASS            | `book-notes-toolbar.tsx:53,64`; no sticky or fixed in new files; live 390px                                                                                   |
| 16  | PASS            | `books.service.ts:222`; `use-book-mutation-sync.ts:17-26`; `note-mutation-effects.ts:51-54`                                                                   |
| 17  | PASS            | `book-details-view.test.tsx:185`; `book-notes-tab.test.tsx:492,510`                                                                                           |
| 18  | PASS (B)        | `use-book-notes-scroll-anchor.ts:91-96`; `book-details-view.test.tsx:236`; live scrollY 0                                                                     |
| 19  | PASS            | `note-spoiler-gate`, `note-full-view-dialog` not in diff; `book-notes-tab.test.tsx:275`                                                                       |
| 20  | PASS            | `NOTES_ARCHIVE.pageSize` 20; `book-notes-tab.tsx:138-143`; live 41 notes = pages 1, 2, 3                                                                      |

## Matrix

| ID        | Verdict | Evidence                                                                                                                                       |
| --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| NAV-01    | PASS    | `book-details-view.test.tsx:155`; browser tab order                                                                                            |
| NAV-02    | PASS    | `book-details-view.test.tsx:204,236`; `book-notes-tab.test.tsx:543,560,578`; browser deep link                                                 |
| COUNT-01  | PASS    | `book-details-view.test.tsx:168,174,185`; browser zero notes requests on Overview                                                              |
| COUNT-02  | PASS    | `books.controller.notes-count.test.ts:102,112,132`; `note-mutation-effects.test.ts:73,86`; live 7, 8, 7                                        |
| SORT-01   | PASS    | book-scope test `:103,127,144`                                                                                                                 |
| SORT-02   | PASS    | book-scope test `:158`; `note-sort.ts:28-40` unchanged; BOOK-Q-06 updated                                                                      |
| SCOPE-01  | PASS    | `book-notes-tab-query.ts:67-80`; `use-book-notes-tab-query.test.ts:74`; book-scope `:340`                                                      |
| SCOPE-02  | PASS    | `book-notes-tab.test.tsx:510,526`; `book-notes-tab.tsx:122`                                                                                    |
| FIND-01   | PASS    | `book-notes-tab-query.test.ts:84`; browser `17` committed, single letter not                                                                   |
| FIND-02   | PASS    | book-scope `:198,217,234`; live curl 7 vs 0                                                                                                    |
| FACET-01  | PASS    | facets test `:167,210,242`; `book-notes-toolbar.test.tsx:77,116`                                                                               |
| PAG-01    | PASS    | 41 (web test and browser), 7 (browser), 20 and 41 (API); 0, 1, 11, 21, 40 derived only                                                         |
| PAG-02    | PASS    | `book-notes-tab.test.tsx:430,463`                                                                                                              |
| STATE-01  | PASS    | `book-notes-tab.test.tsx:318,328,343,360,379`                                                                                                  |
| UI-01     | PASS    | `book-notes-tab.test.tsx:264,275`; browser single column                                                                                       |
| UI-02     | PASS    | browser 390px; toolbar fits at 1024, 1280 and 1920 (screenshots)                                                                               |
| SCROLL-01 | PASS    | browser; `book-notes-tab.test.tsx:617,643,664`                                                                                                 |
| SCROLL-02 | PASS    | `book-notes-tab.test.tsx:721`; browser create without jump; edit-move not run in browser                                                       |
| A11Y-01   | PASS    | `book-notes-tab.test.tsx:415`; footer `aria-live` (`infinite-scroll-footer.tsx:67`)                                                            |
| REG-01    | PASS    | progress.md Test runs: archive, card, form, characters, timeline, reading-history, notes and books API suites green; full pnpm test runs in CI |

## Drift (in the diff, not asked by a task)

1. `apps/api/src/scripts/seed-changelog.ts`: changelog entry for the shipped tab; scope.excluded no longer lists it.
2. `apps/web/src/components/infinite-scroll-footer.tsx` + test: `errorFocus` opt-out, default `retry` keeps every other caller unchanged.
3. `book-notes-results-status.tsx`, `use-book-notes-empty-copy.ts`, `use-book-notes-scroll-anchor.ts`: new files serving T12, T14, T19.
4. `notes-summary.service.ts:15-18`: typing fix forced by the `searchIn` default; behavior unchanged.
5. `use-book-actions.ts:212-214`: `BookView` to `BookDetailsView` type on the favorite cache write; spread keeps `notesCount`.
6. `notes-archive-requests.ts:84`, `notes-archive-query.ts:141-144`, `notes-category-selection.ts:7`: plumbing for T5, T11, T13.
7. Fixtures and tests in books, characters, quotes, `note-form-dialog.test.tsx`: consumers of `BookDetailsViewSchema` parsing.

No unexplained drift.

## Follow-up run, 2026-10-18

Gaps 1, 2 and 6 from the first run are closed: test runs and counts are recorded in progress.md, the spoiler search and the toolbar widths were checked in the browser, and progress.md is current. The changelog entry no longer conflicts with scope.excluded.

## Remaining

1. T10: `pnpm knip` runs in CI on push, not locally.
2. Decision #04 label and D1-D7 were adopted without user confirmation; they are listed in the PR.
3. Low: `notesKeys.byBook` (`notes-keys.ts:20`) is still written (`note-mutation-effects.ts:105`) but has no reader since `useBookNotes` was deleted. Left for a follow-up because `note-form-dialog.test.tsx:143` depends on it.

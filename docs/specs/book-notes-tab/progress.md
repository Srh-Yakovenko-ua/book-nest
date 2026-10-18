# Book Notes tab: progress checkpoint

This file points into `tasks.json`; it is not a tracker. On resume, read `CLAUDE.md`, `spec.md`, `tasks.json` and this file, and check `git status` for drift first.

- Worktree: `D:\IT\book-nest\.claude\worktrees\book-notes-tab`, branch `feat/book-notes-tab`, built on origin/dev `6b948851` and rebased onto `76712350` (one conflict, an import line in `character-edit-page.test.tsx`; typecheck and that test rerun green). The spec was written against `4a9a5d6`.
- Status (2026-10-18): T1-T9 and T11-T23 done. T10 stays partial on one criterion, `pnpm knip`, which CI runs on push.
- Decisions D1-D7: recommendations adopted as recorded assumptions (package rule: stop only on a fundamental conflict); see openDecisions[].answer.
- Reviews: S1 code-reviewer approved with nits (fixed: count scoped to active parent book, parity test, no-cache invalidate test). S2+S3 code-reviewer High (retry double request) and Mediums fixed; accessibility-auditor introduced items fixed, pre-existing shared-component items listed in tasks.json assumptions.
- Live stack used for the checks: scratch DB booknest_notes_tab (pg_dump of booknest_dev plus dev migrations), API on :4100 via apps/api/.env.notestab.local (gitignored), web on :3100 with API_BASE_URL=http://localhost:4100. Test user notes-p2-1789734886364@example.com. Book 9c65401b... seeded to 41 notes. Both servers are stopped; dropping the scratch DB needs the user's consent.

## Gates

`pnpm typecheck` exit 0, `pnpm lint` 0 errors, `pnpm format:check` clean, `pnpm gen:api` rerun with no diff, `git diff --check` clean. `pnpm knip` and the full `pnpm test` were not run locally; CI runs both on push.

## Test runs

Every file ran on its own with `VITEST_MAX_WORKERS=1` (web with `--project unit`).

API:

| File                                        | Result  |
| ------------------------------------------- | ------- |
| `books.service.test.ts`                     | 52/52   |
| `books.controller.notes-count.test.ts`      | 9/9     |
| `notes-books.book-scope.controller.test.ts` | 22/22   |
| `notes-books-facets.controller.test.ts`     | 11/11   |
| `notes-books.controller.test.ts`            | 12/12   |
| `notes.controller.test.ts`                  | 32/32   |
| `notes-trash.controller.test.ts`            | 7/7     |
| `notes-series.controller.test.ts`           | 11/11   |
| `notes-series-facets.controller.test.ts`    | 5/5     |
| `books.controller.test.ts`                  | 108/108 |
| `book-notes-summary.test.ts`                | 8/8     |
| `series-notes-summary.test.ts`              | 6/6     |
| `note-sort.test.ts`                         | 17/17   |

Web:

| File                                      | Result |
| ----------------------------------------- | ------ |
| `book-details-view.test.tsx`              | 7/7    |
| `book-notes-tab.test.tsx`                 | 26/26  |
| `book-notes-toolbar.test.tsx`             | 8/8    |
| `book-notes-scroll-anchor.test.ts`        | 7/7    |
| `book-notes-tab-query.test.ts`            | 20/20  |
| `use-book-notes-tab-query.test.ts`        | 5/5    |
| `use-book-mutation-sync.test.tsx`         | 3/3    |
| `use-toggle-favorite-dedication.test.tsx` | 3/3    |
| `infinite-scroll-footer.test.tsx`         | 8/8    |
| `note-mutation-effects.test.ts`           | 9/9    |
| `note-archive-card.test.tsx`              | 44/44  |
| `notes-archive-content.test.tsx`          | 20/20  |
| `notes-archive-view.test.tsx`             | 36/36  |
| `note-form-dialog.test.tsx`               | 73/73  |
| `book-characters-tab.test.tsx`            | 29/29  |
| `reading-history-tab.test.tsx`            | 18/18  |
| `book-timeline-block.test.tsx`            | 31/31  |

`book-timeline-block.test.tsx` failed one test ("hides events beyond the reading position and reveals them on demand") once, while three other runs shared the machine with 1.5 GB of free memory. Run alone it passed 31/31. No timeline file is in the diff, and the only fixture change is a new `makeBookDetailsView`; `makeBookView` is unchanged.

The web suite has no test for `SeriesNotesBlock` or `EntityNotesBlock`; neither file is in the diff.

## Browser runs

Headless Chromium against the live stack, scripts in the session scratchpad.

- `browser-check.mjs`, rerun after the toolbar fix: 17/17. NAV-01 tab order and no old Overview block; COUNT-01 badge 7 and zero notes requests on Overview; SCOPE-01 list params (`book`, `pageSize=20`, `sort=page`, `searchIn=notes`); FACET-01 facets scoped to the book; PAG-01 7 notes in one request and 41 notes as pages 1, 2, 3; UI-01 single column; SCROLL-01 same top card (`fbbc7f7b`) at the same offset (654) after History and back, 41 cards kept; NAV-02 scrollY 0 after another book and back (#18 B), favorite deep link; FIND-01 one letter not committed, `17` committed with `searchIn=notes`; UI-02 no horizontal scroll at 390px; no console errors.
- `spoiler-search-check.mjs`: 5/5. A spoiler note created through the API is found by a word from its text, the card shows the spoiler gate, and the text is in neither the card DOM nor the page text. The note is deleted afterwards.
- `mutation-check.mjs`: create through the dialog moves the badge 7 to 8 and the "Усі" chip to 8, shows the toast, keeps the URL and scroll position, and refetches list, facets, chapters and the book detail; delete brings both back to 7.
- Toolbar at 1024, 1280 and 1920: screenshots show search on its own row, category, sort and "Додати нотатку" inside the column at 1280 and 1920, stacked at 1024; the chip strip scrolls horizontally as in the archive.

## Not run

- Edit that moves a note out of the current filter, in the browser (SCROLL-02 is covered by `book-notes-tab.test.tsx`).
- 0, 1, 11, 21 and 40 note counts in the browser; they derive from `pagesCount` and are covered by API and web tests at 20 and 41.
- `pnpm knip` and the full `pnpm test`: CI runs them on push.

## Follow-ups

- `notesKeys.byBook` (`notes-keys.ts:20`) is still written by `note-mutation-effects.ts:105`, but nothing reads it since `useBookNotes` was deleted. `note-form-dialog.test.tsx:143` builds a hanging-query check on that key, so removing it means reworking that test.
- Decision #04 chip label is `Улюблені`, the decision text says `Обрані`; D1-D7 were adopted as assumptions. Both are listed in the PR for confirmation.

# Verify report: statistics-activity (v5)

Base `origin/dev 014e254f`, branch `feat/statistics-activity-refactor-v5`, all changes uncommitted. Verified 2026-10-19T11:48:27Z by static diff review. No test, typecheck, lint or format run was observed.

Diff: 14 modified files, 3 untracked source files (`api/use-reading-month-books.ts`, `reading/reading-habits-section.tsx`, `reading/reading-habits-section.test.tsx`), plus this directory. Paths below are relative to `apps/web/src/features/statistics/` unless stated.

## Task verdicts

| Task | Status | Proof                                                                                                                                         |
| ---- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | done   | `model/statistics-view.ts:14` sections with habits; `:29-30` calendar and habits destinations; `:40` activeDays -> habits; `:41-43` unchanged |
| T2   | done   | `reading-habits-section.tsx:48` title; `:50` summary; `:29-38` unavailable state with calendar reason, no summary                             |
| T3   | done   | card has no summary import or render; `reading-calendar-card.tsx:65-75`, `:88-90`, `:93-96` kept                                              |
| T4   | done   | `statistics-overview.tsx:164` dynamics, `:180-182` habits, `:183-192` calendar; nothing else in the panel                                     |
| T5   | done   | uk and en `statistics.habits` {title, description, metricRange, unavailable}; `calendar.summary` untouched                                    |
| T6   | done   | `reading-habits-section.test.tsx:45,59,82,100`; `reading-calendar-card.test.tsx:152`                                                          |
| T7   | done   | `statistics-kpi-grid.test.tsx:219`; `statistics-overview.test.tsx:355-358`, `:332` (push + focus)                                             |
| T8   | done   | `model/statistics-view.ts:10-11,25,47-50`; the card's local `CALENDAR_MODES` is gone; `statistics-period.ts` not in diff                      |
| T9   | done   | `model/use-statistics-view.ts:20-27,41,55-58`                                                                                                 |
| T10  | done   | `model/statistics-calendar.ts:100-113` clip (date-fns), `:136-145` resolve, `:159` hasLegacyHistory, `:151` Set of preview ids                |
| T11  | done   | `api/use-reading-month-books.ts:23-30`; prefix match `api/statistics-keys.ts:12`                                                              |
| T12  | done   | `reading-calendar-card.tsx:32-35` props, `:40-48` stale effect, `:80-86`, `:108`                                                              |
| T13  | done   | `reading-books-calendar.tsx:42-43,51,90-94,110-114,163-167`                                                                                   |
| T14  | done   | G1 closed: `reading-books-calendar.tsx:74-76` exact page ignored while `isError`; test `reading-calendar-card.test.tsx:324`                   |
| T15  | done   | `statistics-overview.tsx:184-191`; `:56` overview query takes `params.queryParams` only                                                       |
| T16  | done   | `modes.books` "Книги за днями" / "Books by day"; `books.monthBooksLoading/Error/Retry` in both files                                          |
| T17  | done   | `model/statistics-calendar.test.ts` describes resolveCalendarMonth, clipCalendarMonth, hasLegacyHistory cases                                 |
| T18  | done   | `reading-calendar-card.test.tsx:133,229,249,283,297,324,332,365,379`                                                                          |
| T19  | done   | `statistics-overview.test.tsx:496,518,533,543`                                                                                                |
| T20  | done   | `statistics-insights.tsx:52` export only                                                                                                      |
| T21  | done   | `reading-dynamics-card.tsx:44,96`                                                                                                             |
| T22  | done   | `statistics-overview.tsx:48-51,139-141,168-172`; `statistics-overview-tab.tsx` not in diff                                                    |
| T23  | done   | `statistics-overview.test.tsx:602,614,623`; compact case `:368` has no hunk                                                                   |

## Gaps

G1 below was closed after this report: `reading-books-calendar.tsx:74-76` plus regression test `reading-calendar-card.test.tsx:324`.

**G1 (T14, A10).** A refetch that fails after an earlier success is shown as success. `reading-books-calendar.tsx:75` treats the exact count as missing only when `monthBooks.data === undefined`, and `:194-200` then returns the retained `data.booksCount` as exact. In TanStack v5 that state is `isError` with `isRefetchError` and data kept, so the reader sees no `≥`, no error text and no retry. It can be reached in two ways: `invalidateStatisticsQueries` (18 call sites), or a remount after `staleTime` 30s (`lib/query-client.ts:12`), in either case followed by a failed refetch. After a new reading log, the stale count can be lower than the fresh observed distinct count. No test covers a failure after a success: `reading-calendar-card.test.tsx:343` only asserts the second request.

## Acceptance map

| Row | Verdict                          | Proof                                                                                                                                                              |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | proven in code, run NOT_VERIFIED | `statistics-overview.tsx:163-193`; test `statistics-overview.test.tsx:168` (childElementCount 3)                                                                   |
| A2  | proven in code, run NOT_VERIFIED | compact path untouched (`reading-dynamics-card.tsx:96` full-only, overview tab not in diff); test `:368` unchanged                                                 |
| A3  | proven in code, run NOT_VERIFIED | `reading-calendar-summary.tsx:30` (`grid-cols-2 sm:grid-cols-4`, unchanged); habits tests `:15,28,45,59,82,100`; card test `:152`                                  |
| A4  | proven in code, run NOT_VERIFIED | `statistics-view.ts:40`; tests `statistics-kpi-grid.test.tsx:219`, `statistics-overview.test.tsx:332,355`                                                          |
| A5  | proven in code, run NOT_VERIFIED | `use-statistics-view.ts:55-58`; `reading-calendar-card.tsx:40-48`; tests `statistics-overview.test.tsx:496,518,533,543`, `reading-calendar-card.test.tsx:365`      |
| A6  | proven in code, run NOT_VERIFIED | en/uk `modes.books`; heatmap, grid, diary, day preview and details not in diff; test `reading-calendar-card.test.tsx:141`                                          |
| A7  | proven in code, run NOT_VERIFIED | `statistics-calendar.ts:100-113`; three clip tests                                                                                                                 |
| A8  | proven in code, run NOT_VERIFIED | `reading-books-calendar.tsx:60`; test `reading-calendar-card.test.tsx:229`                                                                                         |
| A9  | proven in code, run NOT_VERIFIED | `use-reading-month-books.ts:27,29`; tests `:126,249,260,352`                                                                                                       |
| A10 | proven in code, run NOT_VERIFIED | invalidation reaches the key (test `:343`); first-load failure and retry (`:283,297`); refetch failure after success falls back to `≥` + retry (`:324`, G1 closed) |
| A11 | proven in code, run NOT_VERIFIED | `reading-books-calendar.tsx:191-200`; legacy covers unknown days (`statistics-calendar.ts:119-121`); tests `:239,324`, model legacy tests                          |
| A12 | proven in code, run NOT_VERIFIED | `statistics-overview.tsx:139-141` (at most one comparison code), full-only `reading-dynamics-card.tsx:96`; tests `:602,614,623`                                    |

## Drift

- Every changed file maps to a task. No edits under `apps/api`, `packages/shared`, generated Orval, `prisma`, `.claude`, `CLAUDE.md`, `reading-dynamics-chart.tsx`, `reading-heatmap.tsx`, the month grid, the diary, the day preview or details. No `package.json` or lockfile change.
- The added lines contain no comments, `any`, non-null `!`, `console`, `process.env`, raw date math or memoization.
- Accepted drift in `reading-books-calendar.tsx` (the T14 file), with no doneWhen conflict:
  - a persistent `aria-live` wrapper around one status `<p>` (`:138-160`);
  - after a failure, the retry button stays mounted through refetch with `aria-disabled` (`:147-157`), guarded at `:81`;
  - after a successful retry, focus moves to the month label (`:83`, `:101-106`);
  - the retry button is underlined.
- Accepted drift in `statistics-overview.test.tsx`:
  - the deep-link it.each now also asserts focus left `body` (`:362-365`);
  - an added order test at `:168`.
- The hook name `useReadingMonthBooks` and its path match AS5 and T11, so this is not drift.

## Observations (not gaps)

- `statistics-overview.test.tsx:535` `waitFor(toHaveBeenCalledTimes(1))` resolves on the first match, so it does not exclude a later second update. Loop safety rests on `reading-calendar-card.test.tsx:365` (rerender with the same props) and the effect deps at `reading-calendar-card.tsx:48`.

## NOT_VERIFIED

- MAIN: `bash .claude/scripts/gates.sh` (typecheck, eslint, prettier on the diff)
- MAIN: `gh workflow run ci.yml --ref feat/statistics-activity-refactor-v5` after commit, or the PR CI run (web unit tests: `statistics-calendar.test.ts`, `reading-calendar-card.test.tsx`, `reading-habits-section.test.tsx`, `statistics-overview.test.tsx`, `statistics-kpi-grid.test.tsx`)
- MAIN: `pnpm dev:web:dev`, then visual check of `/uk/statistics?tab=activity` and `?tab=activity&calendarMode=books` at desktop and 390px, with no console errors
- MAIN: `/blast-radius` is not required: no contract-shaped file in the diff (`packages/shared`, prisma and generated code are untouched)

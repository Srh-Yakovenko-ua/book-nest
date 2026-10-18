# Book Quotes tab: progress checkpoint

This file points into `tasks.json`; it is not a tracker. On resume, read `CLAUDE.md`, `spec.md`, `tasks.json`, `verify-report.md` and this file, and check `git status` for drift first.

- Worktree: `D:\IT\book-nest\.claude\worktrees\book-quotes-tab`, branch `feat/book-quotes-tab`, built on origin/dev `6de68b54` and fast-forwarded onto `2b60663f` before the commit. The fast-forward reapplied cleanly; `uk.json`, `en.json` and the generated `model/index.ts` merged without conflicts.
- Status (2026-10-18): T1-T23, T25 and T26 done. T24 (archive regression suites) and the CI part of T27 are left to the CI run on the PR, because the project moved test runs to CI during this work (CLAUDE.md §9).
- Decisions D1-D17: recommendations adopted as recorded assumptions; see openDecisions[].answer and assumptions[].
- Reviews: S1 code-reviewer approved with nits (2 Low fixed), security-reviewer approved. S2 and S3 code-reviewer approved with nits; the Lows that were not fixed are listed in assumptions. A final security-reviewer pass over the two controllers after the fast-forward found nothing.
- Live stack used for the checks: scratch DB `booknest_quotes_tab` (copy of booknest_dev plus 45 quotes seeded into one book), API on :4100 via `apps/api/.env.quotes-tab.local` (gitignored), web on :3100 with `API_BASE_URL=http://localhost:4100`. Both servers are stopped. Dropping the scratch DB waits for the user's consent.

## Gates

After the fast-forward onto `2b60663f`: `bash .claude/scripts/gates.sh` reports typecheck, eslint on every changed file and prettier all green. ESLint found 11 errors in the new quote files on its first run (declaration order, a render result named `actions`, one conditional expect); all were fixed and the three affected test files rerun 56/56. `pnpm gen:api` rerun after the fast-forward leaves the generated diff byte-identical. i18n parity 6750/6750. `pnpm knip` and the full `pnpm test` were not run locally; CI runs them.

## Test runs

Each file ran on its own (web with `--project unit`). Counts are from the slice runs on `6de68b54` unless marked.

API:

| File                                    | Result |
| --------------------------------------- | ------ |
| `books.controller.quotes-count.test.ts` | 16/16  |
| `quotes.book-scope.controller.test.ts`  | 38/38  |
| `books.service.test.ts`                 | 56/56  |
| `quotes.service.test.ts`                | 26/26  |
| `book-quotes.controller.test.ts`        | 19/19  |

The blast-radius run over every API test file that consumes the changed contract (book-delivery, book-loan-contact, books.controller.cover, series-preview, books.controller, loan-contacts, book-quotes, reading-queue, series-crud, book-trash-isolation, quotes-overview, quotes-post-finish, quotes-trash) passed 486/486.

Web:

| File                                | Result                         |
| ----------------------------------- | ------------------------------ |
| `book-quotes-tab.test.tsx`          | 39/39, rerun after the merge   |
| `book-quotes-list.test.tsx`         | 9/9, rerun after the merge     |
| `book-quotes-toolbar.test.tsx`      | 8/8, rerun after the merge     |
| `book-quotes-tab-query.test.ts`     | 21/21                          |
| `use-book-quotes-tab-query.test.ts` | 5/5                            |
| `quotes-query.test.ts`              | 4/4                            |
| `quote-archive-card.test.tsx`       | 35/35                          |
| `book-tab-scroll-anchor.test.ts`    | 9/9                            |
| `book-details-view.test.tsx`        | 14/14                          |
| `book-notes-tab.test.tsx`           | 26/26                          |
| `use-quote-mutations.test.tsx`      | 3/3, red without `exact: true` |

The slice totals were 141 tests in 10 web files (S2) and 225 tests in 12 web files (S3). `book-notes-tab.test.tsx` failed two scroll tests once on timing under load and passed 26/26 alone.

## Browser and API runs

Headless Chromium against the live stack passed 16 of 16 checks; they are listed in `tasks.json` under `liveRun`. After the fast-forward, a curl run against the branch API confirmed the server half of the badge: `quotesCount` went 48, 49 after creating a quote, 48 after deleting it, and `GET /api/books` still carries no `quotesCount`. The client half (the badge follows that count without a reload) is covered by `book-details.test.tsx`, which drives the badge 2, 3, 2 through the real mutation hooks.

## Not run

- `pnpm knip` and the full test suite: CI.
- The archive regression suites in T24: CI. The diff touches `packages/shared`, so the PR runs the full sharded suite.

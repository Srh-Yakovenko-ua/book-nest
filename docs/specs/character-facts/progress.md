# Character Facts — progress checkpoint

Pointer into `tasks.json`, not a tracker. On resume: read `CLAUDE.md`, `spec.md`, `tasks.json`, this file and `verify-report.md`. Check `git status` for drift first.

- Worktree: `D:\IT\book-nest\.claude\worktrees\character-facts`, branch `feat/character-facts` (no upstream). Nothing committed. No commit or push without the user's explicit consent.
- Rebased onto dev on 2026-10-17, at the user's request.
  - Base moved from `14367c22` to `60c67d45` (= origin/dev, PR #278, roster cards and filters).
  - Changes were carried over with a tagged stash, which was dropped afterwards. A backup is in the session scratchpad under `rebase-backup/`.
  - Four conflicts were resolved by keeping the dev structure and re-applying this branch's additions:
    - `book-characters-tab.tsx`, `character-card.tsx` and `characters-toolbar.tsx`: unlink scope and focus refs on top of dev's filters, `onClearCriteria` and scroll-to-start;
    - generated `endpoints/characters/characters.ts`: dev's version was taken, then `gen:api` regenerated it. Relative to dev it only adds the facts endpoints (+894 lines).
  - After the rebase:
    - `pnpm typecheck`, lint (0 errors) and format are green;
    - web `features/characters` + `debounced-search-input`: 26 files / 658 tests;
    - API: characters domain/app/infra + raw-sql-indexes + create-test-app 26 / 374, and characters controllers 31 / 445;
    - all green.
- Status (2026-10-17): T1–T42 done; T43 (VERIFY + final report) is closing. S1–S6 accepted, each through its code-reviewer, plus migration-reviewer for S1, security-reviewer for S2/S4 and accessibility-auditor for S5/S6.
- TD9 (import transport): body parsed after the guards; budgets of 8 MiB, 524,288 JSON values and 64 members per object; 30 s read deadline (408); one-permit semaphore (503); boundedArray with abort; refinements gated on a clean parse; cheap v1 upgrade. Security re-check #3 signed it off after the member cap.
- Capacity: one max-length Cyrillic fact serializes to 10,571 B, so 8 MiB holds about 793 max-length facts, below the 2,000-fact cap. A larger bundle gets an explicit 413 `character_import_too_large`, and export never truncates.
- Live API on :4100 against the scratch DB:
  - health 200 with `x-request-id`;
  - facts: GET page 1 = 20 of 47; `pageNumber=3` = 7; `q` filter works;
  - POST 201; PATCH 200 keeps `createdAt`; DELETE 204, then 404;
  - page above the book's page count → 422; no token → 401; another book → 404;
  - merge preview `counts.facts` moved 50; deletion preview `factCount` 50;
  - export v2 contains 50 facts; importing it creates 50 facts.
- Tests (1 worker):
  - API: characters module 57 files / 809 tests; raw-sql-indexes, create-test-app and json-value-budget; cross-module tags, species, auth, filter and settings 6 files / 151. All green.
  - Web: the 13 files touched by T24–T39, every one green.
  - Not run locally: the rest of the full API suite. The host reaped it for low memory; CI runs it on push.
- Browser (headless Playwright): 15/15 scenarios pass, focus fixes re-verified, 390 px and dark mode checked; the only console error is the expected 401 on /login. Pre-existing issues outside this scope are not fixed: dark `--destructive` contrast, PageTabs focus ring, English sr-only "Close", input border contrast, `DiscardConfirmDialog` label overflow.
- `gen:api` is idempotent: md5 of the generated tree is identical before and after.
- Local stack: scratch DBs `booknest_facts` and `booknest_facts_shadow`, env file `apps/api/.env.facts.local` (gitignored). Ask the user before dropping the DBs.

# Agent friction log

Findings collected while working on real tasks: where agents, skills, hooks or rules slowed the work down, stalled, or needed a manual workaround. Each entry is a candidate change to the agent config, and its status says what became of it.

Entry format:

- **Stage**: which step of the task (planning, an agent run, a hook, gates, git, etc.)
- **Symptom**: what happened, with exact error text when short
- **Cost**: time or rounds lost
- **Cause**: what actually caused it, if established; otherwise "unknown"
- **Proposed fix**: which agent, skill, rule or hook to change, and how
- **Status**: fixed (with the PR), partly fixed, declined or open, and why

## Task: Statistics Stage 01, scope consistency (2026-10-20)

Spec: statistics stage 01 (scope consistency), kept outside the repo. Branch `feat/statistics-scope-consistency`.

### F1. The spec chain in the project instructions conflicts with the narrow stage prompts

- **Stage**: start, choosing the workflow
- **Symptom**: the project instructions (§10) say spec work always runs through `/spec-to-ship` (spec-auditor PLAN, `tasks.json`, one block of questions, per-slice review, spec-auditor VERIFY). The stage prompt says the opposite: one short review of the listed files only, no approvals, checks once at the end. Every stage prompt in this series (6 to 13) is shaped like this, so each run starts with a judgment call about which instruction wins.
- **Cost**: one decision round per task, plus the risk of a heavy chain (two spec-auditor runs) on a three-item task
- **Cause**: `spec-to-ship` has one lane, sized for large specs
- **Proposed fix**: add a "narrow stage" lane to `spec-to-ship`: when the spec carries its own work order, a closed file list and "no approvals", skip PLAN, `tasks.json` and the questions block, and keep only the final re-audit against the spec's regression matrix. Say this in §10 of the project instructions in one line.
- **Status**: fixed in #304. `spec-to-ship` has a narrow lane keyed on those three signals, never on the spec's size; it skips planning and questions and keeps the VERIFY audit. §12 of the project instructions also orders the sources when they disagree, and `docs/tools/stage-prompt-template.md` lists the fields a stage prompt should carry.

### F2. "My current worktree" is ambiguous when the session starts in the main checkout

- **Stage**: start, picking the worktree
- **Symptom**: the session started in the main checkout on `dev`. All three worktrees held merged branches. Personal memory says "ask which worktree", the prompt says "no approvals". The main loop reused `statistics-progress` (newest, merged) with a new branch off `origin/dev` to avoid a fresh `pnpm install`.
- **Cost**: one decision; a wrong guess would put the work on someone else's branch
- **Cause**: the start prompt names no worktree, and memory has no default for this case
- **Proposed fix**: either the start prompt template names the worktree and branch, or the worktree memory gets a default: "if every worktree is merged and clean, reuse the newest one with `git switch -c <branch> origin/dev`".
- **Status**: fixed both ways. The stage prompt template from #304 has a worktree field, and personal memory now carries that default for prompts that forbid questions.

### F3. Duplicate memory files about ESLint timing

- **Stage**: reading memory
- **Symptom**: two personal memory files recorded the same instruction from the same day, with slightly different wording.
- **Cost**: small, extra reading every session; risk that one gets updated and the other does not
- **Cause**: the memory was saved twice in one session
- **Proposed fix**: merge into one file and drop the other index line.
- **Status**: fixed outside the repo. Both files were removed rather than merged: they also contradicted §9 of the project instructions, which already carries the rule.

### F4. MCP servers needed by the rules were down

- **Stage**: session start
- **Symptom**: `context7`, `chrome-devtools` and `playwright` failed to connect (CONNECT_TIMEOUT / connection closed). The project instructions require Context7 before library code and a visual check for UI changes.
- **Cost**: library behaviour had to be read from `node_modules` by hand (query-core `queryObserver.js` for `isPlaceholderData`); the visual check depends on the Chrome extension
- **Cause**: unknown
- **Proposed fix**: a SessionStart hook line that names the missing MCP servers and the fallback (read the installed package source; Chrome extension instead of Playwright), so agents do not try Context7 and fail mid-task.
- **Status**: fixed in #304, without a hook. The harness already reports failed MCP servers to the main loop, and a hook has no reliable way to read MCP state. The Context7 rule in the project instructions and the rules every agent receives now name the fallback: read the installed package's `.d.ts` and source.

### F5. One import silently switches a whole test file into testing-library lint mode

- **Stage**: final ESLint on changed files
- **Symptom**: the test agent added `import { act } from "@testing-library/react"` to `statistics-overview.test.tsx`. ESLint then reported 19 errors, 11 of them `testing-library/no-node-access` on lines from `dev` that nobody touched. The `dev` version of the file lints clean.
- **Cost**: one lint round (about 80 s per eslint run) plus the time to prove the errors were not pre-existing (`git show HEAD:<file> | eslint --stdin`)
- **Cause**: `no-node-access` is the one testing-library rule that reports only in files importing `@testing-library/*` directly. Repo tests import `screen`, `within`, `userEvent` from `@/test-utils`, so most files are never checked for it. One direct import turns it on for the whole file.
- **Proposed fix**: (a) add to the `frontend-test-engineer` brief and agent file: "import `act` from `react` and everything else from `@/test-utils`, never from `@testing-library/*` directly", with the reason; (b) decide whether the rules should apply everywhere, by setting the plugin's `testing-library/utils-module` to `@/test-utils` in `eslint.config.mjs`, and accept the cleanup that brings in older tests.
- **Status**: partly fixed in #306. Part (a) is in the test agent definition, with `renderHook` as the one direct import. Part (b) was measured on all 405 web tests: 219 new `no-node-access` errors in 84 files, some of which need accessible names in the components, so the setting stays off for now.

### F6. Test agent skipped `prefer-presence-queries` and Prettier because it may not run tools

- **Stage**: final lint and format
- **Symptom**: two `expect(getByRole(...).closest(...)).toBeNull()` lines broke `prefer-presence-queries`, and Prettier flagged the new test block. The agent could not see either, because agents are denied tooling.
- **Cost**: one extra fix round in the main loop
- **Cause**: the no-tooling rule for agents means lint and format feedback arrive only at the end
- **Proposed fix**: list the repo's most-hit testing-library rules in `frontend-test-engineer.md` (`prefer-presence-queries`, `render-result-naming-convention`: name the render result `view`, `no-node-access`), so the first draft already follows them.
- **Status**: fixed in #306. The test agent definition has a section with these rules and the pattern that passes for each.

### F7. The test agent ran close to the 600 s watchdog

- **Stage**: `frontend-test-engineer` run
- **Symptom**: 478 s and 54 tool calls for 11 tests in three files, while the implementing agent took 155 s. It finished, but with about 2 minutes to spare.
- **Cost**: 8 minutes of wall time; a stall would have meant a resume round
- **Cause**: not established. Likely the long reads it needed to find the year control, the fixtures and the translation keys in a 630-line test file.
- **Proposed fix**: for tests across several files, brief one agent per file, or give the agent the exact helper names and line ranges up front (`renderStatistics`, `overviewResponse`, the YearPicker dialog flow).
- **Status**: fixed in #307. §10 of the project instructions says to split model and component tests across agents and to pass helper names and line ranges for test files over about 300 lines.

### F8. Each local check costs minutes on this machine

- **Stage**: final checks
- **Symptom**: `tsc --noEmit` for `@app/web` 1 min 54 s; a single 29-test vitest file 1 min 25 s (31 s of it imports); eslint on 7 files 80 s.
- **Cost**: about 6 minutes for one pass of targeted checks; any fix-and-recheck round doubles it
- **Cause**: cold runs with no cache, on a machine with about 3.4 GB free RAM
- **Proposed fix**: add `--cache --cache-location node_modules/.cache/eslint` to the targeted eslint call in the gates script, and try `tsc --noEmit --incremental` for the web typecheck; measure before and after.
- **Later observation**: at commit time the gates script ran typecheck in 19 s, lint in 61 s and format in 4 s, 85 s in total, against 114 s for the first direct `pnpm --filter @app/web typecheck`. The cause is not established: the gate run was the third typecheck of the session, so the file cache was warm. Even so, the stage prompts' "typecheck and ESLint once, targeted" maps exactly onto the gates script, and calling it directly instead of hand-picking commands would have saved the separate eslint and prettier calls.
- **Status**: partly fixed. The web typecheck already had `incremental` on, so that part was moot; the cold run came from a rebuilt `@app/shared`. #308 makes pre-push skip its checks after a green gates run on the same tree. ESLint `--cache` was left out: it was not measured, and the cache does not track type information, so it could report a stale pass.

### F9. A defect the implementing agent flagged was left for review to rediscover

- **Stage**: implementation, then review
- **Symptom**: `frontend-engineer` reported in FINDINGS that the "show all time" button sits inside the area that becomes `inert`, so focus drops to `body`. It was out of its brief, so it did not fix it, and the main loop carried it as a residual risk. `accessibility-auditor` then rated it MAJOR (WCAG 2.4.3), which cost a second fix round: two more agents, a re-review and a second gate pass.
- **Cost**: one full fix round, roughly 10 to 15 minutes
- **Cause**: the main loop's triage treated "outside the spec's file list" as "out of scope", although the defect was introduced by the change itself
- **Proposed fix**: one line in `/unlazy` or the delegation section of the project instructions: "a defect that the change itself introduces is in scope even when it needs a file outside the spec's list; when an engineer flags one, fix it in the same pass and say why the scope grew".
- **Status**: fixed in #304. `/unlazy` puts such a defect in scope once it survives fix-loop triage, and the report envelope lets an engineer mark a finding its own change introduced.

### F10. A brief paraphrased spec copy and lost meaning

- **Stage**: brief to `frontend-engineer`
- **Symptom**: the spec gave the uk status text and asked for a symmetric en text. The brief supplied an en text that dropped "for interaction". `code-reviewer` caught the drift.
- **Cost**: one extra edit inside the fix round
- **Cause**: the main loop wrote the translation into the brief and did not check it against the uk source
- **Proposed fix**: in `/spec-to-ship` and the frontend-engineer brief template, require user-facing copy to be quoted verbatim from the spec, and an en translation to be checked line by line against the uk text before the brief goes out.
- **Status**: fixed in #304. `spec-to-ship` requires spec copy verbatim in briefs, and `add-i18n-key` has the side-by-side check.

## Task: Statistics Stage 02, activity by weekday and long heatmap (2026-10-20)

Spec: statistics stage 02 (activity), kept outside the repo. Same worktree and branch as Stage 01.

### F11. The prompt assumed Stage 01 was still uncommitted

- **Stage**: start
- **Symptom**: the user's message said "keep all uncommitted Stage 01 changes", "no intermediate commits" and "one shared commit for both stages". Stage 01 had already been committed, but not pushed, at the user's own request one turn earlier.
- **Cost**: one decision: to get one commit, Stage 02 has to be folded into the Stage 01 commit with `git commit --amend` before the first push
- **Cause**: the stage prompts are written ahead of time and do not know the branch state
- **Proposed fix**: a line in the stage prompt template: "if the previous stage is committed but not pushed, amend it into one commit; if it is pushed, add a new commit".
- **Status**: fixed in #304. `spec-to-ship` has that rule for a series of stages, checked against a fresh fetch, and the stage prompt template has a field for the previous stage's state.

### F12. Three sources disagree on commit, push and client generation

- **Stage**: start, planning
- **Symptom**: the ZIP's start prompt says "commit only your own changes, report the SHA" and "do not run OpenAPI generation"; the user's message says "one shared commit and push"; the project instructions (§6 step 10) say `pnpm gen:api` after a contract change. The statistics overview hook parses the response with the `@app/shared` Zod schema, so the new field reaches the UI without generation, but the committed Orval model (`readingStatisticsOverviewDtoCalendar.ts`) now lags the backend.
- **Cost**: one reasoning round; a silent drift in generated types that nothing in CI checks (`openapi.json` is not committed and no workflow diffs the generated client)
- **Cause**: the stage specs are written against the code, not against the project instructions, and nothing records which endpoints are parsed through `@app/shared` instead of the generated Zod
- **Proposed fix**: (a) the user's message wins over the ZIP prompt, say so once in §12 of the project instructions; (b) either a CI step that regenerates the client and fails on a diff, or a note in §2 that responses parsed through `@app/shared` schemas may skip `gen:api`.
- **Status**: partly fixed. Part (a) is in §12 since #304, as a full order of sources. Part (b), the CI check for a drifted generated client, is still open.

### F13. A test agent ran 13 minutes even with the work split in two

- **Stage**: `frontend-test-engineer`, heatmap windows and pager tests
- **Symptom**: 780 s and 46 tool calls for two files (a 230-line model test and a 510-line component test). The parallel agent with the other two files took 434 s. Following F7, the briefs already named the helpers, fixtures, exact labels and expected month keys.
- **Cost**: about 6 minutes of waiting after every other agent had finished
- **Cause**: not established. The agent built a 786-day fixture and checked weekdays and window boundaries by hand before writing, which it said itself.
- **Proposed fix**: for pure helper tests, the brief can carry the expected values as a table (input range, expected windows), so the agent writes rather than derives. Split model tests and component tests across agents even when they cover one feature.
- **Status**: fixed in #307. Both test agent definitions tell the agent to print calendar facts with `TZ=UTC node -e` and date-fns instead of working them out, taken from the spec rather than replayed from the implementation.

### F14. A helper named `render…` trips a testing-library rule

- **Stage**: final ESLint
- **Symptom**: `testing-library/render-result-naming-convention` failed on `const shown = renderedDates()`. The rule treats any function whose name contains `render` as a render call and wants its result named `view`.
- **Cost**: one gate rerun (34 s)
- **Cause**: the agent's helper name contained `render`. The first version of this entry blamed the direct `act` import from F5, but this rule reports in every test file regardless of imports.
- **Proposed fix**: add to the F6 list in `frontend-test-engineer.md`: never name a test helper `render…` unless it renders.
- **Status**: fixed in #306, in the same section as F6, which also covers helpers that return a render result.

### F15. The pre-push hook repeats the gates that just ran

- **Stage**: push
- **Symptom**: the gates script was green on the exact commit, then `git push` spent 2 min 32 s on the full `pnpm typecheck && pnpm lint` again. The first gate run of the session took 3 min 54 s, mostly a cold typecheck after `@app/shared` was rebuilt; the second took 34 s.
- **Cost**: about 2.5 minutes per push
- **Cause**: the hook has no way to know the gates already passed on this tree
- **Proposed fix**: let the gates script write a stamp with the tree hash after a green run, and let `pre-push` skip its checks when the pushed commit's tree matches the stamp. Measure before and after.
- **Status**: fixed in #308. Measured: pre-push took 214 s cold and 153 s warm before, and the push of that branch took 4 s with the stamp. No stamp is written when the tree changes during the run or the branch touches lint config, package files or a `tsconfig`. Pre-push also stopped using a bare `git stash pop` on the stash stack every worktree shares.

## Found while fixing these (2026-10-21)

### F16. The bash hooks allowed everything because jq was missing

- **Stage**: every hook
- **Symptom**: `jq` was not installed on the Windows machine. Every bash hook parses its input with jq and exits 0 on an empty result, so the command guard, the file guard, the stop check and the subagent report envelope were all off with no sign. A probe commit with the subject "update", which commitlint rejects, passed.
- **Cost**: unknown; the guards had been off for weeks
- **Cause**: jq absent, and the hooks fail open
- **Proposed fix**: install jq, and warn at session start when it is missing
- **Status**: fixed. jq was installed with winget, and #305 makes the session start hook warn when jq is not on PATH. Restarting the session inside a terminal that predates the install keeps the old PATH, so the terminal app has to restart too.

### F17. The file and edit hooks did not match Windows paths

- **Stage**: every file edit
- **Symptom**: the harness sends Windows backslash paths (`D:\...`), while the file guard, the post-edit check and the stop check matched forward slash patterns. The `.env` guard and every per-edit check never fired on Windows: an edit adding `as any` under `apps/api/src` passed.
- **Cost**: unknown, the same weeks as F16
- **Cause**: path patterns written for POSIX paths only
- **Proposed fix**: turn backslashes into slashes before matching
- **Status**: fixed in #304, with fixtures for backslash paths.

### F18. Some commit messages skipped every text check

- **Stage**: commit
- **Symptom**: the commit hook read a quoted `-F` path from a copy of the command with its quoted strings blanked, so a commit made from a message file skipped commitlint and the marker checks, and a PR title next to `--body-file` was never read. On Windows jq returns CRLF, so a heredoc message was never parsed either.
- **Cost**: unknown; every commit made from a message file or a heredoc went in without commitlint, the dash check or the marker check
- **Cause**: message parsing that only worked for inline `-m` text on POSIX
- **Proposed fix**: read message files from the raw command, strip CR, always read inline titles
- **Status**: fixed in #307, together with a rule that commit and PR text, branch and tag names and the git identity never name the assistant.

### F19. Agents could run tooling through an interpreter

- **Stage**: agent runs
- **Symptom**: the guard checks a command with its quoted strings blanked, so a subagent could run `node -e 'require("child_process").execSync("pnpm vitest run")'` or `bash -c 'pnpm typecheck'` past the no-tooling rule.
- **Cost**: none yet; found in review while `node -e` became a normal agent tool for calendar facts (F13)
- **Cause**: the tooling check never looks inside the argument an interpreter executes
- **Proposed fix**: for subagents, check the body of `node -e`, `bash -c` and similar arguments, and deny `child_process` use in them
- **Status**: fixed in the same PR as this status update, for inline code in its usual shapes: combined flags such as `bash -lc` and `node -pe`, `cmd /c` and `cmd //c`, PowerShell `-Command` and encoded commands, code piped or heredoc-fed into an interpreter, and process calls from JS, Python, Perl, Ruby, Bun and Deno. A command assembled from string pieces, or a script file the agent writes and then runs, stays out of reach of a pattern check; the no-tooling rule every agent receives covers those.

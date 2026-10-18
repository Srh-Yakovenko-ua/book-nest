---
name: fix-loop
description: Review a finished diff in parallel, fix only confirmed findings through the agent that owns each path, re-review only what the fixes touched, two rounds at most. Use when the user says "сделай ревью и почини", "полный ревью", "ready to commit", "review and fix" on a diff bigger than a few lines.
---

# Fix loop

A review that produces forty findings and a fix pass that touches sixty files is how scope creeps and tokens burn. This loop keeps each round narrow: only confirmed findings get fixed, only by the owner of the path, and only the touched files get looked at again.

## Steps

1. **Scope.** `git diff HEAD --stat` plus `git ls-files --others --exclude-standard`. That file list is the whole review surface; reviewers get it in the brief with "review this diff only".
2. **Review, in parallel, at most three agents at once.** Always `code-reviewer`. Add `migration-reviewer` for `apps/api/prisma/**`, `security-reviewer` for auth, API input, forms, env or deps, and `accessibility-auditor` or `frontend-performance-auditor` for UI. `seo-auditor` is added for routing, metadata or next-intl.
3. **Triage before any fix.** Keep only BLOCKER and MAJOR (security: Critical and High) whose basis is `doc`, `rule`, `bug` or `measured`. Open each kept `file:line` yourself, one Read: a finding that does not hold in the code is declined. `smell` findings and the "Not introduced here" section are never fixed in this loop. The user's rule is to fix only what was asked, so they go to the user as a list.
4. **Fix through the path owner, one brief per owner.**
   - `apps/api/src/**` → `backend-engineer`.
   - `apps/web/src/**` → `frontend-engineer`, or `design-engineer` for a purely visual finding.
   - Test files → the matching test engineer.
     Paste the confirmed findings verbatim with `file:line`, plus: "fix exactly these, change nothing else".
5. **Round 2, narrow.** Re-run only the reviewers whose findings were fixed, scoped to the files the fixes changed, and pass them the declined list so they do not raise it again. Stop after this round. Anything still open goes to the user; a third round is the user's call.
6. **Gates once:** the `/check` skill. Tests run in CI.

## Report

One block: fixed (count and files), declined (one line each with the reason), left for the user (one line each), gate lines from `/check`, and the `CI:` test files the change will exercise.

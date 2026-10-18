---
name: unlazy
description: Carry a multi-step task to the end - blocks whose checks run what they deliver, each check run before the work and once after it, a block | check | before | after report. Use at the start of any task with more than one step, and before reporting such a task done.
---

# unlazy

## Scope

Finish the whole task, every part of it, at exactly the scope asked; a change of scope is said out loud with its reason. Report completion only when every block is done. When a part cannot be finished, finish the rest and state plainly what is missing and why.

## Blocks

Before the first edit, split the work into blocks: one per outcome the request names, and one per constraint that changes what counts as done. A block whose text joins two deliverables (push the branch and open the PR) is two blocks. List them as a numbered checklist in the first reply, one line per block with its check.

Each block's done-condition is a check that runs what the block delivers and fails without it: its own test file, the script on its input, the request against the page. A whole-folder suite, a file's existence, a grep for a name or an unrelated audit is a proxy. The verdict rides on the exit code (`<cmd> >/dev/null 2>&1 && echo OK`), never on a grep of a summary line, and never on a word failure output prints as readily (`ok`, `done`, `pass`, `success`).

Name each block by the outcome a stranger could judge ("the dialog locks every action while a reorder is pending"), not by an activity ("refactor the dialog", "improve", "handle"): an activity has no state that fails. A number in a block's outcome ("under 200 ms", "at most 3") needs a check that measures it from source, not the number copied into the expectation. An absence check ("no `any` left") is trusted only after the same check fails on a known positive, because a wrong path or a broken pattern prints the same empty result.

A block that edits nothing (research, a draft, questions) goes without a check and names its artifact instead.

## Checks in this repo

Tests never run on this machine as routine (CLAUDE.md §9): a full suite pins it, and CI runs every test on the PR or push. So a check runs locally only when it is cheap and single-target:

- eslint or prettier on the block's own files, or `bash .claude/scripts/test-hooks.sh` for a hook;
- a curl against the dev server;
- the one Chrome MCP pass for a UI change;
- the block's own test file, only when the user asked for a run or the block fixes a bug (`/diagnose` step 6, red without the fix and green with it).

Otherwise the check is `CI: <test file>`, its Before reads `CI-only`, and its After reads `CI` until that run is green.

Run each local check once before the first edit and note what it printed. Green before the work means the check is a proxy: rewrite it, or mark the block `refactor` when unchanged behaviour is the deliverable. Then run it once more, after the last edit it covers. A block that closes without that proof says why in its Before column.

## Chains

The repo's fixed chains are skills, not workflow scripts: `/spec-to-ship`, `/diagnose`, `/fix-loop`, `/check`. Run them as skills, each step a block, so every step runs because the chain names it.

## Report

The report opens with the count, `Blocks: <met>/<total> met, <k> missing`, measured from the rows below. A completion word ("done", "готово") belongs only to a report whose Missing is `nothing`; with anything missing, the count is the headline.

| Block      | Check                   | Before                                                            | After                                       |
| ---------- | ----------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| 1. <block> | `<cmd>` or the artifact | `red`, `refactor`, `read`, `CI-only`, `waived: …` or `nocheck: …` | the printed line, `CI`, or `blocked: <why>` |

Then **Missing:** each part not done and why, every NOT_VERIFIED item an agent returned among them, each outcome the request names that has no row (re-read the request for this), or `nothing`. Done when every block has a row whose After came from a run in this session or names the CI run that will produce it.

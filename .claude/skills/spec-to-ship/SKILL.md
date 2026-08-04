---
name: spec-to-ship
description: Run a written spec (docs/backend-task-*.md, docs/*-spec.md, a handed-over ТЗ) through the full chain instead of implementing it head-on — verify the spec against the code, decompose into a checkable tasks.json, ask every open question once, implement slice by slice with per-slice review, then re-audit the diff against tasks.json before calling it done. Use whenever a task arrives as a spec document, or when the user says "начни реализацию", "разложи задачу", "сделай по спеке", "системно", "цепочкой", "с аудитом".
---

# Spec to ship

Head-on implementation is the failure mode. The spec gets read once, code gets written from an impression of it, and the gap surfaces at review time or later in prod. This chain makes each stage produce an artifact the next stage checks, so a dropped requirement has nowhere to hide.

**Hard rule: no stage is skipped because the spec "looks small". Small specs are where a requirement buried in an appendix gets silently marked optional.**

The main agent orchestrates. Specialist work is delegated per `CLAUDE.md` §10.

---

## Stage 0 — Intake

Copy the spec into `docs/` under its own name. Record where it came from. If the user handed over several, list them and confirm which is in scope.

**Gate:** the spec file is on disk in the repo and the scope sentence is written down.

## Stage 1 — Verify the spec against the code

Delegate to `spec-auditor` in **mode PLAN**. It reads every assertion the spec makes about the codebase and checks it against the actual files.

This stage exists because specs age. Line numbers drift, fields get renamed, and part of the work is often already done. Implementing from an unverified spec means implementing against a codebase that no longer exists.

**Gate:** every assertion carries a verdict (`CONFIRMED` / `MOVED` / `STALE` / `ALREADY DONE` / `FALSE`) with a `file:line` opened this run.

## Stage 2 — Decompose into `tasks.json`

Same `spec-auditor` run produces `docs/specs/<slug>/tasks.json`: one entry per atomic unit of work, each with `layer`, `files`, `dependsOn`, `mandatory`, and `doneWhen` criteria checkable from a diff.

This file is the contract for the rest of the chain. Stage 6 audits against it, not against anyone's memory of the spec.

**Gate:** every requirement extracted from the spec maps to a task or appears under `excluded` with a written reason. `mandatory: false` only where the spec itself said optional.

## Stage 3 — One block of questions

Every open decision goes to the user in a **single** message: the fork, what the spec offered, what the codebase makes cheaper, and a recommendation. Mirror the answers back into `tasks.json`.

After this stage, execution runs to completion without stopping to ask. Anything discovered later that would have been a question becomes a stated assumption recorded in `tasks.json`.

**Gate:** `openDecisions` is empty or every entry has a recorded answer.

## Stage 4 — Implement slice by slice

Walk `tasks.json` in dependency order, grouping into slices that leave the repo green. Per slice:

- Contract first: shared Zod DTO in `packages/shared` before the code that satisfies it.
- Delegate implementation to `backend-engineer` / `frontend-engineer`, tests to `backend-test-engineer` / `frontend-test-engineer`, migrations through the `/db-migrate` skill and `migration-reviewer`.
- Hand the subagent the relevant `tasks.json` entries verbatim, including `doneWhen`. A subagent does not see this conversation.
- Mark each task `done` in `tasks.json` only after its `doneWhen` criteria hold.

**Gate:** each slice ends with `pnpm typecheck` and `pnpm lint` green before the next one starts. A red slice is fixed, not carried forward.

## Stage 5 — Per-slice review

After a meaningful slice, launch reviewers in one turn (parallel `Agent` calls): always `code-reviewer`; plus `security-reviewer` if the slice touches auth / input / env / deps, `migration-reviewer` if it touches `prisma/**`, the UI auditors if it touches `apps/web`.

Findings get fixed inside the slice, not deferred to a cleanup pass that never comes.

**Gate:** no unresolved high-severity finding carries into the next slice.

## Stage 6 — Completeness re-audit

Delegate to `spec-auditor` in **mode VERIFY**. It derives the real diff with `git diff --name-only`, walks every task's `doneWhen`, and returns `done` / `partial` / `missing` with proofs, plus any drift the diff contains that no task asked for.

This is the stage that catches the requirement that got quietly downgraded. Do not skip it because the work "feels" finished.

**Gate:** every mandatory task is `done` with a proof. Anything `partial` or `missing` sends the chain back to stage 4, not into the report.

## Stage 7 — Gates and live verification

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm knip
```

Backend additionally: `pnpm gen:api` produces no surprise diff, `pnpm dev:api` starts clean, and the affected endpoint is curled with the output captured. Frontend additionally: `pnpm dev:web` starts clean and the UI is verified visually.

**Gate:** every gate green, or a failure explicitly attributed to a pre-existing unrelated issue with evidence.

## Stage 8 — Close out

Update memory / `docs/features/**` as the change warrants. Report: what shipped, what was excluded and why, which gates ran, and the curl or screenshot proof.

**Never commit or push without explicit consent.**

---

## Loop-back rule

When a gate fails, return to the stage that produced the bad input and re-run it. Never patch the conclusion. A `missing` task at stage 6 goes back to stage 4. A wrong assertion discovered at stage 4 goes back to stage 1 and `tasks.json` is regenerated.

## Anti-patterns this kills

| Symptom                                                              | Stage that catches it |
| -------------------------------------------------------------------- | --------------------- |
| Implementing against a `file:line` that moved three commits ago      | 1                     |
| A requirement in an appendix marked optional by nobody in particular | 2                     |
| Questions dribbling out across the whole task                        | 3                     |
| A slice that leaves typecheck red "for now"                          | 4                     |
| Review findings collected into a cleanup pass that never runs        | 5                     |
| "Looks done" with no per-requirement proof                           | 6                     |
| "Should work" with no curl                                           | 7                     |

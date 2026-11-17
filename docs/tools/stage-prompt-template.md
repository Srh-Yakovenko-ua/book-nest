# Stage prompt template

A stage prompt says what to build and what state the work starts from. How the work runs is already decided by `CLAUDE.md` and the skills: which chain, when checks happen, how agents are briefed. A prompt that restates any of that becomes a second source that can disagree with the first, and every disagreement costs a decision round at the start of the run. So keep the prompt to the task and its state, and put process in it only when you mean to override the default.

## The template

```
Task: <path to the spec>
Worktree: .claude/worktrees/<name>, branch <branch> (new from origin/dev | existing)
Previous stage: none | uncommitted | committed, not pushed | pushed
Mode: narrow (no planning or questions, final audit still runs) | full spec-to-ship
Commit: one commit shared with the previous stage | its own commit | none yet; push: yes | no
gen:api: yes | no, because <reason>
Overrides: none | <each deliberate departure from CLAUDE.md, with the reason>
```

## Why each field is there

**Worktree.** A session that starts in the main checkout has to pick one. Memory says to ask, a prompt that says "no approvals" says not to, and a wrong guess puts the work on someone else's branch. Naming it removes the guess.

**Previous stage.** Prompts in a series are written ahead of time and assume the previous stage is still uncommitted. When it has already been committed, "one shared commit" means amending that commit, which is only safe before the first push. The session checks this anyway, but the field saves the round.

**Mode.** The narrow lane in `spec-to-ship` skips planning and the question block but keeps the final audit against the spec. It applies when the spec brings its own work list, a closed file list and "no approvals". Saying which mode you want stops each run from weighing the stage prompt against `CLAUDE.md`.

**Commit and gen:api.** In one run these were the two places where the stage prompt, the message that launched it and `CLAUDE.md` all said different things. Write the answer once here.

**Overrides.** If you want a run to depart from the usual workflow, for example no review agents on a one-line fix, write it here with the reason. An override written as a plain instruction in the middle of the prompt reads like a conflict; written here it reads like a decision.

## When sources still disagree

Your latest message wins, then the stage prompt, then memory, then the defaults in `CLAUDE.md`. A prompt can change the workflow but never the code rules or anything a hook enforces. The session names the source it followed whenever two of them disagreed.

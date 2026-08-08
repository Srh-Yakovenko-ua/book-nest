---
name: handoff
description: Compact the current session into a handoff document a fresh agent can start from. Use when the user says "передай", "handoff", "сверни контекст", "продолжим завтра", when a session has run long enough that context is being summarised, or before switching to an unrelated task.
argument-hint: "what the next session will focus on"
disable-model-invocation: true
---

# Handoff

Write a document that lets a fresh agent resume this work without re-deriving it. Save it to the session scratchpad directory, never into the repository — it is a note between agents, not a project artifact.

If the user passed an argument, treat it as what the next session will focus on and slant the whole document toward that.

## The rule that makes it useful

**Do not restate what an artifact already holds.** Point at it instead.

This repo already records a great deal: `tasks.json` under `docs/specs/**` holds the plan and every adopted decision with its rationale, commit messages hold the why, `CLAUDE.md` holds the conventions, the memory directory holds the cross-session facts. A handoff that re-summarises those is longer, goes stale the moment they change, and buries the part only this session knows.

The document's whole value is the part that exists **nowhere but in this conversation**.

## What to write

- **Where the work stands.** Branch, last commit, whether it is pushed, whether CI is green. One line each.
- **What is uncommitted and why.** A dirty tree needs an explanation or the next agent will guess wrong.
- **The next concrete action.** Not a goal — an action. "Run `/blast-radius` on the `MoveListBookInput` change, then commit" beats "finish the move endpoint".
- **What was tried and rejected**, with the reason. This is the single most expensive thing to rediscover, and it is never in the artifacts.
- **Live traps.** A stale build, a failing pre-existing test, a service that must be running, a migration applied locally but not committed.
- **Open questions** the next session must resolve, and who can answer them.
- **Suggested skills** for the next session, so it starts in the right frame.

## What to leave out

- Anything in `tasks.json`, a commit message, `CLAUDE.md`, or memory — link it by path instead.
- A narrative of what happened turn by turn. The next agent needs the state, not the story.
- Praise for the work, or a summary of how much was done.

## Redaction

Strip secrets before writing: tokens, passwords, connection strings with credentials, and personal data. Write `<REDACTED>` in their place. Database URLs in this repo carry a password — redact the credential, keep the host and database name, since those carry the signal.

## Finish

Report the file path and the single next action, so the user can hand both to the next session in one line.

---
name: grill
description: Interrogate a plan or design in rounds until nothing is silently assumed, mapping decisions as a tree and asking each round's whole frontier at once. Use before anything hard to reverse — a schema shape, a module boundary, an auth or money decision, a public contract — and when the user says "погрилль", "разбери идею", "стресс-тест", "обсудим", "что не так с этим", "grill me", "poke holes".
---

# Grill

The user ships fast and has told you not to ask permission for routine work. That standing instruction is about **routine** work. It is not a licence to guess on a decision that costs a migration, a data loss, or a rewrite to undo. This skill is the exception path: when a decision is expensive and underspecified, stop and interrogate it properly, once, instead of dribbling questions across the whole task.

The output is not code. It is a shared understanding you are both willing to build on.

## The design tree

Model the work as a tree. Every decision branches into the decisions that hang off it. "Does a list own its books or reference them?" branches into "what happens on delete", which branches into "does a trashed book hold its slot".

The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you have not heard yet. A question whose answer depends on another question still open in this round belongs to a **later** round.

## The loop

1. **Compute the frontier.** List the decisions that are answerable right now.
2. **Find every fact yourself.** A question you could answer by reading the repo is not a question, it is laziness. Read the schema, grep the callers, run the query. When a frontier question needs an expensive lookup, dispatch a subagent and keep asking the rest of the frontier while it runs. Only the questions downstream of that lookup wait.
3. **Ask the whole frontier in one message.** Numbered, each with your recommended answer.
4. **Wait.** The decisions are the user's.
5. **Recompute.** Their answers settle branches and push the frontier outward. Go again.

Done when the frontier is empty. Then, and only then, act.

## Question format

```
❓ **Q1 — <short title>**: <the question, with the options and what each costs>

➡️ <your recommendation, and why>
```

The recommendation is not optional and it is not a hedge. This user answers tersely and often in one word, so a question they can settle with "да" or "второе" is worth three questions they have to write a paragraph to answer. Give them something to agree or disagree with.

## What earns a grill

- A Prisma schema shape, especially a relation's cardinality or an ownership decision. Getting this wrong costs a migration against live data.
- A seam: where a module boundary goes, what crosses it, whether a port is real. See `/deep-module` for the vocabulary.
- A request or response contract that the frontend will be built against.
- Anything touching auth, money, deletion, or another user's data.
- A performance decision that bakes in an access pattern (a denormalised counter, a materialised rank, a cache).
- A "we'll clean it up later" that you can already tell will not be cleaned up later.

## What does not

Routine work. Naming. Anything reversible with an edit. Anything the repo already decides for you: if `CLAUDE.md`, an ADR, an existing module or a memory already settles it, follow it and say so. Do not grill the user about a decision they have already made.

## When the grilling ends

Write the settled decisions down before the memory of them fades:

- If the work has a `docs/specs/<slug>/tasks.json`, mirror the answers into it.
- If a decision was hard to reverse, surprising, and a real trade-off, it is an ADR. Run `/domain-model`.
- If the grilling sharpened a term ("position is the stored integer, rank is what the user sees"), that belongs in `CONTEXT.md`, also via `/domain-model`.

A decision that lives only in a chat log is a decision you will re-make, differently, in three weeks.

## Related

`/spec-to-ship` is the chain for work that arrives as a written spec. It has its own single-question-block stage. Grill is for work that arrives as an idea in conversation, with nothing written down yet, and it can feed the spec that chain then consumes.

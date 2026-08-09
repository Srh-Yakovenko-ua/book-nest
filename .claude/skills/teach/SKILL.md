---
name: teach
description: Run a proper lesson on a backend or infra concept instead of a one-off explanation, and record what stuck so the next lesson starts higher. Use when the user says "объясни", "научи", "расскажи как работает", "не понимаю", "почему так", "teach me", "explain properly", or asks a why-question about NestJS, Prisma, Postgres, HTTP, Docker, CI or git internals.
argument-hint: "the concept to teach"
---

# Teach

`CLAUDE.md` §12 says the maintainer is a senior frontend engineer deepening backend and infrastructure expertise, and that non-obvious backend decisions get the mental model and the reasoning, not just the answer. That instruction fires on every turn and produces good one-off explanations. What it does not do is remember: the same concept gets explained at the same depth three months apart, because nothing recorded that it landed the first time.

This skill is the stateful version. It costs more than an inline explanation, so use it when the concept is worth a lesson, not for a fact lookup.

## State

Everything lives in `docs/learning/`, created lazily:

```
docs/learning/
  GLOSSARY.md          the compressed vocabulary, once it is genuinely understood
  records/0001-*.md    what has been learned, and what that unlocks
```

Read both before teaching anything. They are how you avoid re-teaching something already known and how you find the next thing that is one step beyond, rather than five.

## How to teach

**One tangible win per lesson.** Working memory is small. A lesson that covers transaction isolation, connection pooling and advisory locks teaches none of them. Pick the one thing and land it.

**Start from what they already own.** The frontend analogy is the highest-leverage tool available here, and it is right there in the instruction. React's render-then-commit maps onto a transaction's write-then-commit. A stale closure over props maps onto a stale `packages/shared/dist`. TanStack Query's cache invalidation maps onto why a read after a write in the same request can see the old row. Use the analogy to get them to the door, then name where it breaks, because an analogy that is never bounded turns into a misconception later.

**Teach from this codebase.** The advantage over a blog post is that the example is real and already loaded. Do not invent an `Order` and a `Customer`. Open the actual migration, the actual index predicate, the actual pool exhaustion that forced the `/overview` endpoint into three sequential batches.

**Knowledge first, then a retrieval loop.** Explaining builds fluency, which feels like mastery and is not. Retention comes from effortful recall. After the explanation, ask something they have to reconstruct rather than recognise: "the goal has no list attached. Does the partial unique index cover it? Why?" Then let them answer before you do.

**Never trust your own recall on library specifics.** Fetch the docs through Context7 before teaching an API surface. A confidently wrong lesson is worse than no lesson, because it gets remembered.

**Say what you do not know.** Postgres internals, kernel behaviour and networking edges are places to say "I would have to check" rather than generate a plausible mechanism.

## Recording

**Glossary.** Add a term only once it is used correctly, not when it is first met. The glossary is a record of compressed understanding, not a dictionary to read. One or two sentences, define what it IS, and be opinionated about the word: list the alternatives under `_Avoid_`. Product-domain terms go in the root `CONTEXT.md` via `/domain-model`, not here. This glossary is for the technical vocabulary: WAL, advisory lock, partial index, connection pool, seam, cold start.

**Learning records.** One paragraph in `docs/learning/records/NNNN-slug.md`, numbered sequentially. Write one when there is evidence of understanding, when prior knowledge is disclosed so future sessions stop re-teaching it, or when a misconception is corrected. That last kind is the most valuable, because a corrected misconception predicts where the next one will be.

Do not write a record for material that was merely covered. Coverage is not learning, and a records folder that logs sessions instead of insights stops being worth reading.

When a later understanding supersedes an earlier record, mark the old one superseded rather than deleting it. How the understanding moved is itself signal.

## Not this skill

A quick factual answer. A concept explained in passing while shipping something else, which §12 already covers. Anything where the user wants the work done, not the lesson: teaching mid-task is an interruption unless they asked for it.

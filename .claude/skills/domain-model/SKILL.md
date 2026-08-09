---
name: domain-model
description: Pin down the project's vocabulary in CONTEXT.md and record hard-to-reverse decisions as ADRs in docs/adr/. Use when a term is being used two ways, when you are about to name a new concept, when a decision was made that a future reader would question, and when the user says "как это назвать", "глоссарий", "почему мы так решили", "ubiquitous language", "ADR", "запиши решение".
---

# Domain model

Two artifacts, one job: stop the project from re-deciding things it already decided.

- **`CONTEXT.md`** at the repo root is the glossary. What each term means, and which words we deliberately do not use for it.
- **`docs/adr/NNNN-slug.md`** are the decisions. Why we did the surprising thing.

Create both lazily. If `CONTEXT.md` does not exist, create it when the first term is resolved. If `docs/adr/` does not exist, create it when the first ADR is needed. An empty glossary written up front is worse than none, because it looks maintained.

This is the **active** discipline: challenging terms, stress-testing them against scenarios, writing them down the moment they crystallise. Merely reading `CONTEXT.md` for vocabulary is a habit any task can have, not this skill.

## Why this repo needs it

The vocabulary here is already ambiguous in ways that have produced real bugs and real re-reads:

- `position` is the sparse stored integer in `book_list_items`. **Rank** is the dense number the user sees. A test asserted the stored value and failed, because the endpoint returns the rank.
- `queue_position` on `books` is a third thing again, and belongs to the reading queue, not to lists.
- **Trash**, **soft delete**, and **archive** are used interchangeably in conversation but are not the same mechanism. A reading goal is _archived_, which releases its partial-unique slot. A book is _trashed_, which starts a 90 day purge clock.
- A **delivery** and a **loan** are both "a book that is not on the shelf right now", and both have a one-active partial-unique index, but they are different tables with different lifecycles.
- **List**, **series**, and **shelf** all mean "a group of books", and only two of them exist.

Every one of those is a term that a new module will get wrong unless it is written down.

## During the work

**Challenge against the glossary.** When a term is used in a way the glossary does not support, say so immediately. "The glossary says position is the stored integer, but you are describing the rank. Which do you mean?"

**Sharpen fuzzy language.** When a term is overloaded, propose a canonical one and name the alternatives you are rejecting. Being opinionated is the point: a glossary that lists three acceptable synonyms has not compressed anything.

**Stress-test with scenarios.** Do not settle a relationship in the abstract. Invent the awkward case. "A book is in two lists and gets trashed. Does it hold its slot in both? Does the rank of everything below it shift immediately, or at read time?"

**Cross-reference with the code.** When someone states how something works, check. The schema, the raw-SQL index predicates, and the service are the truth. If the code disagrees with the sentence, surface the contradiction rather than recording the sentence.

**Write it down inline.** The moment a term resolves, update `CONTEXT.md`. Do not batch. Batched glossary updates never happen.

## CONTEXT.md format

```md
# book-nest

One or two sentences on what this product is.

## Language

**Rank**:
The dense, one-based number a book shows at in a list, computed at read time from the stored positions.
_Avoid_: index, order, position

**Position**:
The sparse integer stored in `book_list_items.position`. Gaps are deliberate, so an insert usually costs no rewrite.
_Avoid_: rank, sort order

**Trashed**:
Soft-deleted with `deleted_at` set, hidden from every read, purged by the background job after the retention window.
_Avoid_: archived, removed, deleted
```

Rules:

- **One or two sentences.** Define what the term IS, not what it does.
- **Only terms specific to this product.** Pagination, timeouts, and DTOs are general programming concepts and do not belong, however much the code uses them.
- **No implementation details.** `CONTEXT.md` is a glossary, not a spec and not a scratchpad. A column name earns its place only when the name is itself the ambiguity, as with `position` above.
- **Group under subheadings** when clusters emerge (books, lists, lending, taxonomy). Flat is fine while it is short.
- **Revise in place.** A stale definition is worse than a missing one.

## ADRs

An ADR is a paragraph. That is the whole format.

```md
# Sparse positions with a rank computed at read time

List membership stores a sparse `position` integer and the API returns a dense
rank computed when the page is read. Storing the dense value instead would mean
rewriting every row below an insert; computing it on read costs one ordered
query and keeps writes O(1). Resequencing runs as a single set-based UPDATE
when the gaps run out.
```

Number them sequentially: scan `docs/adr/` for the highest number and add one.

**Offer an ADR only when all three are true.** If any one is missing, skip it.

1. **Hard to reverse.** Changing your mind later costs real work: a migration, a contract change, a rewrite.
2. **Surprising without context.** A future reader looks at the code and asks "why on earth".
3. **A real trade-off.** There were genuine alternatives and you picked one for stated reasons.

What qualifies here: architectural shape (modular monolith, engineless Prisma, pure-JS deps over native addons); deliberate deviations from the obvious path (raw SQL where Prisma could not express the index, a pure-TS grouping instead of a SQL `CASE`); constraints not visible in the code (the local Postgres CPU cap, the connection-pool ceiling that forced batched queries); and rejected alternatives whose rejection is non-obvious, so nobody proposes them again in six months.

What does not: a library choice you could swap in an afternoon, a naming decision, anything already stated in `CLAUDE.md`.

## Where decisions currently die

This repo already records decisions, in `docs/specs/<slug>/tasks.json` under adopted assumptions. That file is scoped to one feature and stops being read the day the feature ships. When a decision inside it will outlive the feature, promote it to an ADR. That promotion is the main thing this skill is for.

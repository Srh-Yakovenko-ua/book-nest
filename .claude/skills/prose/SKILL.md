---
name: prose
description: Write user-facing text that reads like a person wrote it — README and docs, changelog entries, release notes, PR bodies, commit messages, error copy. Use whenever text will be read by a human rather than parsed by a model, and when the user says "напиши текст", "по-человечески", "перепиши", "release notes", "описание PR", "звучит как робот".
---

# Prose

Text a person reads has a different job from text a model reads. A model wants every branch enumerated. A person wants to finish the paragraph. Optimising the first for the second is how documentation ends up technically complete and completely unread.

## The house style

The maintainer asked for this directly, in these words: "по-человечески, без тире своих".

**No em-dashes.** Not one. They are the single loudest tell of machine-written English, and this user finds them off-putting. Use a comma, a colon, parentheses, or two sentences. If a sentence only works with an em-dash, the sentence has two ideas in it and wants to be split anyway.

**No `X — Y` definition lists.** The pattern where every bullet is a term, a dash, and a gloss reads as a generated glossary. Write the bullet as a sentence.

**No attribution footer.** Never add "Generated with Claude Code" or a robot emoji to a commit, a PR body, or anything else. The user asked for it removed entirely.

**Plain over formal.** Short sentences. Concrete nouns. Say "the deploy went red" rather than "a deployment failure was encountered". Contractions are fine.

**Cut the throat-clearing.** No "In this document we will", no "It is important to note that", no closing paragraph that restates the opening. Start with the thing.

**Say the number.** "27 minutes down to 7.3" beats "significantly faster". Vague intensifiers are what you write when you have not measured.

## Where it applies

In scope: `README.md`, everything in `docs/`, changelog and what's-new entries, release notes, PR titles and bodies, commit messages, comments in `.env.example`, and any user-facing string in the product.

Out of scope: files under `.claude/`. Those are read by a model, and the trade-offs there are different, so they follow `/writing-for-agents` instead. This exemption is about the audience, not a licence to write badly.

## Structure

**Ground a concept before you lean on it.** The reader either walked in knowing it or met it in an earlier paragraph. A sentence that reaches for an unexplained idea loses them, and no amount of later explanation gets them back. The unit is the concept, not the jargon: you can lose someone with entirely plain words if the idea underneath is new.

Decide up front what the reader is assumed to know. Demand too much and you shut people out. Explain too much and the opening drowns.

**Every paragraph does a job the previous one did not.** If you cannot say what a paragraph adds, cut it. This is the single highest-yield edit.

**Choose the format on purpose.** Prose carries an argument. A list carries genuinely parallel items, and if the items are not parallel, prose is better. A table earns its place when the same three fields repeat three or more times. A code block when it is runnable or multi-line. Reaching for bullets by default is a way of avoiding the work of connecting ideas.

## The specific artifacts

**Commit messages.** Subject line says what changed, in the imperative, under about 70 characters. Body says why, and specifically what a reader six months out would not be able to infer from the diff. The commit that shipped the set-based resequence is a good example: the diff shows a loop became one statement, and only the body can tell you that the loop would have blown the transaction timeout on a three thousand book list and silently lost the removal.

**PR bodies.** What changed, why, how it was verified. The verification section is the one people skip and the one reviewers actually want. Name the gates that ran and what they said.

**Changelog entries.** Written for a user of the product, not a reader of the codebase. "You can now see where each book in your wishlist is cheapest" rather than "added a best-offer aggregate to the wishlist endpoint". Both locales, uk and en, always together. The `changelog-writer` agent owns the seed file and the rules about what qualifies.

**Error copy.** Say what happened and what the person can do about it. An error that only names the constraint that failed is a log line, not a message.

## Editing an existing draft

Read it once end to end before touching anything. Then, in order: strip the em-dashes, cut every sentence that does not do a job, split the sentences that carry two ideas, and replace the vague quantities with real ones. Do not restructure a document that only needed a pass of tightening. Most prose problems are local.

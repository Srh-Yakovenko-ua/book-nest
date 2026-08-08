---
name: writing-for-agents
description: How to write a document an agent consumes — a skill, an agent definition, CLAUDE.md, or a doc reached by a pointer. Use when creating or editing anything under .claude/, when adding or pruning CLAUDE.md, or when an instruction is followed inconsistently across runs.
---

# Writing for agents

The goal is not that the agent produces the same output every run. It is that the agent takes the same **process** every run. Everything below is a lever on that.

## Context pointers

A **context pointer** is a reference the agent holds in context that names material sitting outside it and encodes when to go get it. A skill's `description`, a line in `CLAUDE.md` naming a doc, the trigger sentence on an agent definition — all the same object.

The pointer's **wording**, not its target, decides whether the material gets reached. A perfect document behind a vague pointer is a variance bug: some runs find it, some do not. Sharpen the pointer before you consider inlining the material.

A good pointer does two jobs: says what the material is, and lists the **branches** that should trigger reaching it.

- **Front-load the trigger word.** The first few words do the work.
- **One trigger per branch.** Three synonyms for the same situation is one branch written three times; keep genuinely distinct cases only. In this repo, do keep the Russian trigger phrases — the user works in Russian and they are distinct surface forms, not synonyms of the English ones.
- **Cut identity the body already carries.** The description is not a summary of the skill.

## The two budgets

Every document and pointer spends one of two things:

- **Context load** — always-loaded material: `CLAUDE.md`, every skill `description`, every agent description. It costs tokens and attention on _every turn_, whether or not it fires. `CLAUDE.md` is the expensive one: it is loaded in full, every session, forever.
- **Cognitive load** — the cost on the human of remembering which documents exist and when to reach for each. Not a cost to eliminate; it is the price of the user keeping agency. Spend it where human judgement matters.

Material behind a pointer escapes context load for the price of one line. Material with no pointer at all rides entirely on the human's memory.

**The practical consequence for this repo:** a rule that applies to every change belongs in `CLAUDE.md`. A rule that applies to one kind of change belongs in a skill with a sharp pointer. Moving the second kind into `CLAUDE.md` taxes every future session to serve a minority of them.

## Information hierarchy

Documents are built from two content types that mix freely:

- **Steps** — the ordered actions the agent performs.
- **Reference** — definitions, rules and facts consulted on demand.

Each piece sits on a ladder, ranked by how immediately it is needed:

1. **In-file step** — what the agent does, in order.
2. **In-file reference** — consulted on demand. A flat list of peer rules on one rung is fine, not a smell.
3. **Disclosed reference** — pushed into a separate file behind a pointer, loaded only when the pointer fires.

Push too little down and the top bloats; push too much and you hide what the agent actually needs. That tension is the entire decision.

**The branching test** is the cleanest way to settle it: inline what _every_ branch needs, disclose what only _some_ branches reach.

When a document has steps, in-file reference that should have been disclosed buries them, and whether the agent attends to the steps becomes a coin flip.

## Co-location

Where the ladder decides how far down a piece sits, co-location decides what sits beside it. Keep a concept's definition, its rules and its caveats under one heading, so reading one part drags its neighbours along.

The test: does it read like documentation written for the agent? Grouped material does. Scattered material does not.

This is distinct from duplication. Duplication says one thing in two places, and the two drift. Scattering fragments one thing across many places, and the reader assembles only part of it.

## Writing the instruction itself

- **State the rule, then the reason.** The reason is what lets an agent apply the rule to a case you did not enumerate. A rule with no reason gets followed literally and wrongly at the first edge.
- **Prefer a prohibition with an escape hatch over an absolute.** "Never X" gets quietly violated when X is genuinely right; "Never X — if you think you need it, say why and do Y instead" gets followed.
- **Name the failure it prevents.** `blast-radius` earns its length because it names the red deploy it exists to stop. An instruction whose cost is visible and whose benefit is not will erode.
- **Write the trap, not the happy path.** The agent will find the happy path. It will not find that a stale `packages/shared/dist` makes new exports read as `undefined` while typecheck stays green.

## Before you add anything

Three questions, in order:

1. **Does an existing document own this concept?** Add it there. A second home for one concept is how the two drift.
2. **Does it apply to every change, or to one kind?** Every change → `CLAUDE.md`. One kind → a skill.
3. **Can the pointer be sharpened instead?** If the material already exists and is not being reached, the pointer is the bug. Fix that first.

# Claude Code — Character Edit Refactor

Implement this package against the CURRENT Book Nest working tree.

Read once, in this order:

1. `00-FINAL-PRODUCT-CONTRACT.md` — final product/UI source of truth.
2. `01-IMPLEMENTATION-MAP.md` — exact file ownership and execution plan.
3. `02-TESTS-AND-ACCEPTANCE.md` — verification contract.
4. `03-CURRENT-DEV-ANCHORS.md` — inspected reference facts; verify before relying on them.

Execution rules:

- Start with `git status`; inspect the current files/usages/scripts before editing.
- Preserve all local/user changes. Never `reset`, `clean`, `stash`, or checkout over them.
- Treat the current working tree as implementation truth; adapt code details, not the product decisions.
- Keep the diff narrow: frontend Character Edit presentation/layout only.
- No backend/API/schema/domain changes, no codegen, no new dependencies, no unrelated cleanup.
- Reuse existing Book Nest primitives before creating anything new, especially `ActionRow`, `Separator`, `Badge`, `UiIcon`, current Character form fields and `CharacterCard`.
- Do NOT refactor Book Form or create project-wide shared form abstractions solely for this task.
- Implement the Character files in one coordinated pass to avoid repeatedly redesigning the same source file.
- Do not ask product questions already answered by this package.
- Run focused tests while working and final repo-required web checks once at the end using scripts from the CURRENT `package.json`.

When finished, report only:

- changed files
- key implementation notes
- exact commands/tests run and results
- any unavoidable deviation from this contract

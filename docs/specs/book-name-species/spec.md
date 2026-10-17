> Source: D:/IT/book-docs/new/4__BOOK_NEST_BOOK_NAME_SPECIES_CLAUDE_CODE_OPTIMIZED_v2/book-nest-character-book-fields-claude-code-v2/{00_START_HERE,01_TASK,02_TEST_MATRIX}.md, copied 2026-10-17.
> Scope: book-context name and species fields in CharacterBasicsSection only.

# Book Nest — book-specific name + species, Claude Code v2

**Goal:** Implement ONLY the approved UX refactor of `book.displayName` («Ім’я в цій книзі») and `book.speciesOverride` («Вид у цій книзі») in the character edit form. Everything else stays unchanged.

**Repository:** `Srh-Yakovenko-ua/book-nest` · reference `dev` HEAD `60c67d457e4bf9c6bd6a6deea12fe64cea81a26e` (checked 2026-10-17). **Your CURRENT worktree/branch is authoritative.** Do not change worktrees, checkout/reset/stash, override unrelated edits, or auto-commit.

## Paste into Claude Code, with the ZIP extracted

```text
Implement the Book Nest book-specific NAME + SPECIES UI refactor from this package.

Read 00_START_HERE.md, then 01_TASK.md (binding decisions + state machine), then 02_TEST_MATRIX.md (existing-test mapping + acceptance). Work in the CURRENT worktree and inspect git status/HEAD before editing. Compare the reference dev code map with actual files, but do not browse the whole repository or dump huge source/test files unless necessary.

Execute phases A–D in 01_TASK.md end-to-end without routine approval pauses. Change ONLY the two book-specific fields. Preserve all existing backend/API/shared contracts, global fields, unrelated form UI, spoiler protections, and species catalog functionality. Reuse existing Book Nest components; make a minimal, maintainable diff. Keep shared-component behavior backward compatible (opt-in adaptation if needed).

Important: an inherited field's temporary editor must not make form dirty merely by opening; real edits must integrate with React Hook Form and form-level Save/unsaved-change guard; cancel reverts only the pending session. Preserve already-saved explicit overrides even if they equal global data. Species identity uses ID, never display label. No masked data leaks through tooltips.

Use the existing tests named in 02_TEST_MATRIX.md first, update obsolete UI expectations without weakening payload/spoiler tests, and add only uncovered test cases. Run focused unit tests, web typecheck, scoped lint, and diff checks; rerun only failures as needed. Provide a concise final report: changes, files, test outcomes, unresolved issues. If an actual worktree conflict or contract contradiction blocks safe implementation, stop and give the exact blocker and minimal solution; otherwise complete the task.
```

**Files in package:** `01_TASK.md` (implementation contract), `02_TEST_MATRIX.md` (targeted regression tests). This is instructions-only: no stale code snapshots, no third-party dependencies, no hidden instructions. No separate phase-by-phase Claude sessions are required.

---

# Book Nest v2 — implementation contract

## A. Scope, invariants, agreed decisions

Only the book-context controls for `book.displayName` and `book.speciesOverride` within `CharacterBasicsSection`. Keep their current section/header. **Do not touch** importance, status, roles/chips, global name/species, aliases, attitude, right sidebar, other sections, spoiler UI, API/backend/schema/DB, or global styles. No new modal dialogs, new dependencies, or global refactor. Keep existing `React Hook Form`, live preview, i18n (`uk`/`en`), Save/Cancel, dirty guard, validation, permissions and server masking.

| #   | Locked approval | Acceptance                                                                                                                                                            |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 1A              | Same bordered 40px-scale value area for inherited preview and editable control; stable width/layout.                                                                  |
| 2   | 2A              | Enter temporary editor without writing main value to RHF; only meaningful edits update book form; existing form Save persists.                                        |
| 3   | 3A              | Neutral inline source label/icon beside caption: «Основне» / «Редагування» / «Для книги»; compact actions; remove duplicate explanatory rows for ONLY these fields.   |
| 4   | 4A              | The two fields share one responsive two-column grid; stack when _actual form content width_ is insufficient.                                                          |
| 5   | 5A              | Do not create a NEW redundant book-name override if it matches main name after CURRENT contract's normalization. Preserve stored explicit overrides even if equal.    |
| 6   | 6A              | Inline existing `SpeciesPicker`; no new modal. Empty global species = «Не вказано». Book value changes only after selection; preserve catalog/own-species management. |
| 7   | 7A              | Return-to-main immediately resets book override in form, without confirmation or server write; form Save persists.                                                    |
| 8   | 8A              | One-line ellipsis for view-only values; accessible full-value tooltip for authorized viewers; inputs/picker retain complete data.                                     |
| 9   | 9A              | No new spoiler badges/eyes/toggles. Respect existing masking, reveal, flag and payload behavior; tooltips never disclose masked values.                               |

Current labels are translated via `characters.edit.displayName` and `characters.edit.speciesInBook`; do not rename all form labels. Localize only newly required compact source/action strings in existing `uk.json` and `en.json`, reusing existing keys if fit.

## B. Explicit behavior/state machine (avoids ambiguous draft lifecycles)

**Sources:** Form state: `bookValue: null | value`, `bookSpoilerFlag`, current main value. UI-only session state: `startedFromInherited`, `draftText` for name, `inTransientEditor`. Data shape does **not** change. `null` always means INHERIT (not a separate 'explicitly empty' choice).

| Current state / event                                                 | Visible UI                                                                                                                                                                                                            | RHF update / outcome                                                                                                                                                                         |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I** inherited (`bookValue === null`, no session)                    | Readonly bordered preview of current main value or «Не вказано», source `Основне`; action «Змінити/Вказати для книги».                                                                                                | No update. Main-value edits remain live in preview.                                                                                                                                          |
| I → **D**: click action                                               | Focus book `Input` or existing `SpeciesPicker`, source `Редагування`, action `Скасувати редагування`. Prepopulate displayed main value; if no main species show empty search.                                         | Snapshot current book value + flag locally, **do not call `field.onChange`** yet. Save remains as before.                                                                                    |
| D name: type meaningful DIFFERENT text                                | Keep input mounted and editable; source becomes `Для книги` once RHF book value is explicit. While session remains open, `Скасувати редагування` is still available.                                                  | Update RHF with text so normal dirty guard, Save and live preview function; no per-field persistence.                                                                                        |
| D name: clear/whitespace/same-as-main                                 | Keep draft input mounted during editing; source `Редагування`.                                                                                                                                                        | Keep `book.displayName = null`, no new override. This must not unmount input or lose focus during intermediate keystrokes.                                                                   |
| D name: click explicit Cancel or press Escape                         | Restore snapshotted book value/flag; show inherited view; focus initiating action when feasible.                                                                                                                      | No residual RHF change; no server write. Escape MUST NOT submit the form.                                                                                                                    |
| D name: focus leaves editor/action group                              | End the temporary session: if meaningful override, transition to directly editable **O**; otherwise **I**.                                                                                                            | Keep actual RHF value/flag. This is not a separate save; blur must not discard a meaningful edit. Clicking Cancel must win over blur (do not commit before Cancel).                          |
| D species: choose distinct option                                     | End temporary session; existing picker stays editable as O; source `Для книги`, action `Повернути основне`.                                                                                                           | Set `book.speciesOverride` to selection; normal form dirty.                                                                                                                                  |
| D species: choose current main ID or clear                            | Return to I.                                                                                                                                                                                                          | `book.speciesOverride` remains `null`; no redundant override.                                                                                                                                |
| D species: search, close popup, Tab away or Escape (without choosing) | No change in stored form. Keep harmless D with explicit Cancel if the existing picker cannot safely signal dismissal; optionally return to I on real focus exit. Do not invade popover internals just to detect this. | `book.speciesOverride` remains `null`; no PATCH/dirty. Escape first closes a _currently open_ `SpeciesPicker` popover (existing behavior); next Escape/Cancel may exit the transient editor. |
| **O** existing saved or new committed override                        | Existing `Input`/`SpeciesPicker` **directly editable**; source `Для книги`; action `Повернути основне`. No extra click-to-edit step for saved values.                                                                 | Keep standard RHF edits, errors, existing form-level Save/Cancel. Do not invent field-level Cancel for already saved O.                                                                      |
| O → I: click Return-to-main                                           | Current inherited preview replaces own value; label `Основне`.                                                                                                                                                        | `bookValue = null`; set corresponding book spoiler flag `false`. No modal, no immediate PATCH.                                                                                               |
| Form Save / global form Cancel / navigation                           | Existing form orchestration and protection only.                                                                                                                                                                      | Real book updates go via `toBookPatch`; discard restores baseline. Open temporary editor with NO changes must not create a false dirty guard.                                                |

**Important distinction:** a local `Скасувати редагування` belongs **only to a session entered from inherited I**, even if the user already typed a meaningful override during that session. After blur or species selection that commits the session, normal O has only its existing reset-to-main action. This avoids having two independent long-lived editors or a second Save flow.

**Name equality / normalization:** use the CURRENT book contract's `textOrNull()` semantics (trim leading/trailing whitespace and blank→null). For newly initiated overrides, compare `trim()`ed book text with `trim()`ed effective global name; **do not** introduce unapproved internal-whitespace collapse, case folding, accent removal, transliteration, or other business rules. Whitespace-only draft is empty/inherited; preserve intermediate typing. Pre-existing explicit override, even with an identical string, is retained until explicit reset; do not auto-normalize it out of state. Existing `CHARACTER_TEXT_MAX.shortText`, errors and `aria-invalid` remain.

**Species identity & dictionary changes:** compare **IDs** (`SpeciesSelection.id`) rather than visible/localized labels. On D, show the main selection visually in the picker if present while RHF value stays `null`; selecting its ID is no-op. A persisted explicit book species retains its identity even if its ID matches global (do not silently clear). Keep `ManageOwnSpeciesButton` and `CharacterEditPage.applySpeciesChange` / `withSpeciesChange` behavior. Renaming must update labels without changing selected IDs; merging must remap matching IDs; deleting must clear matching selections and associated invalid spoiler flags, following existing implementation. If these events occur mid-transient editor, reconcile the local displayed selection against the latest props or close D, **never restore a stale/deleted value**. A dictionary create/rename/merge/delete may have independent server side effects; field Cancel and general form Cancel only affect CHARACTER FORM changes, and must NOT claim to undo an already completed dictionary operation. No rewrite of the dictionary system.

**Spoiler/permission invariants:** Keep `MaskedOr`, `CharacterSpoilerField`, `maskedEditFields`, `hasSpoilerValue`, `withoutEmptySpoilerFlags`, `withoutMasked`, and existing separate flags. Masked fields must not be editable or reveal data via DOM/tooltip/aria/preview. Opening D must not toggle flags. For a meaningful edit of explicit non-empty value, preserve its flag. Clearing or resetting an explicit value clears its flag (existing onChange behavior), and the existing spoiler switch is disabled when there is no explicit book value. Do not set inherited main values as book-specific spoilers. Update book payload only through existing form Save; saving another field may not overwrite masked data.

## C. Visual/layout guardrails

- **Stable control, not fixed whole-card height:** inherited bordered preview and active input/picker target ~`h-10`; no unneeded `min-height`/empty gap just to equalize the entire field block. Existing `ManageOwnSpeciesButton`, validation messages and wrapping action lines may legitimately make columns different total heights. Maintain readable spacing; no overlap or horizontal overflow.
- **Responsive to form content width, not only viewport width:** the edit form has a desktop right sidebar. First inspect the existing layout utilities. If `sm:grid-cols-2` is too narrow in the actual available column, use **locally scoped container queries** or an equivalent minimal adaptive solution. Keep two equal `minmax(0,1fr)` columns when room, one when not. Do not introduce global breakpoints/CSS changes; test narrow content even on wide viewport.
- **View-only truncation:** one line/ellipsis in inherited preview only; preserve full content in editable `Input`/`SpeciesPicker`. Accessible tooltip on keyboard focus and mobile/touch via existing primitives; provide an accessible route to full value only when authorized and only when text is truncated if feasible. No `title`, hidden text, aria-label, or tooltip with a masked secret. Avoid turning read-only display into misleading editable control.
- **Action and source placement:** source marker in caption row (`Основне`, `Редагування`, `Для книги`), small neutral icon, action below the bordered region. No vibrant chips/extra explanatory hints for these two fields. Layout may wrap labels/actions naturally on narrow widths.
- **Focus:** focus newly opened editor, preserve normal tab order, no form submission on Escape/Enter from transient name editor. `SpeciesPicker` owns its internal Popover/keyboard behavior; avoid triggering Cancel on its internal popover interactions.

## D. Targeted code map (reference commit; always confirm actual worktree)

**Likely edit surface:**

1. `apps/web/src/features/characters/components/character-edit-sections.tsx` — `CharacterBasicsSection`: wrap JUST the two book-field `MaskedOr`/`Controller` blocks in one responsive grid; preserve importance/status/roles siblings.
2. `apps/web/src/features/characters/components/character-inherited-field.tsx` — `InheritedFieldShell`, `InheritanceAction`, `InheritedTextField`, `InheritedTextPreview` (also used by `InheritedSelectField`, which MUST retain existing appearance and behavior). Use optional scoped mode/tiny wrapper if needed.
3. `apps/web/src/features/characters/components/character-inherited-species-field.tsx` — replace premature `onChange(globalValue)`, retain existing `SpeciesPicker` and own-species manage action.
4. `apps/web/src/messages/uk.json`, `apps/web/src/messages/en.json` — small book-fields-only strings if needed.

**Read/reuse; do NOT change without demonstrated necessity:**

- `apps/web/src/features/species/components/species-picker.tsx`, `manage-own-species-button.tsx`, `model/own-species-change.ts`.
- `apps/web/src/features/characters/components/character-edit-page.tsx` — `isScopeDirty`, `applySpeciesChange`, form Save/discard; no new Save hook.
- `apps/web/src/features/characters/model/character-edit-form.ts` — `textOrNull`, `toBookPatch`, `isScopeDirty`, `withSpeciesChange`.
- `apps/web/src/features/characters/model/character-inheritance.ts` — `resolveInherited`, `isBookFieldMasked`.
- `apps/web/src/features/characters/model/book-spoiler-flags.ts` — `hasSpoilerValue`, `withoutEmptySpoilerFlags`.

**Current known behavior (reference):** `InheritedTextField.onOverride` immediately writes `globalValue ?? ""`; `InheritedSpeciesField.onOverride` immediately writes `globalValue`, using `isSpecifying` when main species absent. Existing tests assert those older labels and immediate effects. Change the two-field UI without shifting existing contracts or hiding test failures.

**Existing target tests (named, not guessed):**

- `apps/web/src/features/characters/components/character-edit-page.test.tsx` — inheritance, form scope orchestration, preview, spoilers, masked, validation.
- `apps/web/src/features/characters/model/character-edit-form.test.ts` — inheritance/scope/patch semantics.
- `apps/web/src/features/species/components/species-picker.test.tsx` — catalog, search, keyboard and picker creation.

## E. Four phases, optimized for Claude Code

**Phase A — read-only preflight:** inspect `git status --short`, branch/HEAD, changes from reference, and only target source/test regions (`rg -n`, `sed -n`; do not dump 3,800-line test files). Inspect existing inherited component consumers and `uk`/`en` labels. If target files have conflicting user edits, stop with exact conflict; otherwise proceed. No checkout/reset/stash/commits.

**Phase B — minimal implementation:** implement the two-field responsive layout, scoped inherited UI variant, state transitions, name and species comparison, accessibility and i18n. Preserve existing direct editing of O, existing permissions/spoilers, custom-species management and normal form Save. Prefer minimal code and no new generic form abstractions.

**Phase C — focused tests:** start with the named existing tests. Categorize matrix cases as covered / existing needs update / missing, then update selectors and add only truly missing cases. Prefer extending the current `CharacterEditPage` integration tests (reuse fixtures and API mocks) over new test infrastructure. Keep assertions for payload/masking/dirty semantics. Never delete tests to silence failures.

**Phase D — verify/diff audit:** run targeted Vitest tests, `@app/web` typecheck, scoped ESLint/Prettier checks for changed files, and `git diff --check`. If a focused test fails, fix and rerun affected scope; run full suite only if cross-component changes warrant it. Finish by inspecting the diff for changes outside the two fields and report outcomes; if commands unavailable, report NOT RUN accurately.

## F. Definition of done

All nine approvals implemented; no extra UI or backend scope; inherited no-op and Cancel do not affect dirty/payload; distinct edits sync with live preview/Save; saved O editable; reset/flag behavior correct; species catalog changes safe; masked secrets never leak; accessible responsive display; focused tests/quality checks pass or explicitly blocked. Final response concise: modified files, key behavior, commands + PASS/FAIL/NOT RUN, any risks.

---

# Book Nest v2 — test & regression plan (reuse before adding)

## A. Test strategy (avoid duplicate fixtures, test runs, token waste)

Use the test files already in `dev`:

- `apps/web/src/features/characters/components/character-edit-page.test.tsx` (long integration test — use `rg -n 'describe\("CharacterEditPage inheritance|live preview|spoiler switches'` and inspect relevant ranges, **not the whole file**).
- `apps/web/src/features/characters/model/character-edit-form.test.ts` (payload, `isScopeDirty`, `resolveInherited`, `withoutMasked`).
- `apps/web/src/features/species/components/species-picker.test.tsx` (search, select, create, keyboard).

**Before writing tests**, label each acceptance scenario C (covered), U (existing test must update because wording/structure changed), M (missing) and add new assertions only for M. Existing test names and mapping below are VERIFIED against reference `dev`; when running in another worktree, re-check them with `rg -n`. Avoid creating a separate duplicate test suite unless the existing file cannot feasibly cover the case.

**Update, never weaken:** Existing inheritance test `shows the effective global value while the book value is inherited` asserts old hint and action strings. Update only those UI expectations. Keep tests `prefills the book value from the global one and sends it on save` and `writes no book value when the field is reset to the global one` (adapting interactions as needed). Preserve live preview `shows the book display name once it is overridden`, `falls back to the global name while the overridden display name is blank`, `returns to the global name when the display name is reset`; maintain book-only PATCH checks. Keep mask/spoiler tests, form scope tests, and species-picker tests.

## B. Acceptance matrix (28 scenarios, priority ordered)

**Column Initial = initial coverage estimate, NOT a verified passing test**: U means existing assertions/interactions need editing; C means current test partly covers the semantic; M means add minimal new coverage. Recheck actual branch; multiple scenarios can be covered in a single well-written test.

| ID  | Priority | Initial | Acceptance scenario / expected contract                                                                                                    |
| --- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| N01 | P0       | M       | Inherited name: open/close/Cancel without edits; `book.displayName` stays null, Save unchanged/disabled, no PATCH.                         |
| N02 | P0       | U       | New meaningful book name: live preview updates, book-only PATCH after Save, no global PATCH.                                               |
| N03 | P0       | M       | New book name equal to main under **trim-only** comparison, or whitespace-only: no book override, no false dirty.                          |
| N04 | P0       | M       | Typing different then reverting to inherited before exiting editor: still typeable, RHF returns null, no PATCH.                            |
| N05 | P0       | M       | Pre-existing explicit book name equal to main: retained and directly editable until explicit reset; no silent auto-clear.                  |
| N06 | P0       | C       | Saved book name edit; general discard restores baseline book name/flag (do not change discard guard).                                      |
| N07 | P0       | C       | Reset saved book name: local null + spoiler false; PATCH `displayName:null` only after Save, not immediately.                              |
| S01 | P0       | M       | Main species missing: no selection, picker open/search/cancel => `book.speciesOverride` remains null and no book PATCH.                    |
| S02 | P0       | M       | Main species exists: opening species editor without selection does not copy global ID to book RHF.                                         |
| S03 | P0       | C       | Pick distinct standard/own species: stored by ID; normal Save makes book-only `speciesOverrideId` PATCH.                                   |
| S04 | P0       | M       | Pick same species ID as global when entering from inherited (regardless of label/locale): stays inherited.                                 |
| S05 | P0       | C       | Reset saved book species: form value null, spoiler false; Save sends `speciesOverrideId:null`.                                             |
| P01 | P0       | C       | API-masked book name/species: no plaintext/tooltip/preview/aria leak; unrelated Save omits masked values/flags.                            |
| P02 | P0       | C       | Edit nonempty explicit book value with spoiler flag: retain flag; no extra spoiler toggle added.                                           |
| P03 | P0       | C       | Reset/clear to null: flag false, existing spoiler switch disabled/off for empty book override.                                             |
| F01 | P0       | C       | Dirty real edit triggers leave guard; form-level discard restores all, but unopened/no-op editor is clean.                                 |
| F02 | P0       | C       | Existing mixed global/book Save and failed-scope retry sequence remains unchanged.                                                         |
| R01 | P0       | C       | Importance, status, roles, aliases, attitude and unrelated `InheritedSelectField` remain unaffected.                                       |
| S06 | P1       | C       | Existing picker mouse/keyboard, search, clear, API errors/retry behavior remain intact.                                                    |
| S07 | P1       | M       | Rename/merge/delete selected own species including during transient editor: IDs/labels/flags synced; no stale restore.                     |
| S08 | P1       | C       | Species creation still works independently; assignment into character waits for general Save.                                              |
| P04 | P1       | C       | New explicit book name/species makes existing spoiler switch usable and saved by existing form.                                            |
| F03 | P1       | C       | Editing main name/species while book is inherited updates effective preview without book PATCH.                                            |
| F04 | P1       | C       | Global-only character edit: no book group and no UI/payload changes.                                                                       |
| F05 | P1       | C       | Book-name max length and error (`aria-invalid`); species picker max search length and keyboard focus preserved.                            |
| U01 | P1       | M       | Narrow real form content (incl right sidebar) stacks book fields; adequate width shows 2 columns; no horizontal overflow.                  |
| U02 | P1       | M       | Long authorized inherited previews show ellipsis + keyboard/touch full-value; input keeps full value; masked tooltip absent.               |
| U03 | P1       | M       | Focus after opening editor, Tab/blur lifecycle, Cancel button wins vs blur, Escape works without unwanted submit/popover close regression. |

**Totals:** 28 scenarios (18 P0 + 10 P1); initial C/U/M labels are preliminary source-to-test mappings, not a claim that the new UX has already passed.

## C. What to check before changing existing tests

- `CharacterEditPage inheritance`: `shows the effective global value while the book value is inherited` (UI wording change), `prefills the book value from the global one and sends it on save` (preserve book-only payload), `writes no book value when the field is reset to the global one` (preserve null semantics).
- `CharacterEditPage scope orchestration`: `keeps save disabled until something actually changes`, `sends only the book update when only a book field changed`, `sends both updates when both scopes changed`, `keeps the failed scope dirty and does not resend the saved one on retry`.
- `CharacterEditPage live preview`: `follows the global name as it is typed, before saving`, `shows the book display name once it is overridden`, `falls back to the global name while the overridden display name is blank`, `returns to the global name when the display name is reset`.
- `CharacterEditPage spoilers` and `CharacterEditPage spoiler switches follow their values`: preserve mask/flag behavior; tests about unrelated spoiler controls should not be rewritten.
- `character-edit-form.test.ts`: inheritance null mapping, blank-string normalization, masked omission, `isScopeDirty`, resetting species, validation; **do not change model contracts to make a UI test pass**.
- `species-picker.test.tsx`: do not reimplement picker functionality; run the existing suite unchanged if possible.

## D. Efficient command order (repo root; update paths if branch structure changed)

```bash
# Identify existing tests and targeted blocks BEFORE reading entire files:
rg -n 'CharacterEditPage inheritance|CharacterEditPage live preview|spoiler switches follow their values' apps/web/src/features/characters/components/character-edit-page.test.tsx

# First run focused baseline/regression tests after implementing a coherent change:
pnpm --filter @app/web exec vitest --project unit run \
  src/features/characters/components/character-edit-page.test.tsx \
  src/features/characters/model/character-edit-form.test.ts \
  src/features/species/components/species-picker.test.tsx

# Once at end; rerun only failing suites after fixes:
pnpm --filter @app/web typecheck
pnpm exec eslint <changed-ts-tsx-paths>
pnpm exec prettier --check <changed-files>  # if repo supports these file types

git diff --check
git diff --stat
git status --short
```

Run targeted suites once per coherent stage, not every microedit. Widen scope of tests only for changed shared logic. If one test fails due to old text, update expectation and retain assertions about data/permissions. If a command fails for environment reasons, mark **NOT RUN / BLOCKED** with real output; do not claim a green suite.

## E. Finish report (brief, mandatory)

1. Outcome: implemented ONLY name + species in book context, approved decisions #1–9, important behavior notes.
2. Files changed + why (small diff; indicate any non-target file and its justification).
3. Verification: actual commands, PASS/FAIL/NOT RUN, coverage of P0 scenarios, any skips.
4. Remaining risks / branch or environment caveats. Do not auto-commit or publish.

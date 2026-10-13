# 03 — Current Dev Anchors (reference, verify first)

These facts were inspected on `dev` at commit:
`472072ad158ccc3fb3107c2bf06a169e9e39e7e6`

The working tree may be newer. Verify before relying on a detail; never force code back to this commit.

---

## Current Edit Book reference

`apps/web/src/app/[locale]/(app)/books/[id]/edit/page.tsx` currently uses:

- `max-w-7xl`
- `px-5 pt-8 pb-16 md:px-8 lg:px-12`
- animated header
- `/illustrations/pen.png`
- H1 scale `clamp(1.875rem,4vw,2.75rem)`

This is the canonical header reference for Character Edit.

Current Book Form uses:
`grid gap-6 pb-24 sm:pb-0 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start`

Its sidebar is:

- `flex flex-col gap-6`
- sticky with `lg:top-[calc(var(--shell-header-height)+theme(spacing.4))]`

Its action bar currently uses:

- mobile `fixed inset-x-0 bottom-0`
- `safe-bottom`
- translucent background / backdrop blur
- `sm:sticky`
- full-width mobile buttons and compact desktop buttons

Match this pattern locally in Character Edit; do not refactor Book Form to share it.

---

## Project form-section pattern

Current project does NOT use one universal shared FormSection:

- Books has `features/books/components/form-section.tsx`
- Timeline has `features/timeline/components/timeline-form-section.tsx`

Both use a similar visual language but feature-specific behavior.

Therefore this task should evolve the existing Character-local section shell to the same visual tokens rather than create a new project-wide abstraction solely for Character Edit.

Book FormSection visual anchors:

- `rounded-xl border border-border bg-card`
- `p-5 md:p-6`
- `shadow-detail-block`
- 36px accent icon tile
- title/description/action header

---

## Existing reusable boolean-row primitive

`apps/web/src/components/ui/action-row.tsx` already supports:

- `title`
- optional `subtitle`
- optional leading icon
- `trailing`
- a callback form of `trailing(labelId)` suitable for accessible switch labelling
- existing focus/interaction styling

Reuse it for POV and spoiler boolean rows instead of creating a new component.

`ActionList` exists too, but avoid placing a heavy ActionList card inside a FormSection when simple `ActionRow` + `Separator` composition is enough.

---

## Character Edit observed state

Current Character Edit:

- route shell: `max-w-4xl`
- heading smaller than Edit Book
- form: single-column `flex flex-col gap-6`
- section order: Main -> Narrative -> Inheritance -> Global -> Aliases -> Spoilers
- Character-local sticky action bar
- skeleton: two generic full-width cards
- a missing appearance for a provided `bookId` currently falls back toward global-style editing

Do NOT change that route/context behavior in this visual refactor.

---

## Current Character form model already supports required data

`CharacterEditValues` already includes:

- global name/entityKind/gender/customGender/species/pronouns/attitude/neutralDescription/aliases
- book importance/status/statusCustomText/roles/description/appearanceNotes/personalImpression
- POV/narrator/first appearance
- inherited overrides: displayName/speciesOverride/attitude/portraitMediaId
- spoiler booleans

Therefore the visual refactor should not require model/API expansion.

---

## Existing inheritance/image building blocks

Character code already has:

- `InheritedTextField`
- `InheritedSelectField`
- `InheritedImageField`
- inheritance action logic
- `CharacterImageField`
- media upload/normalization flow

Current inherited fields are individually wrapped in bordered rounded cards.
Current image composition can duplicate labels.
Fix presentation; do not rewrite state/upload semantics.

---

## Existing CharacterCard presentation

`apps/web/src/components/ui/character-card.tsx` already provides reusable:

- avatar
- name
- role badge
- traits

`features/characters/components/character-card.tsx` already maps contextual roster data using:

- `explicitImportance`
- `explicitStatus`
- `BOOK_CHARACTER_IMPORTANCE.badgeVariant`
- status/POV traits

Reuse the same mapping ideas in Character Edit preview rather than inventing a second visual interpretation.

The primitive itself contains hover lift/shadow intended for catalog cards. Neutralize that locally in the preview; do not alter the primitive globally.

---

## Existing tests already cover substantial behavior

`character-edit-page.test.tsx` already covers:

- dirty/save scope orchestration
- partial failure/retry
- discard dialog
- no-book global mode
- inheritance override/reset
- aliases
- POV/narrator
- first appearance validation
- spoiler collapse/independence

`character-edit-form.test.ts` already covers:

- inheritance payloads
- masked fields
- scope dirty behavior
- first appearance
- POV
- global update mapping

Preserve these tests; extend only where the redesign adds presentation behavior.

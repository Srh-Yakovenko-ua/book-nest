# 00 — FINAL Product Contract

This file is the only product/UI source of truth for this task. If another file appears to conflict with it, follow this file.

## Goal

Make Character Edit visually and structurally belong to the same Book Nest entity-edit language as Edit Book while preserving all current Character/BookCharacter behavior.

This is a narrow frontend presentation/layout refactor.

---

## 1. Page shell and header

Match the CURRENT Edit Book page shell:

- `max-w-7xl`
- same responsive horizontal padding and top/bottom rhythm
- same heading scale
- same restrained entrance motion
- stable translated H1 equivalent to `Редагування персонажа`; do NOT append the character name

### Header visual

Reuse the same existing illustration currently used by Edit Book:
`/illustrations/pen.png`

Use the same `Image` presentation pattern as Edit Book rather than inventing a new Character illustration or replacing it with an icon tile.

Do not add a new image/icon dependency.

---

## 2. Desktop composition

Use the same layout pattern as current Book Form:

`grid gap-6 pb-24 sm:pb-0 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start`

Right sidebar:

- `flex flex-col gap-6`
- sticky below the app shell header with the same offset pattern as Book Form

### Book-context main section order

1. `У цій книзі`
2. `Роль у розповіді`
3. `Про персонажа`
4. `Лише для цієї книги`
5. `Інші імена`
6. `Спойлери`

### Global edit

Render only:

1. `Про персонажа`
2. `Інші імена`

### Sidebar

Book context:

1. Portrait panel
2. Live preview

Global edit:

1. Live preview only

Do not add filler/read-only sidebar blocks.

---

## 3. Mobile order

Book context:
Header -> Portrait -> main sections -> Preview -> fixed bottom action bar.

Use one instance of each UI block. Solve desktop/mobile placement with DOM/layout/order classes, not duplicated rendering.

The final content must remain reachable above the fixed action bar.

---

## 4. Follow the project’s current component pattern

Do NOT create a new project-wide `FormSection` or `FormActionBar` abstraction solely for this refactor.

Current Book Nest already uses feature-level form-section compositions (for example Books and Timeline), so keep this task feature-local unless the CURRENT working tree already contains a suitable shared primitive.

### Character section shell

Evolve the current Character-local `EditSection` (or a narrowly scoped Character equivalent) to visually match Book `FormSection`:

- `rounded-xl border border-border bg-card`
- `p-5 md:p-6`
- `shadow-detail-block`
- 36px accent icon tile
- title + optional description
- optional right-side action/scope badge

Do not import a generic UI shell from `features/books`.
Do not modify Book Form merely to share classes.

### Action bar

Keep the Character action bar feature-local, but match the CURRENT Book Form responsive pattern:

- mobile: fixed bottom + safe-area handling
- `sm+`: sticky
- translucent background / backdrop blur
- full-width mobile buttons, compact desktop buttons

Preserve Character-specific dirty/save/cancel behavior.

---

## 5. Reuse existing `ActionRow` for boolean settings

For boolean settings with title/helper + trailing switch, reuse:
`apps/web/src/components/ui/action-row.tsx`

Preferred usage pattern:

- title
- subtitle/helper
- `trailing={(labelId) => <Switch aria-labelledby={labelId} ... />}` or equivalent accessible wiring

Use it for:

- POV setting
- `hidePresenceAsSpoiler`
- granular spoiler switch rows where appropriate

Inside a FormSection, use `ActionRow` + subtle `Separator` rows rather than wrapping another heavy `ActionList` card inside the section.

Do not build a second custom boolean-row component.

---

## 6. Section contracts

### 6.1 `У цій книзі` — scope `Ця книга`

- importance + status: 2 columns at `sm+`
- custom status: conditional full-width field directly below
- roles: full-width; reuse current `CharacterRolePicker`
- full-width textareas in this final order:
  1. book description
  2. appearance notes
  3. personal impression
- no nested section cards
- no completion badge

### 6.2 `Роль у розповіді` — scope `Ця книга`

- POV = existing `ActionRow` + trailing Switch
- narrator type immediately below only while POV is enabled
- preserve current clearable Select behavior
- lightweight internal heading for first appearance
- chapter + page: 2 columns at `sm+`
- first-appearance note: current full-width Input
- preserve current validation and field types

### 6.3 `Про персонажа` — scope `Усі книги`

- global name full-width + current validation
- entity kind + gender: 2 columns
- custom gender: conditional full-width
- species + pronouns: 2 columns
- global attitude: full-width
- global/neutral description: full-width
- no warning/nested scope card

### 6.4 `Лише для цієї книги` — scope `Ця книга`

Only book overrides of global values:

- displayName
- speciesOverride
- attitude

Portrait is NOT in this main section.

Preserve existing inheritance semantics:

- `null = inherit global`
- current masked-field behavior
- current override/reset logic

Reuse:

- `InheritedTextField`
- `InheritedSelectField`
- existing inheritance action logic

Presentation:

- compact rows with subtle separators
- no rounded card around every inherited field
- preserve `data-slot="inherited-field"`

### 6.5 `Інші імена`

One Character section; no overall scope badge because it mixes scopes.

- global alias group
- subtle separator
- book alias group only in book context

Reuse current `CharacterAliasGroup` behavior:

- add/remove
- type
- spoiler
- advanced state
- validation

Per-alias-row borders may remain because each row is a discrete editable item.

### 6.6 `Спойлери` — scope `Ця книга`

Preserve current spoiler model and flags.

- `hidePresenceAsSpoiler` first, using `ActionRow`
- granular flags remain collapsible
- use current `activeCount` in disclosure UI
- expanded granular flags use compact `ActionRow`/separator rows, not individual cards
- do NOT disable granular flags when hide-presence is on
- do NOT invent spoiler flags for POV or first appearance

---

## 7. Portrait panel

Book-context only.

Current Character Edit supports book `portraitMediaId` but does not edit the global avatar. Do not add global-avatar editing.

Reuse:

- `CharacterImageField`
- existing upload mutation
- file type/size validation
- image normalization
- current avatar/portrait data

Inherited state:

- show effective global avatar/fallback
- explain that the main image is used
- action equivalent to `Змінити для цієї книги`

Override state:

- show book portrait
- allow replace
- allow reset to main/global image

Remove duplicated portrait labels.

A minimal `CharacterImageField` API adjustment is allowed for:

- hiding its internal label when the panel already supplies one
- exposing transient preview URL changes to the parent
- correctly restoring the effective global preview after reset

Do not duplicate upload logic or add server state.

---

## 8. Live Character preview

Create a Character-specific preview component and reuse:
`apps/web/src/components/ui/character-card.tsx`

Do NOT hand-copy Character card styles and do NOT use the feature roster card with its favorite/menu/navigation behavior.

Preview must not include:

- favorite action
- kebab menu
- unlink action
- navigation overlay

### Effective contextual values

- name = `book.displayName ?? global.name`
- image = transient uploaded book preview -> saved book portrait -> global avatar fallback
- importance = current book importance
- status = current book status
- POV = current `book.isPovCharacter`

Use the same helpers/presentation mapping already used by the roster card where appropriate:

- `explicitImportance`
- `explicitStatus`
- `BOOK_CHARACTER_IMPORTANCE.badgeVariant`
- existing translations

### Global preview

- global name
- current global avatar
- no book-only importance/status/POV presentation

Use current React Hook Form values / `useWatch`; do not create a second domain state model.

### Non-interactive visual

The shared `CharacterCard` primitive currently has hover lift/shadow behavior intended for catalog cards. Neutralize that interactive hover treatment locally in the preview without changing the primitive globally.

---

## 9. Route/context semantics

Do NOT change missing-context behavior in this visual refactor.

Specifically:

- do not introduce a new contextual-unavailable branch
- do not change Character Details route semantics
- do not alter how a missing book appearance currently falls back

Any route/context correctness change should be a separate task because it is product behavior, not presentation.

---

## 10. Preserve all existing behavior

Do not change:

- global/book update separation
- partial-save retry behavior
- dirty detection
- validation/schema meaning
- inheritance meaning
- masked-field safety
- alias behavior
- spoiler behavior
- save mutation contracts
- backend/API/domain model
- route semantics

No new dependencies.
No codegen.
No Book/Timeline redesign.
No global Characters/Details/Add Character refactor.
No hardcoded new Ukrainian UI strings.

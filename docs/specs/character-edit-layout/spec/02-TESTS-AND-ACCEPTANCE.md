# 02 — Tests and Acceptance

## Preserve current behavioral guarantees

Do not weaken existing tests. The refactor must keep:

- clean form -> Save disabled
- global-only edit -> only global PATCH
- book-only edit -> only book PATCH
- both dirty -> both PATCHes
- partial success -> retry only failed scope
- dirty Cancel -> discard dialog
- global edit excludes book-only sections
- inherited value display / override / reset behavior
- masked fields cannot be wiped
- global/book aliases remain in their own payload scopes
- alias validation
- POV controls narrator visibility
- first-appearance page validation and free-form chapter
- granular spoilers remain independent from hide-presence

Do NOT add tests for new missing-context behavior; route semantics are intentionally unchanged in this task.

---

## Add only focused redesign coverage

### Render/mode contract

- contextual edit renders all six section headings in final semantic order
- global edit renders only `Про персонажа` + `Інші імена`
- contextual mode has Portrait + Preview
- global mode has Preview and no portrait editor

### Live preview

- inherited display name uses global name
- changing global name updates preview immediately
- book display-name override updates preview immediately
- resetting the override returns preview to global value
- contextual importance/status/POV are reflected where represented by the reused CharacterCard presentation
- transient uploaded/reset portrait updates preview before Save

### Settings/accessibility

- POV switch remains discoverable by accessible name when rendered through `ActionRow`
- hide-presence switch remains discoverable by accessible name
- granular spoiler switches remain functional after compact-row refactor

### Dirty/action contract

- Save remains disabled while effectively clean
- visual refactor does not alter save/cancel/discard behavior

---

## Test style

Keep semantic hooks such as:
`data-slot="inherited-field"`

Do NOT:

- snapshot the whole page
- assert Tailwind class strings
- assert `22rem`/pixel layout in jsdom
- test decorative icon counts
- duplicate model tests

`character-edit-form.test.ts` should remain essentially unchanged. Broad rewrites there indicate scope drift.

---

## Manual acceptance matrix

### Contextual desktop

- page shell/header visually matches current Edit Book
- same `/illustrations/pen.png` header treatment
- main column + sticky 22rem sidebar
- section order exactly:
  book -> narrative -> global -> overrides -> aliases -> spoilers
- sidebar: Portrait then Preview
- no per-field inheritance cards
- no duplicate portrait label
- preview does not look clickable/hover-lift like a catalog card
- action bar matches current Book Form responsive behavior

### Global desktop

- only global character + aliases sections
- Preview only in sidebar
- no portrait editor
- no empty book-context shells

### Contextual mobile

- Header -> Portrait -> main sections -> Preview -> fixed action bar
- no horizontal scroll
- final content remains reachable above the action bar
- buttons follow current Book Form mobile sizing pattern

### Accessibility

- logical keyboard order
- `ActionRow` switches have meaningful accessible names
- validation errors remain associated with fields
- icon-only actions remain labelled
- decorative section/header visuals do not create noisy screen-reader output

---

## Command strategy

Use actual current repository scripts; do not invent commands.

During work:

1. run focused Character Edit tests after the coordinated UI pass
2. rerun focused tests after translation/test adjustments

At final verification, once:

- relevant Character tests
- web typecheck
- web lint
- repository-required format/check command(s)

Report exact commands and outcomes.

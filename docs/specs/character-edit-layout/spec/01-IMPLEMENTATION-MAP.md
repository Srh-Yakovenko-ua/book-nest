# 01 — Implementation Map

Optimize for one coordinated Character pass and the smallest possible diff.

---

## Phase 0 — Preflight only

Before editing:

1. `git status`
2. note current branch/HEAD and local modifications
3. inspect current versions/usages of the files below
4. inspect current workspace scripts in `package.json`
5. search usages before deleting/changing `InheritedImageField` or component props

Do not modify code during broad discovery.

---

## Phase 1 — Character Edit coordinated UI pass

Primary files:

- `apps/web/src/app/[locale]/(app)/characters/[characterId]/edit/page.tsx`
- `apps/web/src/features/characters/components/character-edit-page.tsx`
- `apps/web/src/features/characters/components/character-edit-sections.tsx`
- `apps/web/src/features/characters/components/character-inherited-field.tsx`
- `apps/web/src/features/characters/components/character-image-field.tsx`
- `apps/web/src/features/characters/components/character-alias-group.tsx` only if a small composition change is genuinely needed

Allowed new Character feature components:

- `character-portrait-panel.tsx`
- `character-edit-preview.tsx`

Do NOT create shared Book/Character form infrastructure as part of this phase.

### Route page ownership

Only:

- page shell/header presentation
- reuse `/illustrations/pen.png` in the same style as current Edit Book
- preserve metadata behavior

### `character-edit-page.tsx` ownership

Owns:

- global vs contextual orchestration exactly as current behavior
- two-column desktop layout
- responsive block ordering
- final section ordering
- right sidebar composition
- current dirty/save/cancel flow
- Book-style responsive action-bar markup/classes
- transient portrait preview state
- layout-aware skeleton/error branch

Do NOT move detailed field markup here.
Do NOT add a new missing-context product branch.

### `character-edit-sections.tsx` ownership

Owns:

- upgraded Character-local section shell that matches current Book FormSection visual tokens
- all six form section compositions
- scope badges
- reuse of `ActionRow` for boolean rows
- reuse of `Separator` for compact grouped settings

Remove/replace the old visual `EditSection` implementation only within this Character feature; do not extract a project-wide component.

### `character-inherited-field.tsx` ownership

Preserve inheritance behavior and only simplify presentation:

- compact rows
- subtle separators supplied by parent/section as appropriate
- no per-field rounded card
- keep `data-slot="inherited-field"`

If `InheritedImageField` becomes unused after portrait extraction:

- search all usages
- remove it only if truly dead
  Otherwise narrow it to its remaining responsibility.

### `character-image-field.tsx` ownership

Keep upload/validation/normalization logic intact.

Only add the minimal API needed for:

- optional internal label display
- transient preview notification
- correct effective preview after reset/inheritance

Do not add a second upload flow.

### `character-portrait-panel.tsx`

Book-context presentation only:

- inherited vs overridden portrait
- CharacterImageField composition
- main/global fallback
- replace/reset actions
- no save mutation

### `character-edit-preview.tsx`

Pure presentation from supplied/current form values:

- reuse shared CharacterCard primitive
- use same importance/status helpers as roster where appropriate
- no mutations/actions/navigation
- neutralize hover lift/shadow locally

---

## Phase 2 — Copy + focused tests

Find existing locale namespaces/files first.
Add only translation keys required by the new layout/copy.

Update focused Character Edit tests after the UI implementation.

No Book Form regression work is required because Book files should not be modified by this task.

---

## Files normally NOT to edit

- `apps/web/src/features/books/**`
- `apps/web/src/features/timeline/**`
- `apps/web/src/features/characters/model/character-edit-form.ts`
- `apps/web/src/features/characters/model/character-edit-form.test.ts`

The current Character model already represents the required data.

If implementation appears to require changing model/API/Book files, first verify that the same result cannot be achieved in Character presentation/orchestration.

---

## Anti-overengineering checklist

- no project-wide `FormSection` extraction
- no project-wide `FormActionBar` extraction
- no duplicate boolean-row component: use `ActionRow`
- no duplicate upload flow
- no second RHF/form state for preview
- no Character -> Books component dependency
- no route semantics change
- no project-wide cleanup
- no new API calls/endpoints
- no codegen
- no new libraries

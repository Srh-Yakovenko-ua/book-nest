# Interaction and implementation guide

## Required click matrix

| Target                  | Required result                          | Must not happen             |
| ----------------------- | ---------------------------------------- | --------------------------- |
| ordinary card body      | navigate to contextual Character Details | no Favorite/menu action     |
| primary name            | navigate to contextual Character Details | no Favorite/menu action     |
| Favorite                | toggle global Favorite                   | no navigation               |
| `⋮` trigger             | open dropdown                            | no navigation               |
| `Редагувати`            | navigate to contextual edit route        | no details navigation first |
| `Прибрати з цієї книги` | open existing unlink confirmation        | no navigation               |

The interaction matrix is a hard contract.

## Recommended link architecture

Prefer the existing Book Nest stretched-link approach used by `BookCard` / `BookRow` rather than keeping a separate sibling overlay link.

Recommended shape:

1. card/primitive root is `relative`;
2. character name is the real semantic `Link`;
3. that link extends its hit area with `after:absolute after:inset-0` (or the current equivalent pattern in `dev`);
4. Favorite/menu action layer is `relative z-10` above the stretched link;
5. remove the current separate sibling full-card `absolute inset-0` link;
6. remove roster vertical transform/lift.

If current `dev` exposes a cleaner existing pattern with equivalent semantics, use it. The goal is robust DOM layering, not exact copy/paste of class names.

Do not solve this primarily with `stopPropagation()` or event-cancellation patches around every action.

## Shared `CharacterCard` primitive

Before editing `apps/web/src/components/ui/character-card.tsx`, inspect all current consumers.

If the primitive owns navigation or compact layout:

- keep it navigation-library agnostic;
- do not add book/character-domain knowledge (`bookId`, routes, importance enums, mutations);
- navigation remains optional;
- compact roster styling remains opt-in if defaults would alter another consumer;
- Character Edit preview remains non-clickable/action-free unless its caller explicitly opts in;
- existing preview visual behavior must remain compatible.

An `href` + `linkComponent`, a semantic name slot, or an equally small composition API is acceptable. Choose the narrowest API that fits current consumers.

## Long-name tooltip implementation

There is already a useful measurement reference in:

`apps/web/src/features/timeline/components/truncated-text.tsx`

Use its idea—real rendered overflow measurement + `ResizeObserver` + existing Tooltip primitives—as a **reference only**.

For a two-line clamp, actual overflow can be detected from rendered dimensions such as `scrollHeight > clientHeight`, with `scrollWidth > clientWidth` considered for pathological unbroken tokens if needed.

Requirements:

- tooltip exists only for actual overflow;
- it contains the full name;
- it re-measures on resize and text change;
- it does not cause layout shift;
- the hover/focus trigger should correspond to the visible name text, not the entire stretched card area.

Do **not** import `features/timeline/.../truncated-text.tsx` into Characters and do **not** refactor Timeline just to satisfy this task. Prefer a small roster/primitive-local helper unless current `dev` already has a generic shared solution.

## Expected change surface

Prefer a focused patch around:

- `apps/web/src/features/characters/components/character-card.tsx`
- `apps/web/src/components/ui/character-card.tsx` only if useful for clean composition
- `apps/web/src/features/characters/components/book-characters-tab.tsx`
- focused character tests and, if needed, one minimal browser/Storybook regression story/test

A small local helper for multiline overflow is acceptable. Backend/shared/generated-client changes are a red flag and should not be needed.

## Suggested implementation sequence

1. Re-read latest `dev` and identify every `ui/character-card.tsx` consumer.
2. Fix card/action link architecture first.
3. Apply compact roster-only visual hierarchy and remove roster lift.
4. Move hidden-fields indicator into metadata and show secondary global name only when different.
5. Add two-line clamp + actual-overflow tooltip.
6. Remove only the redundant total Characters summary chip.
7. Add/update regression coverage.
8. Run focused quality gates.

## Accessibility invariants

- character navigation remains a real link;
- Favorite remains a button with `aria-pressed`;
- menu trigger remains a button with its existing accessible label;
- no nested interactive controls;
- stretched-link focus treatment uses existing Book Nest focus tokens/patterns;
- visual clipping never replaces the full accessible character name.

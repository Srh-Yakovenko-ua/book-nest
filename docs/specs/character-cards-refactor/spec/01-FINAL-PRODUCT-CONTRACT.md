# Final product contract

This file defines **what the finished UI must do**. Implementation details in other files are recommendations unless marked required.

## 1. Tab structure

Keep the current two-column roster grid at its existing responsive breakpoint.

Keep the toolbar behavior and layout concept:

- search;
- sort;
- `+ Додати персонажа`.

In the contextual summary strip, remove only the redundant `Персонажів: N` chip because the Book Details tab label already exposes the same total count.

Keep:

- `Улюблених: N`;
- `POV: N`;
- hidden-record warning when applicable.

Do not make these chips interactive filters in this task.

## 2. Roster card anatomy

Use a compact hierarchy:

- left: avatar;
- center: primary display name, optional global name, one compact metadata group;
- top-right: Favorite and overflow menu only.

The content metadata group may include, when present:

1. importance;
2. POV;
3. status;
4. hidden-fields indicator.

The hidden-fields indicator is content metadata, not an action; move it out of the action cluster.

Unspecified importance/status remain omitted exactly as today.

## 3. Display-name semantics

Primary visible name remains:

`displayName ?? name`

If `displayName` exists and differs from global `name`, show the global name below it as muted secondary text. Do not duplicate the same value twice.

No backend/API change is needed because `CharacterSummaryView` already contains both values.

## 4. Long-name behavior

Primary name must:

- occupy at most **2 visual lines**;
- use safe word/token breaking so an extreme unbroken token cannot widen the card;
- never make one grid row arbitrarily tall;
- expose the full value via tooltip **only when the rendered text is actually clipped**;
- re-evaluate overflow when layout width or text changes;
- preserve the full accessible text/link name.

Do **not** decide tooltip visibility from a character-count heuristic such as `name.length > N`.

Secondary/global name is one muted line and may truncate. Add a tooltip for it only if the same small reusable mechanism naturally supports it; do not add extra complexity solely for the secondary line.

## 5. Card density

Roster cards should be visibly denser than the current `p-5 / size-14 / text-xl` presentation while remaining consistent with Book Nest.

Target direction, not hardcoded values:

- padding around `p-4`;
- avatar around `size-12`;
- primary name around `text-base` / `1.0625rem`;
- compact gaps;
- metadata visually subordinate to the name;
- no fixed card height; bounded text should provide row stability.

If the shared `ui/character-card.tsx` primitive is changed, roster density must be opt-in (variant/props/slots or equivalent) if changing defaults would alter Character Edit preview.

## 6. Hover and focus

Roster card interaction should match current Book Nest clickable-card language:

- accent border on hover/focus;
- hover shadow;
- **no vertical translate/lift** for this roster card;
- no layout shift.

Removing the transform is intentional both visually and to avoid the fragile stacking-context setup behind the current click bug.

## 7. Actions

Favorite remains a button with current global Favorite semantics and `aria-pressed` behavior.

Overflow menu contains exactly:

- `Редагувати`;
- `Прибрати з цієї книги`.

Do not add `Переглянути`; card navigation already provides details navigation.

If the current `UiIcon` registry already has a semantically appropriate unlink/link-off icon, use it for `Прибрати з цієї книги`. Do not add a dependency or expand scope just for an icon.

## 8. Responsive behavior

On narrow widths:

- no horizontal overflow;
- name and metadata do not collide with Favorite/menu actions;
- metadata may wrap cleanly;
- card remains readable and compact;
- tooltip activation must not move layout.

## 9. Non-regression contract

The refactor must not change roster query semantics, spoiler visibility, pagination/infinite scroll, add/link/create behavior, Favorite mutation behavior, unlink behavior, routes, or the Character Edit preview unless a shared primitive API needs a backwards-compatible adaptation.

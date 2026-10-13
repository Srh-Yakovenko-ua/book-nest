# Tests and acceptance

## 1. Browser interaction regression — required

The original `⋮` bug is a real browser stacking/hit-testing issue, so JSDOM alone is not sufficient proof.

Use the project's existing browser-capable Storybook/Vitest browser harness or an equivalent already-supported browser test. Keep any new story/test minimal and scoped to this regression.

Prove at least:

1. Clicking `⋮` opens the dropdown and does not navigate/change route.
2. Clicking Favorite changes Favorite state and does not navigate.
3. Clicking ordinary card body navigates to `/characters/:characterId?bookId=:bookId`.
4. `Редагувати` resolves to `/characters/:characterId/edit?bookId=:bookId` without details navigation first.
5. `Прибрати з цієї книги` opens the existing confirmation flow without navigation.

## 2. Focused unit coverage

Keep/update `character-card.test.tsx` for semantic behavior:

- unspecified importance omitted;
- explicit importance rendered;
- unspecified status omitted;
- explicit unknown status rendered;
- POV rendered only when true;
- contextual details href correct;
- overflow menu has exactly Edit + Unlink;
- Favorite keeps `aria-pressed` semantics;
- global secondary name appears only when `displayName` differs from `name`.

Keep current `book-characters-tab.test.tsx` behavior green, including:

- reading/spoiler context params;
- infinite append;
- search and sort starting a fresh first page;
- optimistic Favorite update/rollback;
- unlink invalidation;
- empty/error/load-more states.

Add/update the summary assertion so the roster strip no longer repeats total Characters while Favorites/POV/hidden warning remain.

## 3. Long-name browser/layout coverage

Verify real layout behavior for:

- short one-line name → no overflow tooltip;
- fitting two-line name → no overflow tooltip;
- 3+ line name → clamped to two lines and full tooltip on hover/focus;
- extremely long unbroken token → no horizontal/card-width blowout;
- resize wide → narrow → overflow state recalculates;
- text/name change → overflow state recalculates;
- `displayName` different from global `name` → global name appears as muted secondary line.

Dimension mocks may be used for isolated helper unit coverage, but they are not the only proof for the visible two-line behavior.

## 4. Visual acceptance

On desktop Book Details → Characters:

- two-column grid remains;
- cards are visibly denser than the baseline screenshot;
- one pathological long name no longer creates a giant paired grid row;
- Favorite/menu remain aligned top-right;
- importance/POV/status/hidden fields read as one metadata group;
- no vertical card lift on hover;
- hover/focus still use Book Nest border/shadow treatment.

On narrow widths:

- no horizontal overflow;
- actions do not cover the name;
- metadata wraps cleanly;
- tooltip causes no layout shift.

Shared primitive check:

- Character Edit preview remains non-clickable/action-free and visually compatible unless its caller explicitly opts into new props.

## 5. Commands

Use repo-standard commands from the current package scripts. At the analyzed baseline the relevant gates are:

```bash
pnpm --filter @app/web test
pnpm --filter @app/web typecheck
pnpm lint
pnpm format:check
```

If a Storybook/browser test or story is added/changed, also run:

```bash
pnpm --filter @app/web test:storybook
```

A narrower focused Vitest invocation is acceptable during implementation, but finish with the relevant package-level gates above unless current `dev` scripts have changed.

Do not regenerate API clients; no API contract changes are expected.

## 6. Definition of done

Done means all of the following are true:

- real-browser `⋮` regression is fixed;
- card body/name still navigates correctly;
- Favorite/menu never trigger card navigation;
- long names are bounded to two lines and tooltip only on actual overflow;
- pathological tokens cannot blow out the grid;
- cards are compact and metadata hierarchy is coherent;
- redundant `Персонажів: N` summary chip is gone, tab count is unchanged;
- Character Edit preview remains compatible;
- existing roster/search/sort/spoiler/infinite-scroll/add/unlink semantics remain unchanged;
- focused tests and quality gates pass;
- no backend/shared schema/generated API/dependency changes were introduced.

## Final Claude Code report

Return only a concise implementation summary containing:

- files changed;
- interaction architecture fix;
- long-name/tooltip approach;
- Character Edit preview compatibility note;
- tests/commands run and results;
- any intentional deviation from this contract and the reason.

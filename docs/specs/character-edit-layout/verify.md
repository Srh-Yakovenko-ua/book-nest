# Character Edit layout: spec audit (VERIFY)

Worktree `refactor/character-edit-layout`, base `472072ad`, run at 2026-10-06T10:41:00Z. Paths are relative to `apps/web/src/`. Every `file:line` was opened in this run.

## Diff (mechanical)

`git diff --name-only 472072ad` plus `git status --short`:

- modified: `app/[locale]/(app)/characters/[characterId]/edit/page.tsx`, `features/characters/components/{character-edit-page.test.tsx, character-edit-page.tsx, character-edit-sections.tsx, character-image-field.tsx, character-inherited-field.tsx}`, `features/characters/model/character-edit-form.ts`, `messages/en.json`, `messages/uk.json`
- untracked: `features/characters/components/character-edit-preview.tsx`, `features/characters/components/character-portrait-panel.tsx`, `docs/specs/character-edit-layout/`
- appeared mid-audit (mtime 2026-10-06T13:39 local, absent from the first `git status`): `features/characters/components/character-edit-page.stories.tsx`, 206 lines

## Checks run in this audit

| Command                                                                                                                                                                    | Result                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm exec vitest --project unit run src/features/characters/components/character-edit-page.test.tsx src/features/characters/model/character-edit-form.test.ts` (apps/web) | 2 files, 46 tests passed (32 page + 14 model)                   |
| `pnpm exec prettier --check` on the 11 changed files + `docs/specs/character-edit-layout`                                                                                  | clean                                                           |
| `pnpm exec eslint` on the 9 changed TS/TSX files                                                                                                                           | exit 0 (tailwind plugin rules self-disabled, same as root lint) |
| node parse of `uk.json` / `en.json`, full flattened key-set diff                                                                                                           | both parse; 0 keys only in uk, 0 only in en                     |

Typecheck, full `pnpm lint` and `pnpm format:check` were not run here; they belong to T21.

## Per-task status

| Task | Status                 | Proof                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | done                   | 5 keys added in `characters.edit` (`firstAppearance`, `portraitInherited`, `previewTitle`, `scopeBook`, `scopeGlobal`) and `characters.spoilers.activeCount` `{count}`, `uk.json:7978, 8000, 8002, 8005, 8006, 8144`, same paths in en; diff has only `+` lines; portrait actions reuse `characters.inheritance.*` at `character-portrait-panel.tsx:78-80`; no `allBooks` / `eyebrow` reference under `features/characters`                         |
| T2   | done                   | `page.tsx:22` main, `:23` header equals `books/[id]/edit/page.tsx:23`, `:24-33` pen.png Image, `:34` H1 with `t("title")` only, `:38` subtitle `md:text-base`; `generateMetadata` `:48-53` outside every hunk                                                                                                                                                                                                                                       |
| T3   | done                   | `character-edit-sections.tsx:645-677` private `EditSection`, `:659` equals `form-section.tsx:32`, `:662-663` `size-9` tile + `UiIcon size={18}` (aria-hidden by default, `ui-icon.tsx:142`), `:666` h2 equals `form-section.tsx:43`, `:672` action slot; badges `:164, :272, :85, :375` book, `:521` global, `:463` none; not in `features/characters/index.ts:1-6`                                                                                 |
| T4   | done                   | `character-inherited-field.tsx:170` root has no border/padding, keeps `data-slot`; `:172` htmlFor only when overridden; `:173-181` action + indicator inside root; `InheritanceAction` `:130-158` and `onChange` calls `:108-109` outside the diff                                                                                                                                                                                                  |
| T5   | done                   | `character-edit-sections.tsx:163-167` title/badge/hint, `:169` grid, `:216-224` custom status, `:226-235` role picker, `:237-251` description → appearance notes → impression; registered names unchanged except `book.portraitMediaId`, which moved to the panel                                                                                                                                                                                   |
| T6   | done                   | `character-edit-sections.tsx:282-292` ActionRow, no `onClick`, `aria-labelledby={labelId}`; `:296-326` narrator after POV, clearable to null; `:329` Separator; `:332` h3 `firstAppearance`; `:334-353` grid, numeric page, `pageError`; `:355-361` note; no ActionList import (`:10-26`); POV test passes                                                                                                                                          |
| T7   | done                   | `character-edit-sections.tsx:520-524` title/global badge/hint, `:526-534` name required + error, `:536-591` kind/gender grid + custom gender, `:593-601` species/pronouns grid, `:603-628` attitude clears to `""`, `:630-636` description; rendered unconditionally `character-edit-page.tsx:235`                                                                                                                                                  |
| T8   | done                   | `character-edit-sections.tsx:84-145` displayName → Separator → speciesOverride → Separator → attitude; props are only `control`, `maskedFields` (`:68-74`); no portrait Controller in file; `MaskedOr` `:701-719`                                                                                                                                                                                                                                   |
| T9   | done                   | `character-edit-sections.tsx:463` no badge, `:464-477` global group, `:479-497` Separator + book group only with book scope; `character-alias-group.tsx` not in diff; alias tests pass                                                                                                                                                                                                                                                              |
| T10  | done                   | `character-edit-sections.tsx:375` badge; `:385-396` ActionRow + Switch `aria-labelledby`; `:390, :397` hint as `<p>` linked by `aria-describedby` (D2-B); `:406` Collapsible `defaultOpen={activeCount > 0}` (D3-B); `:410-412` count badge only when > 0; `:423-444` 7 rows with Separator, no border, no `disabled`; `SPOILER_FIELDS` `:49-57` outside the diff; tests at `character-edit-page.test.tsx:366, 381, 399` pass                       |
| T11  | partial                | Upload path `character-image-field.tsx:51-78` unchanged except `onSuccess` `:75`; label span removed; `onUpload` / `onReset` `:75, :109`; preview is controlled `:30, :85`, fallback letter when null `:86-88`; single `useUploadMedia` `:49`. **Gap:** criterion "the avatar image keeps a meaningful alt" is broken by the post-plan `alt=""` at `character-portrait-panel.tsx:70`, rendered at `character-image-field.tsx:85`                    |
| T12  | done                   | `character-portrait-panel.tsx:47-49` title once; `:57-59` Controller on `book.portraitMediaId`; `:61-67` inherited explanation vs `bookOnly`; `:72` reset → null; `:79-81` specify/replace labels; `:52-55` masked placeholder, no upload controls; book context only `character-edit-page.tsx:201`; URL source `character-edit-page.tsx:139-145`                                                                                                   |
| T13  | done                   | `rg InheritedImageField apps/web/src` → 0 matches; `CharacterImageField` imported only by `character-portrait-panel.tsx:17`; exports `character-inherited-field.tsx:47, :93`                                                                                                                                                                                                                                                                        |
| T14  | partial (browser)      | `character-edit-preview.tsx:11, :55` ui `CharacterCard`, no actions/bookTitle; `:34-38` `useWatch` only; `:40` `effectiveCharacterName` (D4-B, `model/character-edit-form.ts:142-151`); `:56` image from page; `:59-66` role badge; `:41-44` POV then status; `:47-53` labelled region + h2; `:57` hover override against `ui/character-card.tsx:37`. **Open:** "verified in the browser (no translate/shadow change on hover)" has no evidence yet |
| T15  | done                   | `character-edit-page.tsx:196` form class exact; `:217` main column; `:218-251` order 6.1, 6.2, 6.3, 6.4, 6.5, 6.6; `:200` sidebar wrapper (`contents`, lg sticky flex) per D1-A; `:212` preview `order-last lg:order-none`; one panel `:203`, one preview `:213`; `:105` single `useState`; `:52-82` and `:152-192` outside the diff                                                                                                                |
| T16  | partial (browser)      | `character-edit-page.tsx:253` equals `book-form.tsx:1038`; `:255, :264` button sizing; `:256-271` cancel/save wiring unchanged; bar inside main column `:217-273`; `:275-283` dialog unchanged. **Open:** "checked at 390px" has no evidence yet                                                                                                                                                                                                    |
| T17  | done                   | `character-edit-page.tsx:292-306` `<output aria-busy aria-label={t("loading")}>` with two-column grid, mirrors `edit-book-form.tsx:25-29`; error branch `:63-69` unchanged                                                                                                                                                                                                                                                                          |
| T18  | done                   | `character-edit-page.test.tsx:415-434` order, `:436-447` global, `:449-456` panel + preview, `:458-469` global without panel/upload; no snapshot, `toHaveClass` or `22rem` in the file                                                                                                                                                                                                                                                              |
| T19  | done                   | `character-edit-page.test.tsx:410-412` region helper; `:520, :528, :540, :575, :596, :605, :626, :641`; plus `:560` (D4 blank override) and `:616` (global mode)                                                                                                                                                                                                                                                                                    |
| T20  | done                   | 0 removed lines in the test diff; all 18 base tests remain (the plan said 17, base has 18); `character-edit-form.test.ts` has no diff; 46/46 green                                                                                                                                                                                                                                                                                                  |
| T21  | pending (orchestrator) | see the checklist below                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Gaps, in priority order

1. **T21 will fail its own `doneWhen` as written.** "git diff --name-only shows nothing under … `model/character-edit-form*.ts`" is false: `model/character-edit-form.ts:142-151` adds `effectiveCharacterName` (post-plan change). The same file is listed in `tasks.json` `scope.excluded` and in 01 "Files normally NOT to edit" (`01-IMPLEMENTATION-MAP.md:139`). Resolve by amending the T21 criterion and the exclusion to allow this helper, or by moving the helper into `components/` next to its two callers. The test file is untouched, so 02 "character-edit-form.test.ts should remain essentially unchanged" holds.
2. **T11 alt conflict.** The post-plan `alt=""` (`character-portrait-panel.tsx:70`) contradicts T11 "the avatar image keeps a meaningful alt"; the base used the field label as alt. Either amend T11 (treat the panel image as decorative, since the h2 at `:47-49` and the state line at `:65-68` carry the meaning) or pass `alt={name}`. Needs a ruling, not a guess.
3. **T14, T16: browser-only criteria are open.** Hover neutralisation and the 390px "last block above the bar" check are folded into the T21 list.

## Forbidden items

| Rule                                                                        | Result                                                                                                                       |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| No backend / API / codegen / `packages/**` change                           | pass: no path under `apps/api`, `packages`, `shared/api/generated`                                                           |
| No new deps                                                                 | pass: no `package.json` or `pnpm-lock.yaml` in the diff                                                                      |
| No edits to `components/ui/**`, `features/books/**`, `features/timeline/**` | pass: none in the diff                                                                                                       |
| No new Character → Books import                                             | pass: no added `@/features/books` or `@/features/timeline` line; only the pre-existing `character-edit-page.tsx:17`          |
| No hardcoded UI strings                                                     | pass: no Cyrillic and no literal JSX text or literal `aria-label` / `alt` / `title` / `placeholder` in the 8 changed sources |
| uk/en parity                                                                | pass: identical flattened key sets                                                                                           |
| No code comments                                                            | pass                                                                                                                         |

## Post-plan changes (verified, accepted)

| Change                                                         | Proof                                                                                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Hide-presence title wraps                                      | `character-edit-sections.tsx:386`                                                                                      |
| Focus returns to the upload button after reset; input `hidden` | `character-image-field.tsx:48, :97, :108-111, :125`                                                                    |
| Skeleton `aria-label` from `common.loading`                    | `character-edit-page.tsx:289, :294`                                                                                    |
| `effectiveCharacterName` shared by preview and panel           | `model/character-edit-form.ts:142-151`; `character-edit-preview.tsx:40`; `character-portrait-panel.tsx:38` (see gap 1) |
| Panel image `alt=""`                                           | `character-portrait-panel.tsx:70` (see gap 2)                                                                          |
| Upload state `{mediaId, previewUrl}` gated on watched id       | `character-edit-page.tsx:105, :139-143`; type `character-image-field.tsx:20-23`                                        |
| Entrance motion on the children, not the `contents` wrapper    | `character-edit-page.tsx:202, :212, :217`; parity with `book-form.tsx:795, :1060`                                      |

## Accepted deviations

| Deviation                                                               | Where                                         |
| ----------------------------------------------------------------------- | --------------------------------------------- |
| Masked portrait caption reuses `characters.inheritance.bookOnly`        | `character-portrait-panel.tsx:53`             |
| Image field avatar drops `size="lg"`                                    | `character-image-field.tsx:84`                |
| Preview avatar `alt` is the name                                        | `character-edit-preview.tsx:56`               |
| Fixed mobile bar has no scroll-padding (Book parity)                    | `character-edit-page.tsx:196, :253`           |
| Clicking an `ActionRow` label does not toggle its switch (no `onClick`) | `character-edit-sections.tsx:282, :385, :430` |
| Out of scope: `CharacterCard` primitive avatar size bug                 | `components/ui/character-card.tsx:45`         |
| Out of scope: `pen.png` at 1 MB                                         | `page.tsx:30`                                 |
| Out of scope: whole-form `useWatch` re-render (pre-existing)            | `character-edit-page.tsx:130`                 |

## Drift (in the diff, asked for by no task)

| Item                                                                                                                                      | Where                                                                    | Weight                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edit of the excluded model file                                                                                                           | `model/character-edit-form.ts:1-6, :142-151`                             | conflicts with `scope.excluded` and T21 (gap 1)                                                                                                                  |
| Icons inside the scope badges (`book`, `globe`)                                                                                           | `character-edit-sections.tsx:61-64, :727`                                | cosmetic, not in 00 §4                                                                                                                                           |
| `InheritedFieldShellProps.htmlFor` made required                                                                                          | `character-inherited-field.tsx:23`                                       | type tightening that follows T13; no behaviour change                                                                                                            |
| Reset button now shows whenever `value !== null` (base also required a local preview URL)                                                 | `character-image-field.tsx:80, :105`                                     | needed for the T12 override state with a saved portrait; intended                                                                                                |
| New Storybook file `character-edit-page.stories.tsx` (stories `BookContext`, `Global`, with `play` tests and hardcoded uk section titles) | `features/characters/components/character-edit-page.stories.tsx:163-206` | listed in `scope.excluded` ("Storybook stories: not requested"); keep only if the orchestrator records it as a T21 screenshot harness, else delete before commit |

## T21 browser checklist (02 manual matrix + open browser criteria)

Contextual desktop (`/characters/<id>/edit?bookId=<id>`, at least 1280px):

1. Shell and header match Edit Book side by side: width, pen.png, H1 size, subtitle, entrance motion.
2. Main column plus a 22rem sidebar that stays sticky under the shell header while scrolling.
3. Section order: У цій книзі, Роль у розповіді, Про персонажа, Лише для цієї книги, Інші імена, Спойлери.
4. Sidebar shows Portrait above Preview.
5. No bordered card around each inherited field in "Лише для цієї книги".
6. "Зображення в цій книзі" appears once; no second portrait label inside the panel.
7. Preview card: no lift and no shadow change on hover (T14).
8. Action bar sticks to the bottom of the form column at sm+ with compact buttons, as in Book Form.
9. Hide-presence title wraps instead of truncating; the hint is fully visible.
10. Spoiler disclosure opens and closes; the count badge shows once a flag is on.
11. Upload a portrait: panel and preview update before Save; reset returns both to the global avatar or the initial letter.

Global desktop (`/characters/<id>/edit`, no `bookId`):

12. Only "Про персонажа" and "Інші імена".
13. Sidebar holds the Preview only; no portrait editor; no empty book-context card or gap.

Contextual mobile (390px):

14. Order: Header, Portrait, sections, Preview, fixed action bar.
15. No horizontal scroll.
16. The Preview scrolls fully above the fixed bar (T16).
17. Cancel and Save are full-width and 44px tall.

Accessibility (keyboard plus screen reader):

18. Tab order is logical: Portrait upload/reset, then form fields in section order, then Cancel and Save; Preview takes no focus.
19. POV, hide-presence and all 7 granular switches announce their row title; hide-presence also announces its hint.
20. Name and page errors stay associated with their inputs.
21. Icon-only actions (alias remove, select clear) keep labels.
22. pen.png, section icon tiles and badge icons stay silent.
23. After reset, focus lands on the upload button.

Non-browser T21 gates still to run: `pnpm --filter @app/shared build` if dist is stale, the focused vitest command, `pnpm --filter @app/web typecheck`, `pnpm lint`, `pnpm format:check`, and the name-only path check (fails today on `model/character-edit-form.ts`, gap 1).

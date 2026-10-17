<!-- Source: D:/IT/book-docs/new/3__BOOK_NEST_CHARACTER_FACTS_OPTIMIZED_v2/BOOK_NEST_CHARACTER_FACTS_OPTIMIZED_v2 (00_START_HERE.md + 01..04), copied verbatim 2026-10-16. Scope: the whole package, decisions D01-D20. -->

---

<!-- file: 00_START_HERE.md -->

# Book Nest — Character Facts / Claude Code execution entry (optimized v2)

> **Task:** implement the approved Character Facts refactor end-to-end in the CURRENT worktree. **Do not commit, push, merge, switch branches, reset, or overwrite unrelated edits.** This ZIP is a specification, **not a patch**. Do not create a second execution framework.
> **v2 technical hardening:** race-safe merge writes; timestamp integrity; staged full-view UI; bounded v2 import with 1 MB request-body preflight; lean subagent/testing policy; resumable checkpoints. These are implementation safeguards, NOT changes to D01–D20.

## Input files / priority

1. Repository `CLAUDE.md` and applicable `.claude/skills/**` (repo rules take precedence on tooling and coding conventions).
2. `01_APPROVED_SPEC.md` — **binding product decisions #1–20**; never silently narrow or replace them.
3. `02_DEV_INTEGRATION_MAP.md` — starting pointers and known traps, **not an assertion that the current worktree matches the reference**.
4. `03_IMPLEMENTATION_SLICES.md` — suggested dependency order, compatible with `spec-to-ship`.
5. `04_ACCEPTANCE_AND_TESTS.md` — completion criteria and regression matrix.

**Reference inspected:** `dev` @ `d5af308a54c0503df737ac7aa519d4ea0ce63367`. Treat as a _reference_, not a checkout target. Verify current worktree HEAD, branch/worktree status, changed files and actual symbols before acting; newer local work wins. Never rewrite or discard existing user work. Respect unrelated concurrent character-form/spoiler changes.

## Execute (single-session handoff)

1. Read `CLAUDE.md` and `.claude/skills/spec-to-ship/SKILL.md`; invoke/follow existing **`spec-to-ship`** workflow. Use `blast-radius`, `db-migrate`, `new-endpoint`, etc. when triggered. The repo's `spec-to-ship` owns `tasks.json`, gates, specialist reviews and final verification; **do not duplicate those process rules in new permanent files**.
2. Verify this spec against actual worktree and produce the spec-auditor PLAN verdict, recording confirmed/moved/stale/already-done details. Place the canonical spec under `docs/` per the repo skill and create its `tasks.json` there. Map **all 20 decisions** to tasks and executable acceptance checks. Consult 02–04 only when relevant, not on every micro-step.
3. Confirm consistency of data ownership, reading-context enforcement, URL switching, cascade/unlink, **concurrent fact mutations during merge**, timestamp preservation, and v1/v2 portability **against API body-size limits**. Ask the user **only for a real blocking product conflict**; do not re-open already approved choices. Technical decisions may be made using repo conventions, documented briefly in `tasks.json`.
4. Implement in dependency order, one green slice at a time. Shared Zod contracts → reviewed Prisma migration → repository/service/controller → generated API client → merge/lifecycle → portability → tabs/UI/CRUD → tests/review. Arrange precise slices using existing `spec-to-ship` task graph. Do **not** expose a dead `Читати повністю` action in S5: render the action **together with its functional full-view modal in S6**.
5. Reuse existing components, **never hand-edit** `apps/web/src/shared/api/generated/**`; run `pnpm gen:api` after backend contract changes. Preserve existing UX and spoiler logic. No new general-purpose component unless reuse is demonstrably inadequate.
6. Follow existing reviewers/gates **without replacing or weakening repo `spec-to-ship`**. At completion run spec-auditor VERIFY over `tasks.json` and actual diff, report tests, known limitations and proof; **do not claim passing tests you did not run**.

## Non-negotiable deliverable

Working character-detail tabs `Огляд` + `Факти`, independently CRUDable per-book facts, 20-item server-paginated endless scroll, server-side `q` search, secure lifecycle, lossless merge, v2 export and v1/v2 import compatibility. **No per-fact spoilers, no forced migration of legacy description, no reimplementation of existing shared UI, and no unauthorized commits.**

## Session progress / token economy

- Source of truth: `01_APPROVED_SPEC.md`; refer to `D01`–`D20` IDs instead of repeating whole sections in prompts or agent handoffs.
- Let `spec-to-ship` generate atomic `tasks.json` entries with `doneWhen` and explicit dependencies. Hand specialist agents only their related tasks and the pertinent sections; avoid giving each agent the entire ZIP.
- **No duplicative orchestration:** use the existing `spec-auditor` PLAN once on verified baseline and VERIFY once at final gate; rerun PLAN only for real worktree drift or a broken assumption. The repository skill has priority if it requires an extra pass.
- Delegate substantive, separable work to the repo agents when warranted; batch related findings/queries, avoid multiple agents receiving identical large context. **Never skip** a review/subagent/gate that `CLAUDE.md` or `spec-to-ship` explicitly mandates.
- **Avoid repeated expensive tests without coverage gain:** run affected focused tests plus mandatory per-slice checks; use `blast-radius` to expand suite only when impacted contracts/consumers justify it. Record the last green revision/task ids; rerun when relevant code changes. Do not skip mandatory final checks.
- **Resumability:** maintain a short `docs/specs/character-facts/progress.md` checkpoint after each accepted slice and before session handoff. It is a _pointer_ into `tasks.json`, not a duplicate tracker. Include worktree HEAD + status, current stage, completed task IDs, last gate commands/results (with date or commit), blockers, and the very next action. On resume read `CLAUDE.md`, canonical spec, `tasks.json`, checkpoint, then relevant code only; verify git drift and run only impacted checks. Do not treat a checkpoint as proof if underlying code changed.
- Use precise symbol/file searches; never recursively read the entire monorepo on each step.
- Prefer focused tests during slices, broad dependency-aware testing after contract or migration changes as required by repo `blast-radius` rules.
- Check the actual current worktree before rewriting anything; record drift and reconcile against the approved product spec rather than blindly applying stale patches.
- If a required tool/database/service is unavailable, report the exact blocker and what was/was not validated; don't fabricate success.
- **Portability transport trap:** `apps/api/src/bootstrap.ts` currently limits JSON to `1mb`. Verify realistic fact-rich v2 export → import through HTTP, not just serializer tests. Do not globally increase the limit without evidence/review; if the guaranteed round trip needs a larger upload, use a narrowly scoped, validated solution consistent with existing architecture, or report a genuine blocker. Never truncate facts to force a bundle under the cap.

---

<!-- file: 01_APPROVED_SPEC.md -->

# Approved product specification — Character Facts (binding decisions D01–D20, v2 technical hardening)

**Scope:** New independently CRUDable `CharacterFact` records in the selected **book-specific** character appearance (`BookCharacter`). They replace the _habit_ of writing unrelated facts in one large description, not the historical description storage itself. All product decisions below have been approved. This document is the only full copy of the requirements.

## Approved decisions

### D01 — Separate persisted entity

Create a dedicated `CharacterFact`, NOT `Note`, NOT the existing derived frontend `ProfileFact`, and NOT a JSON blob inside `BookCharacter.description`. Facts have independent ids, create/read/update/delete and timestamps.

### D02 — Ownership and scope

Each fact belongs to exactly one `BookCharacter`, hence one character-in-one-book. No global `Character` facts, no series-wide aggregation; don't leak other books' facts. Apply existing book ownership, active entity and reading-context access conventions. Global view offers book selection; facts are loaded only for a valid selected book context.

### D03 — Data and spoiler policy

Fields: `title` required, trim, 1–120 chars; `text` required, trim, 1–5,000 chars; `chapter` optional, trimmed max 100 chars; `page` optional positive integer within valid book page ceiling where known, technical cap otherwise. Auto-generated `id`, `createdAt`, `updatedAt`; no user-editable `position`. **No `isSpoiler`/per-fact reveal/checkbox/hidden-field semantics.** Existing character spoiler logic remains unchanged. Do not suggest facts are individually spoiler-masked: isolation by valid book context is the agreed protection. Support null/empty normalization aligned with Notes.

### D04 — One modal create/edit workflow

Use one `CharacterFactFormDialog` (name illustrative) for create and edit with mode/default values, following `NoteFormDialog` and shared `Dialog` patterns. No redirect to global character edit form.

### D05 — Preview cards

Desktop: 2 columns; mobile: 1. Keep Book Nest card styling. Title clamped to about 2 lines; body about 3–4; show chapter/page metadata only if defined. Ellipsis menu for Edit/Delete; compact and accessible. Reuse Notes card elements/styles where appropriate, without inheriting Note-only categories/favorites/pins/spoilers.

### D06 — Full view

A “Читати повністю” action opens a full-text modal following `NoteFullViewDialog`; **show the action only if content actually overflows/clamps**, not on every card. Reuse accessible dialog/focus/scroll behavior. Do not create a separate detail route.

### D07 — Stable ordering

Sort server-side `createdAt DESC, id DESC`; editing must NOT reorder; no manual ordering/drag-drop. Pagination stable on tie-breaking id.

### D08 — Detail-page tabs and endless scroll

Exactly two `PageTabs`: **`Огляд`** (all existing detail-page content and functionality) and **`Факти`**. The hero and `CharacterContextSelect` remain common. Preserve every existing overview section, appearance controls, spoiler reveals, actions, mobile presentation and right sidebar functionality. Facts are lazy-fetched only when active and scoped. Use existing `useInfiniteQuery`/`InfiniteScrollFooter` (automatic load + retry); no independent scroll implementation.

### D09 — Keep legacy book description

Keep `BookCharacter.description` and existing `descriptionIsSpoiler` data/behavior untouched. On Overview relabel only its UI copy to **«Загальний опис у цій книзі»** (with suitable English translation). **No automatic migration, clearing or restructuring of old text**. New structured entries are authored under Facts. Preserve existing edit workflows.

### D10 — Context behavior

Both tabs stay visible in **book**, **global** and **smart** character views. Book: facts of selected book only. Global: show prompt to select a book, never aggregate all-book facts. Smart: resolve unique allowed book by existing logic; if no concrete book, prompt to choose. Reuse `CharacterContextSelect`, do not duplicate context selector or invent alternate selection state. No automatic leakage from later books/series.

### D11 — URL and context switching

Use `nuqs` and `PageTabs` with `?tab=overview|facts`; default Overview can omit `tab`, Facts is `tab=facts`. Preserve active tab when switching book/global/smart context, refreshing, direct linking and canonical redirects. **When selecting a different character** open Overview by default. When changing book, **clear facts search `q`**, preserve tab, change React Query scope, reset infinite data to first page; do not flash stale facts from prior book. Keep `bookId`/`view=global` canonical, avoid constructing scattered ad-hoc query strings. Guard unsaved form drafts during navigation.

### D12 — Confirmed deletion

Card ellipsis “Видалити” → shared `AlertDialog` identifying the fact → delete mutation. A single shared dialog at list level rather than one dialog per card. Disable double submit. On success close/update list+counts/toast. On failure preserve fact and dialog, show error. No optimistic irreversible disappearance, no bespoke undo/trash mechanism for individual fact in v1. Handle deleted-elsewhere 404 gracefully by refetch.

### D13 — Validation and draft protection

One RHF+Zod form for create/edit, required title/text, optional chapter/page, frontend AND backend validation. Reuse Notes' `ChapterCombobox`, `bookPageCeiling`, `useBookPagesCount`, field errors, textarea count, dialog controls. Avoid submit if unchanged; on submit error keep user input/dialog; saving disables duplicate actions. If dirty, close via Cancel/X/Escape/outside click, book change, internal SPA navigation, browser refresh/leave must not silently drop changes. Reuse `DiscardConfirmDialog`; use `beforeunload` for browser unload _plus_ a real solution for client-side navigation (beforeunload alone is insufficient). In no-change case allow immediate close. Handle user focus and keyboard.

### D14 — Loading, empty, error, retry

Reuse `EmptyState`, available `empty-notes`/`empty-search` illustrations, skeletons (adapt `NoteCardSkeleton` as necessary), `CharactersErrorState` / equivalent and `InfiniteScrollFooter`. Distinct states: initial loading, no facts + Add CTA, no book selected + select CTA, initial load error + retry, incremental error + retry while preserving loaded cards, exhausted list. Search with zero hits uses _clear search_, not _add first fact_. Errors are never mislabeled as emptiness.

### D15 — Ownership and lifecycle

Every fact CRUD request must validate owner of current non-deleted book and character + the `BookCharacter` link + requested fact's belonging to that link, server-side. Scope lookups to authenticated user/context; avoid cross-account enumeration. `BookCharacter` unlink is hard deletion: facts `onDelete: Cascade`, **existing unlink confirmation must display server-grounded affected facts count**, explicitly warn of irreversible fact deletion; re-linking doesn't restore those facts. Soft-deleting/restoring Character or Book must retain/restore their facts (no physical cascade until final purge). Final hard purge cascades. Extend existing character deletion preview with impact count. Respect all existing ownership/context invariants. Merge is a _different_ operation governed by D18.

### D16 — Search (no filters)

Server-side search on `title` and `text`, case-insensitive; normalize trim/collapsed spaces; canonical `q` URL field; reuse `DebouncedSearchInput` 300 ms, commit at >=2 characters (or clear). Search over full scoped dataset, never only loaded pages. Changing q restarts infinite from page 1; preserve `createdAt DESC,id DESC`. Clear action and search-empty state. No extra category/chapter/page filters, no sorting selector, no grid/list switch, no faceted API.

### D17 — Architecture and quality audit

Approved architecture, contracts, performance, tests, states, and component reuse. Before coding check current `dev` and worktree; no rewriting existing systems for mere stylistic preference. Incremental, verifiable changes; focused tests plus blast-radius tests; enforce no regressions or data loss.

### D18 — Lossless merge

When merging global characters: for loser appearances in books absent on survivor, existing `BookCharacter` is repointed; all attached facts retain original FK, ids and content. For overlapping book appearances, **move all loser facts onto the surviving appearance before deleting the loser `BookCharacter`**, in the same transaction as existing merge. Preserve `id`, `title`, `text`, `chapter`, `page`, `createdAt`, `updatedAt`. Never dedupe by identical titles/text. Update merge preview/result stats to show affected fact count(s), with **zero fact loss**. Honor existing merge locking and conflict handling. Unit, integration and rollback tests required.

**Concurrency invariant (v2 technical hardening, not a product change):** successful fact create/update/delete must not race with the merge's reparent-and-delete sequence such that a committed fact silently disappears or a writer edits the wrong appearance. Coordinate fact mutations and merge via a **shared transaction/locking protocol** on affected `BookCharacter` rows (consistent lock order for multi-row merge) or another demonstrably equivalent mechanism. Existing _merge-only_ advisory lock is **not enough** unless fact writers participate. Authenticate/validate parent scope in that transaction; handle a disappearing/reparented parent by explicit conflict/not-found + safe refresh, not by false success. Test overlapping merge and concurrent creation/update with controlled interleaving, as well as rollback.

**Timestamp invariant:** `@updatedAt` can advance during ORM FK updates. Reparenting is **not user editing**. Preserve old `createdAt` and `updatedAt` exactly using a verified implementation (e.g. a narrowly scoped parameterized SQL FK update or explicit restoration within the same transaction); do not assume an ORM `updateMany` of `bookCharacterId` leaves `updatedAt` untouched. Assert before/after timestamp equality in DB tests.

### D19 — Portable CharacterBundle v2, compatible v1

Export new `formatVersion: 2` with `facts[]` nested in each book appearance; fact item contains title/text/chapter/page/original `createdAt`/`updatedAt` (no embedded internal FK needed; parent appearance defines it). Preserve all other bundle functionality. Import **both existing v1 (including legacy upgrade paths) and v2**: v1 treated as appearances with empty facts; v2 validates facts strictly; old invalid/unknown formats must not be silently accepted. New UUIDs are generated for imported Character, BookCharacter and Fact; preserve fact timestamps and link to newly generated BookCharacter id. Respect existing owned book reference resolution. If a book appearance is skipped because book unavailable, skip its facts _and count/report them_; do not create orphans. Invalid input and transaction failures must not partially write. Define bounded count/size limits suitable for existing import policy; extend created/skipped result DTOs and tests. No guess-based conversion of historical `description` to facts.

**Bounded import implementation (v2 technical hardening):** define and document **explicit numeric** `CHARACTER_BUNDLE_FACTS_PER_APPEARANCE_MAX` and `CHARACTER_BUNDLE_FACTS_TOTAL_MAX` constants under `packages/shared`, validate both in v2 Zod schema (per-appearance array plus bundle-wide aggregate), map overflows to the existing `tooLarge` error pathway, and include boundary tests. Provisional starting budgets for engineering review: **200 per appearance, 2,000 total**; verify them against existing character/appearance bounds and actual API request limits before freezing. Do not silently clip any export or accept a v2 file that can be partly written; if data cannot round-trip within justified limits, surface the capacity mismatch for a scoped fix. Legacy v1 remains accepted on its previous rules (do not retroactively require `facts[]`). These import safety bounds are **not a maximum number of facts users may create**.

**Transport preflight:** `apps/api/src/bootstrap.ts` presently has `JSON_BODY_LIMIT = "1mb"` for the API. Large v2 JSON can pass logical count checks but fail HTTP ingestion. Verify realistic max-size payloads through the import HTTP endpoint and report the supported serialized byte budget. Do **not** globally raise JSON limits as a quick fix. If this blocks full export→import functionality, implement a narrowly scoped safe remedy only after verifying repo conventions and security implications; otherwise flag it as a blocker rather than claiming round-trip support. Never export only a subset of facts without explicit indication and approval.

### D20 — Infinite scroll page size

`CHARACTER_FACTS_PAGE_SIZE = 20` independent of roster/notes constants; 20 records per request, server pagination; automatic loading through existing `InfiniteScrollFooter`. It is a configuration constant, not a new paging mechanism. Maintain retry, stable order, correct cache scope and count after mutations.

## Domain model guidance (implementation should match current repo conventions)

`CharacterFact`: UUID `id`; required `bookCharacterId` FK to `BookCharacter` (`onDelete: Cascade`); `title`, `text`, nullable `chapter`, nullable `page`, `createdAt`, `updatedAt`; relation back to BookCharacter, index for `[bookCharacterId, createdAt DESC, id DESC]`, and search plan appropriate to existing Postgres conventions. DO NOT add `userId` or `characterId` redundantly unless a measured security/performance need is confirmed: ownership is via parent BookCharacter → Character/Book, with scoped reads in repository. Add no `position`, `isSpoiler`, favorites, category, pinning or tags.

Suggested REST surface follows existing NestJS patterns: `GET/POST /api/books/:bookId/characters/:characterId/facts`, `PATCH/DELETE /api/books/:bookId/characters/:characterId/facts/:factId`. Keep GET pagination query `pageNumber`, fixed/default 20 `pageSize`, optional `q`; Zod validation and DTOs in `packages/shared`, Swagger and Orval client regeneration. The precise controller split is an implementation choice consistent with the repo, not an excuse to change scope.

Avoid silently treating `page` as a spoiler guard. Reading-context restrictions apply to the _book selection/access_ as in the existing details API, not to custom per-fact spoiler flags (explicitly disallowed).

## Hard out-of-scope

- Changes to existing global character fields, statuses, roles, portrait/image, or spoiler architecture beyond essential integration.
- Global relaxation of request size/security limits solely to accommodate portability; implement a reviewed scoped transport solution if proven necessary.
- Conversion of legacy descriptions, manual ordering, global or cross-book fact feeds.
- Tags, categories, reactions, new filter facets, standalone facts page, rich text editor, separate fact trash, autosave drafts, dedicated storage for fact images.
- New duplicate-detection or merge UI unrelated to fact preservation; existing merge flow must be extended locally.
- Changing old v1 exported files or importing facts into wrong/foreign books.

---

<!-- file: 02_DEV_INTEGRATION_MAP.md -->

# Integration map, existing components, traps (optimized v2)

Reference audit: public `dev` @ `d5af308a54c0503df737ac7aa519d4ea0ce63367`. **Read actual worktree files first; these are navigation hints, not immutable line positions.** Project `CLAUDE.md` is authoritative for architecture and tooling.

## Core layer and CRUD

| Need                       | Existing location / pattern                                                                                                | Required adaptation                                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma schema + migrations | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`                                                             | Add `CharacterFact`, BookCharacter relation, indexes, reviewed SQL migration; avoid dropping preexisting hand-written SQL indexes.                            |
| Shared contracts           | `packages/shared/src/characters.ts`, `notes.ts`, `common.ts`, `index.ts`                                                   | New fact DTOs, query and pagination, required title (unlike notes), page/chapter limits, merge + import/export fields.                                        |
| API structure              | `apps/api/src/modules/characters/characters.module.ts`, `api/book-characters.controller.ts`                                | Place fact controller/service/repo inside characters module using existing api/application/domain/infrastructure separation and Jwt/Zod/Swagger patterns.     |
| Ownership                  | `application/character-access.asserter.ts`, `infrastructure/characters.repository.ts`                                      | Assert book owner, character owner, active link + fact scope. Do not authorize by fact id alone.                                                              |
| Reading context            | `application/character-details.assembler.ts`, `domain/reading-context-window.ts`, `application/book-characters.service.ts` | Use same allowed-context semantics; do not auto-leak facts from other books.                                                                                  |
| Pagination                 | `apps/api/src/core/paginator.ts`, `packages/shared/src/common.ts`                                                          | Existing paginator, list total/page semantics, stable `(createdAt,id)` sorting.                                                                               |
| OpenAPI                    | `apps/api/src/scripts/generate-openapi.ts`, `apps/web/orval.config.ts`                                                     | `pnpm gen:api`; generated web client under `apps/web/src/shared/api/generated/**` is generated-only, never edited by hand.                                    |
| API JSON transport         | `apps/api/src/bootstrap.ts`                                                                                                | Body parser currently caps JSON at `1mb`; fact-rich `CharacterBundle v2` requires actual HTTP round-trip size testing and scoped capacity strategy if needed. |

## Frontend — keep overview intact

| Need                        | Existing code                                                                                                                                                                                  | Guidance                                                                                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detail page / layout        | `apps/web/src/features/characters/components/character-details-page.tsx`                                                                                                                       | Keep Hero, ContextSelect and right sidebar; Overview preserves MobileAppearances, BookSection, ProfileSection, FormsSection, spoiler controls and actions.                                            |
| Existing book description   | `.../character-book-section.tsx`                                                                                                                                                               | Change only display label `Загальний опис у цій книзі`; retain `BookCharacter.description`/`descriptionIsSpoiler` and other book notes.                                                               |
| Tabs                        | `apps/web/src/components/page-tabs.tsx`, `features/books/components/book-details-view.tsx`                                                                                                     | Reuse `PageTabs`, `PageTabsPanel`, `nuqs` `tab=overview                                                                                                                                               | facts`. |
| Context resolution / routes | `features/characters/model/character-details-context.ts`, `character-routes.ts`, `components/character-context-select.tsx`                                                                     | Route builder currently only knows `bookId`/`view`. Extend _existing_ URL helpers to preserve tab, clear q when book changes; preserve smart redirect and canonical link; no scattered string concat. |
| Endless scroll              | `features/characters/components/book-characters-tab.tsx`, `api/use-book-characters-infinite.ts`, `apps/web/src/components/infinite-scroll-footer.tsx`, `hooks/use-infinite-scroll-sentinel.ts` | `useInfiniteQuery`, query keys scoped to book+char+q, `getNextPageParam`, 20 items, retry incremental only.                                                                                           |
| Search                      | `apps/web/src/components/debounced-search-input.tsx`, `features/notes/model/notes-archive-query.ts`                                                                                            | Reuse 300ms / 2-char normalized canonical q. No client-only filtering; no extra search implementation.                                                                                                |
| Note card / full view       | `features/notes/components/note-archive-card.tsx`, `note-card-skeleton.tsx`, `note-full-view-dialog.tsx`                                                                                       | Reuse styles/behavior, not domain Note-specific actions/fields; full action only if real clamp.                                                                                                       |
| Edit/create form            | `features/notes/components/note-form-dialog.tsx`, `note-form-fields.tsx`, `note-form-schema.ts`, `apps/web/src/components/chapter-combobox.tsx`, `features/books/model/book-page-ceiling.ts`   | Shared Dialog/RHF/Zod/chapter/page conventions; `title` REQUIRED for facts unlike Note; no category, flag fields, or Note entity picker.                                                              |
| Unsaved work                | `features/characters/components/character-edit-page.tsx`, `features/books/components/discard-confirm-dialog.tsx`                                                                               | Use `DiscardConfirmDialog`, proper dirty detection; add protection for all close/navigation paths incl. SPA navigation, not only beforeunload.                                                        |
| Delete                      | `features/notes/components/delete-note-dialog.tsx`, `features/characters/components/unlink-character-dialog.tsx`                                                                               | One AlertDialog per tab; unlink dialog must show server-grounded affected fact count and irreversible warning.                                                                                        |
| Empty/error                 | `apps/web/src/components/empty-state.tsx`, `features/characters/components/characters-error-state.tsx`, `features/notes/components/notes-archive-content.tsx`                                  | Reuse `empty-notes`, `empty-search`, skeleton, load-more error footer; distinguish 0 matches from 0 facts.                                                                                            |
| Cache                       | `features/characters/api/character-keys.ts`, Notes mutation effects                                                                                                                            | Scoped query keys / invalidate facts list and summary after CRUD/unlink/merge; never display other book transiently.                                                                                  |
| i18n                        | `apps/web/src/messages/uk.json`, `en.json`, `.claude/scripts/check-i18n-parity.mjs`                                                                                                            | Add localized labels, errors, actions, empty states; never hardcode Ukrainian into components.                                                                                                        |

## Data-loss integration traps

1. **Unlink:** `book-characters.service.ts` `unlink()` calls `deleteBookCharacter()`; FK cascade will delete facts. Improve existing `UnlinkCharacterDialog` with count; this is approved and distinct from merge.
2. **Character soft delete/restore:** `character-lifecycle.service.ts` sets `deletedAt`, then later hard purges. Facts persist through the soft period and return after restore; hard FK cascade applies only on physical deletion.
3. **Book soft delete/restore:** `modules/books/application/book-lifecycle.service.ts` has same distinction; ensure query hides facts when book trashed.
4. **Merge:** `character-merge.service.ts` `applyPlan()` _currently deletes duplicate book appearances first_, then repoints nonoverlaps. Must reparent facts for overlapping books BEFORE `deleteBookCharacters` inside the SAME transaction; `onDelete: Cascade` otherwise deletes them. Extend domain plan, repository, counts preview and result with facts. The current advisory lock in `character-merge.repository.ts` serializes merges, **not ordinary fact writers**: fact writes and merge need coordinated parent-row locking / equivalent serialization with deterministic order. `@updatedAt` could change on a Prisma FK update: explicitly preserve timestamps during reparenting and verify DB values. A loser's in-flight create must either commit before transfer and be included, or fail safely; never return success then cascade it away.
5. **Portability:** `packages/shared/src/character-portability.ts` uses strict `formatVersion=1`, `BundleAppearanceSchema` has no facts. `domain/character-portability.ts` plans/imports appearances with newly generated ids; `infrastructure/character-portability.repository.ts` bulk-inserts book appearances and roles; `application/character-portability.service.ts` upgrades legacy bundles + imports transactionally. Design v1->v2 normalization without breaking existing legacy upgrades; v2 includes facts nested under appearance. Insert facts after parents, within same transaction. Skip missing-book facts with missing appearance. Put numeric count/byte limits in the shared contract with tooLarge reporting. **HTTP limitation:** `apps/api/src/bootstrap.ts` currently has `JSON_BODY_LIMIT = "1mb"`; test export→import at HTTP level and address size mismatch with scoped, reviewable approach rather than altering all API request limits. Existing `CharacterImportCreatedSchema` / `CharacterImportSkippedSchema` must be updated consistently.
6. **Spoilers:** character details have special mask/reveal fields and reading windows. Facts have **no** per-fact masks. Preserve all existing spoiler fields and check exposure across global/book/smart contexts; never attach fact data to unscoped global details.
7. **Route state:** `character-context-select.tsx` currently calls `getCharacterDetailsPath` without tab; `character-details-context.ts` canonicalizes and smart mode redirects. Both require coherent `tab=facts` support. Clear q on book switch, not active tab.
8. **Schema impacts:** `CharacterMergeCountsSchema` and import created/skipped result schemas are consumed by controllers, generated clients, snapshots and fixtures. Update entire blast radius, not just changed backend source.
9. **Prisma migration:** follow `.claude/skills/db-migrate` and `migration-reviewer`; check SQL `DROP INDEX` against repo `CLAUDE.md` raw-SQL-index trap. Never use `db push` as a shortcut. Migrate only intended safe local DB context.
10. **Existing changes:** other ongoing character form/spoiler refactors may already have modified files in worktree; no blind replacement of components, no forced git reset/checkout.
11. **UI slice seam:** read-only preview cards are S5; **overflow detection + `Читати повністю` trigger + functional modal are one S6 deliverable**, so S5 does not ship a dead button. Create/edit/delete and navigation guard also in S6; do not make temporary dummy handlers.
12. **Subagent/token trap:** `.claude/skills/spec-to-ship/SKILL.md` is authoritative. Do not write a second task runner, repeat the full ZIP to every agent, or skip mandated per-slice review/gates for cost reasons. Use `tasks.json` + short `progress.md` pointers to resume sessions.

## Project-native tools (prefer over custom orchestration)

- `CLAUDE.md` for all repo conventions and no-commit/push rule.
- `.claude/skills/spec-to-ship/SKILL.md` — verified spec → `tasks.json` → implementation slices → reviews → completeness/gates.
- `.claude/skills/blast-radius/SKILL.md` — contract/prisma/repository consumer audit; narrow tests + broad when needed.
- `.claude/skills/db-migrate/SKILL.md` — migration workflow and review.
- `.claude/agents/spec-auditor.md`, `backend-engineer.md`, `frontend-engineer.md`, `migration-reviewer.md`, `security-reviewer.md`, frontend/backend test engineer agents — delegate narrowly as justified.

All paths/symbols must be re-confirmed against worktree; generated files can change after endpoint generation.

## v2 implementation verification anchors

- `apps/api/src/bootstrap.ts` currently sets `JSON_BODY_LIMIT = "1mb"`; do not mistake a passing in-memory serializer test for working user export/import.
- `apps/api/src/modules/characters/infrastructure/character-merge.repository.ts` includes a merge-scoped advisory lock but `CharacterFact` is a new writer; make the lock protocol shared or otherwise prove synchronization with parent-row locks.
- Preserve fact `updatedAt` when changing only FK; Prisma `@updatedAt` behavior needs explicit verification.
- `.claude/skills/spec-to-ship/SKILL.md` requires checks/reviews per stage. Optimization means **less redundant context**, not skipped mandatory gates.

---

<!-- file: 03_IMPLEMENTATION_SLICES.md -->

# Implementation sequencing (planning input for repo `spec-to-ship`, optimized v2)

This is a **dependency map**, NOT an alternative to `spec-to-ship/tasks.json`. Let the repo's `spec-auditor` PLAN create atomic `tasks.json` with `layer`, `files`, `dependsOn`, `mandatory`, `doneWhen` and evidence. Do not treat listed stage numbers as separate Claude sessions or require all agents for each step. Each slice must finish green before continuing.

## S0 — Preflight (no code)

- Confirm actual worktree branch, HEAD, git status, package scripts, existing partial implementations. Never switch branch or clobber changes.
- Verify all 20 decisions against actual code, map files/symbols and note drift, use `spec-auditor` PLAN, generate `tasks.json`, resolve only genuine blockers.
- Verify current `CLAUDE.md`, skills and i18n structure; record baseline and risks from integration map.
- Initialize `docs/specs/character-facts/progress.md` **as a short handoff pointer** (HEAD, worktree dirty files, stage, done task IDs, gate results, blockers, next action); `tasks.json` remains authoritative. Update after green slices, not after every edit.
- **Gate:** No unowned task, no open blocker, no unaccounted local changes. Spec-to-ship stage 0–3 complete.

## S1 — Model / shared contract / migration (D01–D03, D07, D15, D16, D20)

- Add `CharacterFact` Prisma entity to `BookCharacter`, `onDelete: Cascade`, stable-order index, appropriate search strategy and reviewed migration, no legacy data backfill.
- Add shared Zod create/update/view/page list/search query schemas and invariants. 120-char required title; 5000-char required text; chapter <=100; valid page; 20 page size; no spoiler-specific fields.
- Scope fact relations only to valid owned book character; choose repository ordering semantics and transaction-safe deletes.
- **Gate:** migration reviewed, generated Prisma types, shared builds, DTO tests; no destructive changes or accidental SQL-index drops.

## S2 — Backend CRUD + search + OpenAPI (D01–D03, D07, D12–D16, D20)

- Add fact repository/application/controller using existing `characters.module.ts`, book/character access asserters and reading-context conventions.
- Implement scoped list (server search title/text, q normalize, stable pagination and total count), create, update, delete, fetch if needed for dialog.
- Ensure factId is always constrained by current bookCharacter/user; missing/deleted/foreign entities do not leak content. Validate page boundaries server-side; enforce mutation throttling if consistent.
- Swagger/DTO generation, run `pnpm --filter @app/shared build`, `pnpm gen:api`, then depend on generated web client.
- **Gate:** backend CRUD integration + ownership + search/pagination tests passing; no hand-written web fetch/Orval files.

## S3 — Lifecycle + merge safety (D12, D15, D18)

- Extend unlink/deletion preview impact counts; prepare API count for unlink dialog; soft delete retains fact rows.
- Extend merge plan and repo to count/reparent overlapping-book facts transactionally BEFORE loser BookCharacter deletion. On nonoverlap preserve FK; no dedupe.
- **Atomicity/concurrency:** fact writers and merging transaction must coordinate locks on the same `BookCharacter` parent rows (or proven-equivalent protocol); sorted lock acquisition for multi-row operations; protect scoped authorization and mutations in transaction. The existing merge-only advisory lock does not protect concurrent fact CRUD on its own.
- **Timestamp integrity:** verify that FK-only reparenting preserves `createdAt` AND `updatedAt` exactly even with Prisma `@updatedAt`; use a safe explicit persistence strategy rather than relying on ORM defaults.
- Extend merge preview/result Zod DTOs and update generated client/consumers and fixtures. Use controlled concurrent create/update vs merge test barriers; include rollback and post-merge 404/409 safely handled.
- **Gate:** hard unlink deletes dependent facts with warning support; soft restore retains; no successful concurrent fact creation is silently lost; merge does not alter original timestamps.

## S4 — Import/export v2 (D19)

- Extend appearance export to nested facts. Increment `CharacterBundle` format to 2, accept/upgrade v1 including pre-existing legacy shapes. Version-aware strict Zod validation, with **documented numeric** per-appearance and per-bundle total fact limits in `packages/shared` and distinct invalid vs tooLarge errors.
- **Transport trap:** current JSON API limit in `apps/api/src/bootstrap.ts` is `1mb`; do an HTTP payload-size preflight with a fact-rich bundle. Don't globally increase JSON size limit without review. If v2 export is too big to re-import, provide safe scoped behavior or surface the blocker; never silently drop records.
- Plan/import facts with fresh UUIDs mapped to new `BookCharacter` in one transaction; preserve original content/timestamps and report created/skipped count when book missing.
- Update result contracts, controllers, DTOs, tests, fixtures and Orval clients. No migrations of historical description.
- **Gate:** v1 fixture import, v2 round-trip **through actual import HTTP API**, count/size boundaries, invalid data rejection, missing-book skip, transaction rollback all verified.

## S5 — Character details tabs + read/list/search UX (D05–D11, D14, D16, D20)

- Add PageTabs Overview/Facts. Keep Hero/ContextSelect shared and **all** existing Overview/sidebar content intact. Add i18n label for `BookCharacter.description`.
- Integrate nuqs `tab` and `q` with existing character-routes/canonical/smart mode; preserve tab on book/global changes, clear q on book change, default Overview for different character.
- Add scoped `useInfiniteQuery` with `CHARACTER_FACTS_PAGE_SIZE=20`, stable search query keys, `InfiniteScrollFooter` and unchanged per-book item isolation.
- Add two-col/one-col fact **preview cards without a dead `Читати повністю` button**; loading/no-book/empty-search/error/retry, page metadata. The overflow trigger + full modal belong together in **S6**, not partly in S5.
- **Gate:** existing Overview and spoiler flows unchanged; direct URL/smart/global/book transitions and read-only Facts UI verified; no inactive/dummy control.

## S6 — Mutations/UI protections (D04, D06, D12, D13)

- Integrate shared modal create/edit form, proper title/text/page/chapter validation, **real clamp/overflow detection with `Читати повністю` trigger and the full-view dialog in the same slice**, single shared confirmation dialog for delete, inaccessible/non-owner handling.
- Dirty guard for buttons, X, Escape, outside click, context route change, browser reload/unload, SPA Back/Forward. No silent discard. Retain input on failed save.
- Correct React Query invalidations + counts after create/edit/delete, no stale flash, preserve ordering. Integrate server count into existing unlink dialog; preserve affordances.
- **Gate:** keyboard accessibility, focus, mutation errors, unsaved changes and responsive UI tested in actual browser. No isolated trigger or modal stub.

## S7 — Verification / audit / handoff (all D01–D20)

- Run `spec-auditor` VERIFY: every mandatory task `done` with proof from diff/tests; unexpected scope excluded or explained. Check `blast-radius` for changed shared/Prisma/API contracts.
- Run relevant tests plus repo required `pnpm typecheck`, `pnpm lint`, `pnpm format:check`; build shared and regenerate API, review diff and check migration; run broader integration as appropriate to contract changes. Run mandatory **per-slice** gates and reviewers exactly as `.claude/skills/spec-to-ship/SKILL.md` requires. Do not rerun unrelated full suites after every small edit unless scope/contract changes justify the cost.
- Verify actual API endpoint with authenticated test user and browser UI for mobile/desktop, including hard navigation / route changes and accessibility.
- Record final report: implementation, reuses, testing commands/results, migrations, known issues, baseline drift, and no unapproved commits/push. Update `progress.md` handoff once, pointing at verified `tasks.json` state rather than copying its contents.
- **Gate:** user can safely review the changes; no false success claims.

## Dependencies, do-not-expand rules

- S1 before S2; S2 before S3/S4/S5/S6. S3 and S4 are separate backend integration slices, may proceed after S2 when carefully isolated, but user-visible FE must consume regenerated contracts. S5 before S6. S7 last.
- The repo's `spec-to-ship` may adjust the order to leave worktree green, but may NOT drop any D01–D20 requirement.
- Avoid generalized frontend or backend refactors, extra design systems, new endpoint styles, new i18n frameworks, new caching frameworks, or new global character spoiler mechanics.
- Do not ask for approval on implementation details already settled. Escalate only hard conflicts that would alter approved product behavior or destroy data.

---

<!-- file: 04_ACCEPTANCE_AND_TESTS.md -->

# Acceptance checklist and targeted regression matrix (optimized v2)

`spec-to-ship` must turn these into `doneWhen` tests with proof. Results are NOT pre-claimed. Use existing Vitest/API test setup, RTL and relevant browser checks. Test owner and foreign-user contexts where required.

## Acceptance matrix

| ID  | Coverage                    | Must hold                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | Prisma & migration          | Fact FK points to BookCharacter; cascade only on physical parent deletion; no legacy columns/data destroyed; stable composite index; schema migrated safely.                                                                                                                                                                                                                                                                     |
| A02 | Validation                  | Title/text required after trim; limits title=120, text=5000, chapter=100; invalid/noninteger/negative/over-book-max page rejected FE and BE; optional chapter/page null handled.                                                                                                                                                                                                                                                 |
| A03 | CRUD                        | Create, edit, full read, confirmed delete succeed; invalid input rejected; failed mutations keep form/dialog/card; count updates; edited fact retains createdAt position.                                                                                                                                                                                                                                                        |
| A04 | Auth & ownership            | Unauthenticated, foreign-book, foreign-character, fact from another BookCharacter, deleted book or character rejected without payload disclosure; user cannot forge different book in request.                                                                                                                                                                                                                                   |
| A05 | Context                     | Book/global/smart mode behavior; no global cross-book fact feed; choose selected book only; existing reading-context safeguards and spoilers unaffected.                                                                                                                                                                                                                                                                         |
| A06 | Overview preservation       | Hero, appearance selector, BookSection/`description`, ProfileSection, FormsSection, mobile sections, sidebar, action menus and reveal functions still work; description label updated only.                                                                                                                                                                                                                                      |
| A07 | Tabs/routes                 | Default Overview; `?tab=facts` direct links/refresh; canonical/smart redirect preserves facts; switching book keeps tab and clears q; switching character defaults Overview; invalid book never shows another's data.                                                                                                                                                                                                            |
| A08 | Query/scoping               | 20 per request; server `q` searches title/text full dataset case-insensitively with normalized spaces; >=2 chars, 300ms; clear q; `(createdAt DESC,id DESC)` stable; new q resets to page 1.                                                                                                                                                                                                                                     |
| A09 | Endless scroll              | Auto-load next page; initial skeleton; incremental loader; partial failure keeps loaded facts, retry only failed page; exhausted list stops; swapping book doesn't flash old cards; no duplicate requests.                                                                                                                                                                                                                       |
| A10 | Empty/error states          | No facts + Add CTA, no selected book + select prompt, no hits + clear search, initial error + retry, next-page error + retry; errors not rendered as empty.                                                                                                                                                                                                                                                                      |
| A11 | Card/full dialog            | Desktop 2/mobile 1 cols; title/body clamps; chapter/page conditional; full-view action only on actual truncation and implemented **together with** working dialog (S6); no dead CTA in S5; mobile/keyboard/focus/a11y work.                                                                                                                                                                                                      |
| A12 | Unsaved work                | Dirty prompt via Cancel, X, Escape, outside, book change, SPA navigation, Back/Forward, unload. Choosing Stay retains input; choosing Discard exits; submit failure retains data; in-flight mutation not duplicated.                                                                                                                                                                                                             |
| A13 | Individual delete           | AlertDialog names fact, one instance per list, disabled while pending; deletion succeeds only after server confirms; failure preserves dialog and card; 404 refresh/consistent state.                                                                                                                                                                                                                                            |
| A14 | Unlink                      | Server-grounded count shown in existing confirmation; link removal cascades facts irreversibly; failed unlink leaves all; relinking doesn't resurrect; no warning that incorrectly says zero on failed count.                                                                                                                                                                                                                    |
| A15 | Soft delete/restore         | Soft-deleted character or book hides inaccessible facts; restore returns all facts; final purge removes facts via FK cascade.                                                                                                                                                                                                                                                                                                    |
| A16 | Merge nonoverlap            | Loser BookCharacter repointed; facts remain attached with same ids/timestamps/content; preview counts correct.                                                                                                                                                                                                                                                                                                                   |
| A17 | Merge overlap / concurrency | Facts from loser appearance moved to survivor appearance BEFORE loser deletion, inside one transaction; identical titles both retained; preview/result stats correct; induced failure rolls back fully. Concurrent fact create/update cannot commit successfully then be cascaded away, and stale writer returns safe error. Original createdAt **and updatedAt are unchanged** on FK-only reparent.                             |
| A18 | Portability v1              | Existing v1 and supported legacy fixtures import successfully, appearances without facts; historical description stays description; no created facts.                                                                                                                                                                                                                                                                            |
| A19 | Portability v2 / capacity   | Export nested facts per appearance; v2 import creates fresh fact ids/new BookCharacter link preserving fields/dates; skip missing-book facts with count; invalid versions/payloads rejected, failed transaction rolled back. Numeric per-appearance/total fact limits tested; overflows use `tooLarge`; actual HTTP v2 round-trip including payload near **1mb** verified or blocked explicitly; never silently truncate export. |
| A20 | Cross-cutting               | Existing generated API and shared contract consumers compile; uk/en i18n parity, dark/light, mobile, accessibility, standard UI, no unrelated behavior change, no commit/push.                                                                                                                                                                                                                                                   |

## Tests to add/update (look up actual current paths)

### Backend unit / integration

- Fact schema, mapper, repository/service/controller tests (CRUD, pagination/search, ownership, page limits, 404/403, soft deletion).
- `apps/api/src/modules/characters/api/book-character-reading-context.controller.test.ts` or new equivalent to prove book-scope rules.
- `apps/api/src/modules/characters/domain/character-merge.test.ts`, `application/character-merge.service.test.ts`, `api/character-merge.controller.test.ts`: overlap/nonoverlap counts, remap before delete, rollback, identical names. **DB-backed controlled interleaving** of fact create/update and merge (lock acquisition and safe 404/409 outcome), and exact `updatedAt`/`createdAt` equality after reparent; mocks alone cannot establish these guarantees.
- `apps/api/src/modules/characters/domain/character-portability.test.ts`, `api/character-portability.controller.test.ts`: v1 fixtures, v2 round-trip, strict validation, missing book skip, **numeric per-appearance and total limits (limit, limit+1)**, tooLarge reporting, timestamp preservation, and **real HTTP JSON payload** near/over current `1mb` transport limit. If endpoint needs scoped capacity change, add a regression test that unrelated JSON routes keep original limits.
- `apps/api/src/modules/characters/api/character-trash.controller.test.ts`, existing book trash cases, unlink controller tests: soft/hard parent lifecycle and cascade.
- `apps/api/src/core/database/raw-sql-indexes.test.ts` must remain green after reviewed migration.

### Frontend unit / UI

- `apps/web/src/features/characters/components/character-details-page.test.tsx` (overview and tabs across contexts; old behavior still works).
- New facts tab/card/dialog tests, React Query mutation hooks and `character-keys.test.ts` for isolation/invalidations.
- Refer to `apps/web/src/features/notes/components/note-form-dialog.test.tsx`, `note-full-view-dialog.test.tsx`, `notes-archive-content.test.tsx` as test patterns.
- Dirty guard interaction and route navigation tests, including Back/Forward, browser unload where possible, and honest manual browser validation when jsdom cannot model Next router lifecycle.
- Responsive breakpoints, keyboard focus, ARIA and actual overflow detection for “Читати повністю”; S5 must have no fake click handler, and S6 ships trigger plus modal in the same green slice.

## Verification commands (follow actual `CLAUDE.md` and skill gates)

```bash
pnpm --filter @app/shared build
pnpm gen:api
pnpm typecheck
pnpm lint
pnpm format:check
```

Run backend focused tests **from `apps/api`**, e.g. `(cd apps/api && pnpm exec vitest run src/modules/characters/domain/character-merge.test.ts)`; frontend unit tests use `pnpm --filter @app/web exec vitest --project unit run <target>`. Broaden regression suites as `blast-radius` directs for shared/Prisma/API changes. **Do not waive per-slice typecheck/lint or mandated reviewers** merely to save tokens; prefer minimal relevant subagent context, focused tests during small slices, and broad gates only when their triggers apply. Do not invent green results if the database/browser isn't available. Compare generated API diff for unexpected changes.

Review migration SQL with `migration-reviewer`, never `db push` and never run unapproved destructive/shared/prod migrations. `pnpm --filter @app/api db:migrate --name <snake_case>` uses repo's create-only workflow; review SQL before deployment. The application can use safe local testing as permitted by its environment and repository rules.

## Final report required from Claude Code

1. Exact worktree/commit used; whether baseline drift was found.
2. Tasks completed D01–D20, which components were reused and any intentional deviations.
3. Database migration files and data-preservation evidence; merge and import/export round-trip results.
4. Executed commands/tests with pass/fail counts, API/browser checks and proof; unavailable gates explicitly marked.
5. Unresolved issues and scope exclusions; confirm no commit/push performed without consent.
6. `docs/specs/character-facts/progress.md` checkpoint: exact HEAD/worktree status, task IDs complete/pending, last reliable gate results, blocker and next action; do not duplicate `tasks.json`.

**Acceptance condition:** every mandatory task has evidence, no missing requirements, no unresolved high severity security/data-loss defect, and tests reflect actual execution, not expectation.

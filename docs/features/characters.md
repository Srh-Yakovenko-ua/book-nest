# Characters

**Status**: active (backend Phase 1 — frontend not built yet)
**Last updated**: 2026-07-18
**Curator**: feature-context-curator

The Characters feature lets an authenticated user build a per-user cast of book characters: a stable character identity that can appear in many books, with per-book profiles, aliases, roles, POV, tags, field-level spoiler control, duplicate detection, series aggregation, and a soft-delete trash with a delayed purge. Only the backend shipped so far. It spans a single feature-sliced NestJS module (`apps/api/src/modules/characters/`) plus the shared Zod contracts in `packages/shared/src/characters.ts`. It implements Phase 1 (Must) of the spec at `apps/api/md/booknest-characters-implementation-v2/02-scope-and-phases.md`.

This is a backend-only doc at this stage. There is no `apps/web/src/features/characters/` slice and no Orval-generated client wired for it yet — the Frontend sections below record that the FE is not implemented and point at the spec.

## Purpose

Model a character once (stable identity) and describe how that same character appears across many owned books, while never leaking a spoiler in any list, search, roster, suggestion or series aggregate. A character is created globally (optionally with a first book appearance), or created/linked directly inside a book. Every list surface is server-side spoiler-redacted; only the detail surfaces return the full values plus the per-field spoiler flags so the owner can self-reveal in the UI.

## User-visible behavior

There is no UI yet. The intended Phase 1 surface (see the spec) is a `Персонажі` tab in the book-details page with a searchable/filterable roster, a details sheet, an add-new/add-existing flow with duplicate suggestions, a two-section form (global fields / this-book fields) with spoiler toggles, and a command-palette global search. None of that exists in `apps/web` at the time of writing.

What the backend enforces as observable contract:

- Every character, book, media, alias book, tag and series id is owner-checked; a foreign or missing id returns 404 (409 when a link already exists) with a stable machine error code.
- List/search/roster/suggestion/series-aggregate responses are spoiler-safe: flagged field values are omitted, their names collected into `hiddenFields`, appearances flagged `hidePresenceAsSpoiler` are excluded, and hidden aliases / display names are matched by search only when `includeSpoilerSearch=true`.
- Detail responses (`GET .../:characterId`) return full values plus each `*IsSpoiler` boolean so the owner can reveal per field.
- Delete is a two-step trash: `DELETE ?confirm=true` soft-deletes and returns a `purgeAt` 30 days out; `POST .../restore` cancels the purge; a delayed BullMQ job hard-deletes and reclaims orphaned media after the window.

## HTTP API

All endpoints require a valid access token (`JwtAccessGuard`, `@ApiBearerAuth`). Request bodies/queries are validated by `ZodBodyPipe` / `ZodQueryPipe`; a failed body/query parse returns 400. Service-thrown `ValidationError` (custom-gender rule) returns 422. `ConflictError` returns 409, `NotFoundError` 404. Write routes are `@Throttle`d (60 requests / 60s).

### `@Controller("api/characters")` — `api/characters.controller.ts`

| Method | Path                                            | Success | Errors        | Request schema                            | Response                                |
| ------ | ----------------------------------------------- | ------- | ------------- | ----------------------------------------- | --------------------------------------- |
| POST   | `/api/characters`                               | 201     | 400, 401, 404 | `CreateCharacterSchema`                   | `CharacterDetailsView`                  |
| GET    | `/api/characters`                               | 200     | 401, 404      | `CharactersListQuerySchema`               | `Paginator<CharacterGlobalSummaryView>` |
| GET    | `/api/characters/duplicate-candidates`          | 200     | 401, 404      | `CharacterDuplicateCandidatesQuerySchema` | `CharacterDuplicateCandidatesView`      |
| GET    | `/api/characters/:characterId`                  | 200     | 401, 404      | `:characterId` `ParseUUIDPipe`            | `CharacterDetailsView`                  |
| GET    | `/api/characters/:characterId/deletion-preview` | 200     | 401, 404      | `:characterId` `ParseUUIDPipe`            | `CharacterDeletionPreview`              |
| PATCH  | `/api/characters/:characterId`                  | 200     | 400, 401, 404 | `UpdateCharacterSchema`                   | `CharacterDetailsView`                  |
| DELETE | `/api/characters/:characterId?confirm=true`     | 200     | 400, 401, 404 | `DeleteCharacterQuerySchema`              | `CharacterDeletionResult`               |
| POST   | `/api/characters/:characterId/restore`          | 200     | 401, 404      | `:characterId` `ParseUUIDPipe`            | `CharacterDetailsView`                  |

`GET /api/characters` is the global spoiler-safe summary list that also backs the planned command-palette search: `q` free-text (name/alias/displayName, spoiler-aware), multi-value `role`/`importance`/`species`/`gender`/`attitude`, `favorite`, `archived`, `sort` (`name` | `recently_added` | `recently_updated`), `contextBookId` (masks the character behind a `hidePresenceAsSpoiler` appearance in that book), and `includeSpoilerSearch`.

`DELETE` requires `?confirm=true` — `DeleteCharacterQuerySchema` is `z.object({ confirm: z.literal("true") })` (`packages/shared/src/characters.ts:309`), so a missing/other value is a 400 before the service runs.

### `@Controller("api/books/:bookId/characters")` — `api/book-characters.controller.ts`

| Method | Path                                         | Success | Errors             | Request schema                | Response                          |
| ------ | -------------------------------------------- | ------- | ------------------ | ----------------------------- | --------------------------------- |
| GET    | `/api/books/:bookId/characters`              | 200     | 401, 404           | `BookCharactersQuerySchema`   | `Paginator<CharacterSummaryView>` |
| POST   | `/api/books/:bookId/characters`              | 201     | 400, 401, 404, 409 | `CreateCharacterInBookSchema` | `CharacterDetailsView`            |
| GET    | `/api/books/:bookId/characters/:characterId` | 200     | 401, 404           | `ParseUUIDPipe` x2            | `CharacterDetailsView`            |
| PATCH  | `/api/books/:bookId/characters/:characterId` | 200     | 400, 401, 404      | `UpdateBookCharacterSchema`   | `CharacterDetailsView`            |
| DELETE | `/api/books/:bookId/characters/:characterId` | 204     | 401, 404           | `ParseUUIDPipe` x2            | —                                 |

`POST` takes a discriminated union on `mode` (`CreateCharacterInBookSchema`, `characters.ts:210`): `{ mode: "new", character, bookProfile }` creates a fresh character and its appearance; `{ mode: "existing", characterId, bookProfile }` links an owned character, returning 409 if it is already linked to that book. `DELETE` unlinks (removes the `BookCharacter` appearance and its book-scoped aliases) but keeps the global character.

### `@Controller("api/books/:bookId/character-suggestions")` — `api/book-character-suggestions.controller.ts`

| Method | Path                                       | Success | Errors   | Request schema                    | Response                   |
| ------ | ------------------------------------------ | ------- | -------- | --------------------------------- | -------------------------- |
| GET    | `/api/books/:bookId/character-suggestions` | 200     | 401, 404 | `CharacterSuggestionsQuerySchema` | `CharacterSuggestionsView` |

Returns owned characters not yet linked to the book, same-series first (`limit` default 10, max 50).

### `@Controller("api/series/:seriesId/characters")` — `api/series-characters.controller.ts`

| Method | Path                               | Success | Errors   | Request schema                | Response                          |
| ------ | ---------------------------------- | ------- | -------- | ----------------------------- | --------------------------------- |
| GET    | `/api/series/:seriesId/characters` | 200     | 401, 404 | `SeriesCharactersQuerySchema` | `Paginator<CharacterSummaryView>` |

Aggregates distinct characters across the series' books. `contextBookId` + `includeFuture` control how far into the series the reader has progressed so later-book appearances are masked by default (spoiler-by-progress). Sort is `name` | `importance`.

## Spoiler-safety model (the core of the feature)

This is the novel-to-this-codebase part. Redaction is a server concern, applied by two families of mapper in `domain/character.mapper.ts`. A summary mapper redacts; a details mapper returns full values plus the flags.

Eight boolean spoiler columns live on `BookCharacter`: seven per-field redaction flags — `displayNameIsSpoiler`, `statusIsSpoiler`, `descriptionIsSpoiler`, `personalImpressionIsSpoiler`, `appearanceNotesIsSpoiler`, `speciesOverrideIsSpoiler`, `portraitIsSpoiler` (the `SpoilerFlags` type, `character.mapper.ts:97-105`) — plus `hidePresenceAsSpoiler`, which hides the whole appearance rather than a field.

Three redaction layers:

1. Query-level exclusion (`infrastructure/characters.repository.ts`). Roster and series queries filter `hidePresenceAsSpoiler: false` (`buildRosterWhere`, `:737`; `listSeriesAppearances`, `:473`). The global list, when `contextBookId` is set, excludes characters whose appearance in that book hides its presence (`buildGlobalCharacterWhere`, `:696-699`). Free-text search matches hidden aliases and hidden display names only when `includeSpoilerSearch=true` — otherwise the alias/displayName sub-conditions carry `isSpoiler: false` / `displayNameIsSpoiler: false` (`buildGlobalCharacterWhere:688-716`, `listSeriesAppearances:475-482`, `buildRosterWhere:739-745`, `listSuggestions:523-529`).

2. Summary redaction (`toCharacterSummaryView`, `character.mapper.ts:233`). For roster and series rows it omits `displayName` when `displayNameIsSpoiler`, nulls `portrait` when `portraitIsSpoiler`, nulls `status` when `statusIsSpoiler`, and lists those hidden field names in `hiddenFields` (`computeSummaryHiddenFields`, `:285` — three fields). The global list and suggestions/duplicates use `toCharacterGlobalSummaryView` (`:204`), which carries no book-scoped fields at all (only the global identity fields + `appearanceCount`), so it is inherently spoiler-safe.

3. Details self-reveal (`toCharacterDetailsView`, `:168` + `toBookCharacterView`, `:121`). Detail responses return the full field values and every `*IsSpoiler` boolean, and additionally compute a per-appearance `hiddenFields` list (`computeHiddenFields`, `:259` — seven fields) plus a character-level union of all appearances' hidden fields (`toCharacterDetailsView:177-178`). The client decides whether to blur; the server does not withhold on the detail route.

POV is modeled on the appearance, not as a role: `isPovCharacter` + `narratorType` on `BookCharacter`, and `BookCharacterRoleTypeSchema` (`characters.ts:106`) deliberately excludes any `narrator` / `point_of_view` member (`protagonist` | `deuteragonist` | `antagonist` | `love_interest` | `supporting` | `episodic` | `mentioned` | `custom`).

## End-to-end data flow

### Create a global character with a first appearance (`POST /api/characters`)

1. `JwtAccessGuard` authenticates; `@CurrentUser()` injects the user; `ZodBodyPipe(CreateCharacterSchema)` validates the body → `api/characters.controller.ts:83-88`.
2. `CharactersService.createGlobalCharacter` runs → `application/characters.service.ts:122`. If `firstAppearance` is present, the target book is owner-checked first (`assertBookOwned` → `booksRepository.existsOwned`, `:596-603`).
3. `buildCharacterData` shapes the row and dedupes aliases (`:776`); the whole write is wrapped in `TransactionRunner.run` (`:131`).
4. Inside the transaction: `assertMediaOwned` for the avatar (`:605`, remaps a media 404 to code `media_ownership_mismatch`), `assertAliasBooksOwned` for every alias `bookId` (`:580`), then `charactersRepository.createCharacter` nested-writes the character + aliases (`infrastructure/characters.repository.ts:262`).
5. If `firstAppearance` is present: `buildBookCharacterData` (`:650`) shapes the appearance, `assertMediaOwned` for the portrait, and `insertBookCharacter` (`:905`) calls `createBookCharacter` (repo `:252`, nested-writes roles); a unique-constraint hit becomes `ConflictError` code `character_already_linked_to_book`.
6. `loadDetails` re-reads via `findOwnedCharacterDetails` (repo `:405`, the `detailsInclude` graph) → `toDetailsView` maps it to `CharacterDetailsView` (`:998`, portrait/avatar media views via `MediaService.buildView`).
7. Controller returns 201 with the `CharacterDetailsView`.

### Soft-delete then purge (`DELETE ?confirm=true` → BullMQ)

1. `softDelete` sets `deletedAt = now` via `charactersRepository.softDelete` (`updateMany where deletedAt: null`, repo `:610`); a zero count means already-gone → 404 (`service:422-433`).
2. `enqueuePurge` removes any existing job then adds a `character-purge` job delayed `CHARACTER_PURGE_WINDOW_MS` with `jobId = characterId` (`:892-903`). It returns `{ characterId, deletedAt, purgeAt }` where `purgeAt = deletedAt + 30 days` (`addMilliseconds`, `:438`).
3. `POST .../restore` flips `deletedAt` back to null (repo `restore`, `:599`), then `cancelPurge` removes the job by `characterId` (`:884`) — cancel-on-restore.
4. When the delay elapses, `CharacterPurgeProcessor.process` parses the job with `CharacterPurgeJobSchema` and calls `charactersService.purge` (`application/character-purge.processor.ts:14-17`).
5. `purge` re-reads via `findForPurge`; if `deletedAt` is null it returns early (the character was restored). Otherwise it collects avatar + portrait media ids, `hardDeleteIfDeleted` (`deleteMany where deletedAt: { not: null }`, repo `:421`), then for each media calls `MediaService.deleteIfUnreferenced` to reclaim orphans (`service:386-405`). Cascade deletes drop aliases, appearances, roles and tag joins.

## Backend module (feature-sliced NestJS)

Module: `characters.module.ts`. Wired into `app.module.ts:66`. Imports `AuthModule`, `BooksModule`, `MediaModule`, `TagsModule`, and registers the BullMQ queue `character-purge`. Providers: `CharactersService`, `CharactersRepository`, `CharacterPurgeProcessor`.

### Controllers (`api/`)

Four controllers, all `@UseGuards(JwtAccessGuard)`, all delegating to `CharactersService`, all `createZodDto`-backed Swagger via the `input-dto/` and `view-dto/` classes:

- `characters.controller.ts` — the eight global routes (see HTTP API).
- `book-characters.controller.ts` — the five book-scoped routes.
- `book-character-suggestions.controller.ts` — the suggestions route.
- `series-characters.controller.ts` — the series aggregate route.

### Service (`application/characters.service.ts`)

One `CharactersService` holds all business logic. It injects `CharactersRepository`, `BooksRepository`, `MediaService`, `TagsService`, `TransactionRunner`, and the `character-purge` `Queue` (`:88-97`). It never injects `PrismaService`; every multi-write flow runs inside `TransactionRunner.run`.

- Command handlers: `createGlobalCharacter` (`:122`), `createInBook` (`:152`), `updateGlobal` (`:532`), `updateBook` (`:469`), `unlink` (`:442`), `softDelete` (`:422`), `restore` (`:407`), `purge` (`:386`).
- Query handlers: `getCharacterDetails` (`:260`), `getBookCharacterDetails` (`:243`), `listGlobal` (`:293`), `listBookRoster` (`:268`), `listSeriesCharacters` (`:323`), `bookCharacterSuggestions` (`:99`), `duplicateCandidates` (`:190`), `deletionPreview` (`:176`).
- Ownership guards: `assertBookOwned` (`:596`), `assertMediaOwned` (`:605`), `assertSeriesOwned` (`:621`), `assertTagsOwned` (`:634`), `assertAliasBooksOwned` (`:580`). Each remaps the underlying 404 to a feature-specific `CHARACTER_ERROR_CODES` code.
- Mapping to DTOs happens through the domain mappers (`toDetailsView` `:998`, `toSummaryView` `:1036`, `toGlobalSummaryView` `:1028`); media views are built defensively (`mediaViewOf`, `:944`, logs and nulls on failure rather than throwing).
- `PATCH` global vs `PATCH` book are separated on purpose: `UpdateCharacterSchema` and `UpdateBookCharacterSchema` are both `.strict()`, so sending a book-scoped field to the global route (or vice versa) fails validation with 400. The custom-gender invariant is re-checked server-side in `buildCharacterUpdateData` and throws `ValidationError` code `validation_failed` (`:829`).

### Repository (`infrastructure/characters.repository.ts`)

The only Prisma layer. Injects `PrismaService`; every method takes an optional trailing `client: Prisma.TransactionClient = this.prisma` so a service-owned transaction threads through. It defines the four `include`/`select` shapes at the top (`detailsInclude` `:10`, `rosterInclude` `:22`, `globalSummaryInclude` `:29`, `seriesAppearanceInclude` `:34`, `purgeSelect` `:42`) and the sort map `GLOBAL_CHARACTER_ORDER_BY` (`:48`). The two `where`-builder helpers (`buildGlobalCharacterWhere` `:640`, `buildRosterWhere` `:728`) hold the spoiler-aware query predicates. It returns Prisma model rows / counts / primitives — never a ViewModel.

### Domain (`domain/`)

- `character.mapper.ts` — the summary/details mappers and the `computeHiddenFields` / `computeSummaryHiddenFields` redaction helpers described above.
- `series-representative.ts` — pure functions for the series aggregate: `resolveAllowedBookIds` (context-book + `includeFuture` masking, `:71`), `pickSeriesRepresentatives` (one appearance per character, context-book-first then highest part number then newest, `:42`), `sortSeriesSummaries` (`:92`).
- `character-purge.ts` — queue/job names, `CHARACTER_PURGE_WINDOW_DAYS = 30` (`:7`), `CHARACTER_PURGE_WINDOW_MS`, and `CharacterPurgeJobSchema`.
- `character-fields.ts` — `emptyToNull` (trims and collapses empty strings to `null`, so no all-blank stored values).

### Processor (`application/character-purge.processor.ts`)

`CharacterPurgeProcessor extends WorkerHost`, `@Processor("character-purge")`. Zod-parses the job payload and delegates to `charactersService.purge`.

### Models (`apps/api/prisma/schema.prisma`)

Five models, snake_case columns via `@map`/`@@map`, UUID PKs, all user data `onDelete: Cascade` from `Character`:

- `Character` (`:740`, `@@map("characters")`) — the stable identity. `userId`, `name` + `normalizedName`, `entityKind`, `species`, `gender` + `customGender`, `pronouns`, `neutralDescription`, `avatarMediaId` (FK `onDelete: SetNull`), `isFavorite`, `globalAttitude`, `archivedAt`, `deletedAt` (soft-delete), timestamps. Indexed on `userId` and the filter columns.
- `CharacterAlias` (`:773`, `@@map("character_aliases")`) — name/normalizedName/type, optional `bookId` (global alias when null), `isSpoiler`, `position`. Unique `(characterId, bookId, normalizedName, type)`.
- `BookCharacter` (`:793`, `@@map("book_characters")`) — the per-book appearance carrying the profile fields, POV (`isPovCharacter`, `narratorType`), `portraitMediaId` (FK `onDelete: SetNull`), the eight spoiler booleans, `sortOrder`. Unique `(bookId, characterId)` (one appearance per book).
- `BookCharacterRole` (`:837`, `@@map("book_character_roles")`) — `roleType` + optional `customRole`, `isSpoiler`, `position`. Unique `(bookCharacterId, roleType, customRole)`.
- `CharacterTag` (`:853`, `@@map("character_tags")`) — join to the existing per-user `Tag` (reused, no new tag table). Composite PK `(characterId, tagId)`.

Two migrations: `apps/api/prisma/migrations/20260717190841_characters_core/` and `20260717202056_add_character_tags/`.

## Shared contracts

Location: `packages/shared/src/characters.ts`, re-exported by the barrel (`index.ts:7`). Both apps import from `@app/shared`. Any change here is a breaking FE↔BE contract change once the FE exists.

- Request DTOs: `CreateCharacterSchema` (`:198`), `CreateCharacterInBookSchema` (discriminated union, `:210`), `UpdateCharacterSchema` (`.strict()`, `:234`), `UpdateBookCharacterSchema` (`.strict()`, includes `tagIds`, `:261`). Building blocks: `CharacterInputSchema` (`:141`, superRefine for custom gender) and `BookCharacterProfileInputSchema` (`:167`, all profile fields + the eight spoiler flags + POV).
- Query DTOs: `CharactersListQuerySchema` (`:430`), `BookCharactersQuerySchema` (`:296`), `SeriesCharactersQuerySchema` (`:480`), `CharacterSuggestionsQuerySchema` (`:464`), `CharacterDuplicateCandidatesQuerySchema` (`:453`), `DeleteCharacterQuerySchema` (`:309`).
- Response DTOs: `CharacterDetailsViewSchema` (`:386`, full values + `hiddenFields` + `appearances[]`), `BookCharacterViewSchema` (`:349`, per-field values + flags + `hiddenFields`), `CharacterSummaryViewSchema` (redacted roster/series row, `:408`), `CharacterGlobalSummaryViewSchema` (`:496`, book-scoped-field-free), `CharacterDeletionResultSchema` (`:315`), `CharacterDeletionPreviewSchema` (`:323`), plus `CharacterDuplicateCandidatesViewSchema` (`:518`) and `CharacterSuggestionsViewSchema` (`:526`).
- Enums: `CharacterEntityKindSchema`, `CharacterGenderSchema`, `CharacterAttitudeSchema`, `CharacterAliasTypeSchema`, `BookCharacterImportanceSchema`, `BookCharacterStatusSchema`, `BookCharacterNarratorTypeSchema`, `BookCharacterRoleTypeSchema`, `CharacterListSortSchema`, `SeriesCharactersSortSchema`.
- `CHARACTER_ERROR_CODES` (`:25`) — the stable machine error codes surfaced through `HttpError`: `character_already_linked_to_book` (409), `character_book_not_found`, `media_ownership_mismatch`, `character_not_found`, `character_ownership_mismatch`, `character_series_not_found`, `character_tag_not_found` (all 404), `validation_failed` (422).
- Limits: name max 200, long text max 5000, aliases max 30, roles max 20, tags max 15, default page size 20.

## Frontend

Not implemented. There is no `apps/web/src/features/characters/` slice, no route, no hooks, and no Orval-generated client for these endpoints yet. Phase 1 FE (book-details `Персонажі` tab, roster + details sheet, add existing/new flow with duplicate suggestions, two-section form with spoiler toggles, command-palette search) is specified but unbuilt — see `apps/api/md/booknest-characters-implementation-v2/02-scope-and-phases.md` (Фаза 1, Frontend) and `.../features/09-quick-capture.md`, `.../features/10-command-palette-search.md`, `.../features/11-undo-trash.md`.

When the FE lands it should consume the generated hooks (run `pnpm gen:api` after the OpenAPI regenerates), not hand-roll fetch/Zod against `@app/shared`.

## Tests

Backend (Vitest, integration via `createTestApp`, plus one pure-domain unit suite):

- `apps/api/src/modules/characters/api/characters.controller.test.ts` — create global / create-in-book (new + existing), get, update global + book, unlink, ownership and validation paths.
- `apps/api/src/modules/characters/api/characters-discovery.controller.test.ts` — global spoiler-safe list (filters, spoiler-aware `q`, archived, context-book presence masking, pagination, cross-user isolation), roster spoiler search, duplicate candidates, book suggestions (same-series first, 404 on foreign book), and the series aggregate (context/future masking, presence hiding, foreign series 404).
- `apps/api/src/modules/characters/api/character-trash.controller.test.ts` — soft delete, restore, deletion-preview, and purge behavior.
- `apps/api/src/modules/characters/application/character-purge.processor.test.ts` — the purge processor.
- `apps/api/src/modules/characters/domain/series-representative.test.ts` — pure unit tests for `resolveAllowedBookIds` / `pickSeriesRepresentatives` / `sortSeriesSummaries`.

No frontend tests yet — there is no frontend.

## Known gaps / deferred

- No frontend. Backend-only Phase 1; the entire UI (book-details tab, roster, form, command palette, undo/trash UX, quick-capture) is unbuilt.
- Purge durability depends on Redis. `enqueuePurge` and `cancelPurge` wrap the BullMQ calls in try/catch that only logs a warning (`characters.service.ts:884-903`). If Redis is down when a character is soft-deleted, the delete still returns 200 but no purge is ever scheduled; if Redis is down on restore, a stale purge job may survive. A future reconciliation sweep is the intended durability backstop.
- Count/delete micro-race in purge. `findForPurge` (the `deletedAt`-null early return) and `hardDeleteIfDeleted` are separate statements, and `deletionPreview` counts are computed outside any lock, so a concurrent restore/edit between them can skew a preview count or race the hard delete. Benign today (the `deleteMany` guard is idempotent) and slated for the same reconciliation sweep.
- Non-transactional media cleanup. Orphaned-media reclamation runs after the hard delete, one `deleteIfUnreferenced` per media, each in its own try/catch (`characters.service.ts:398-404`); a failure only logs and leaves the media row.
- Phase 2 (Should) — not built: reading-mode spoiler-lock, series `Станом на книгу` context selector UX, character arc (importance/status/attitude timeline), theories, cast recap card, global cross-user catalog, character tags UI, basic groups/factions, statistics.
- Phase 3 (Could) — not built: relationship graph (`CharacterRelationship` + book-state), relationship path-finder, faction clustering, flashcards, saved graph layout.
- Phase 4 (Won't-yet) — not built: merge preview/wizard (v1 is duplicate-prevention only), import/export, page-level spoilers, whole-profile hidden mode, character transformations.

Reference: `apps/api/md/booknest-characters-implementation-v2/02-scope-and-phases.md`.

## Related

- Spec: `apps/api/md/booknest-characters-implementation-v2/` (`01-architecture-and-corrections.md`, `02-scope-and-phases.md`, `backend/`, `features/`, `_phase1-gap-report.md`)
- Adjacent features sharing contracts/components: [books](./books.md) (owns `BooksRepository.existsOwned`, book/series ownership, the `Tag` reused by `CharacterTag`, and the `media` cover/portrait pipeline)
- Canonical backend workflow: `.claude/agents/backend-engineer.md`, `docs/code-principles.md`
- Feature index: `docs/features/README.md`

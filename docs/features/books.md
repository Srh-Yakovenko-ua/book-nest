# Books (Create Book)

**Status**: active
**Last updated**: 2026-06-11
**Curator**: feature-context-curator

This document covers the backend "Create Book" domain that implements blocks §6–§11 of the spec at `apps/api/md/new-book.md`. It is backend-only today (no `apps/web` slice, no cover/upload, no edit mode). Read the "Not implemented / Deferred" section before assuming any capability exists.

## Purpose

Let an authenticated user add a book to their personal BookNest library in a single `POST /api/books` request that also resolves-or-creates the book's author, publisher, tags, series, and lists, and conditionally creates child rows for reading progress and ownership (purchase / delivery / loan) based on the chosen statuses.

## User-visible behavior (mapped to spec §6–§11)

The backend models the form blocks. There is no UI yet, so "user-visible" here means "what a client that posts to the API can express".

| Spec block          | Capability the backend supports                                                                                                                                                                                    | Key fields on `CreateBookInput`                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| §6 Basic info       | Title (required), author (existing id or custom name, required), publisher (optional, existing id or custom name), spoiler-free description (optional)                                                             | `title`, `authorId`/`authorName`, `publisherId`/`publisherName`, `description`                               |
| §7 Classification   | Genres (max 5, closed enum), tags (per-user, resolve-or-create, max 12), age category, book language                                                                                                               | `genres`, `tags`, `ageCategory`, `language`                                                                  |
| §8 Status           | Reading status (required, default `not_started`) + reading-progress conditional block; ownership status (required, default `none`) + purchase / delivery / loan conditional blocks; formats (multi, no duplicates) | `readingStatus`, `readingProgress`, `ownershipStatus`, `purchaseInfo`, `deliveryInfo`, `loanInfo`, `formats` |
| §9 Series           | Book type `solo` or `series_part`; for `series_part` either an existing `seriesId` or a `newSeries` draft, plus a `partNumber`. The `newSeries` draft carries series-level status / totalBooks / description.      | `bookType`, `seriesId`/`newSeries`, `partNumber`                                                             |
| §10 Edition details | Pages count, publication year, ISBN (checksum-validated), original title, translator, illustrator, dedication                                                                                                      | `pagesCount`, `publicationYear`, `isbn`, `originalTitle`, `translator`, `illustrator`, `dedication`          |
| §11 Organization    | Mark favorite, add to reading queue with a priority, attach to existing lists and/or create new draft lists                                                                                                        | `isFavorite`, `addToReadingQueue`, `queuePriority`, `listIds`, `newLists`                                    |

§12 (cover) is not implemented — see "Not implemented / Deferred".

Observable states of the create flow:

- Success: `201` with the full `BookView` (all nested relations included).
- Validation error: `400` (Zod), e.g. missing title, both-or-neither author id and name, current page exceeds page count, loan person name missing, series part rules, ISBN checksum.
- Not found: `404` when a referenced `authorId` / `publisherId` / `seriesId` / `listId` is not visible to the user.
- Unauthorized: `401` when the access token is missing or invalid (`JwtAccessGuard`).

## End-to-end data flow (one `POST /api/books`)

There is no frontend yet, so the flow starts at the HTTP boundary.

1. Client sends `POST /api/books` with a Bearer access token. Next.js `rewrites()` would proxy `/api/*` to the API (`apps/web/next.config.ts`), but no web caller exists today.
2. `JwtAccessGuard` authenticates and `@CurrentUser()` injects the `UserModel` → `apps/api/src/modules/books/api/books.controller.ts:53-58`.
3. `ZodBodyPipe(CreateBookInputSchema)` validates and defaults the body → controller param at `apps/api/src/modules/books/api/books.controller.ts:56`. All schema-level rules and the three `refine`/`superRefine` blocks run here (`packages/shared/src/index.ts:932-1032`).
4. `BooksService.create(user.id, body)` orchestrates → `apps/api/src/modules/books/application/books.service.ts:141`.
5. Resolve the author id (existing-visible or resolve-or-create custom) → `authorsService.resolveOrCreate` at `apps/api/src/modules/books/application/books.service.ts:142` → `apps/api/src/modules/authors/application/authors.service.ts:21`.
6. Resolve the publisher id (nullable) → `publishersService.resolveOrCreate` at `books.service.ts:147`.
7. Resolve tag ids, de-duplicated by normalized name → `tagsService.resolveOrCreateMany` at `books.service.ts:152` → `apps/api/src/modules/tags/application/tags.service.ts:15`.
8. Resolve list ids: validate ownership of every `listId`, then resolve-or-create each `newList` → `listsService.resolveListsForBook` at `books.service.ts:154` → `apps/api/src/modules/lists/application/lists.service.ts:26`.
9. Compute queue placement: if `addToReadingQueue`, `queuePosition = max(existing) + 1` and `queuePriority = input ?? "normal"`; otherwise both `null` → `resolveQueuePlacement` at `books.service.ts:241-254` (uses `booksRepository.maxQueuePosition`).
10. Resolve series id (only when `bookType === "series_part"`) → `seriesService.resolveForBook` at `books.service.ts:161-167` → `apps/api/src/modules/series/application/series.service.ts:26`. `partNumber` is kept only for `series_part` (`books.service.ts:168`).
11. Build the conditional child payloads from the statuses: `buildReadingProgressData`, `buildPurchaseInfoData`, `buildDeliveryInfoData`, `buildLoanInfoData` → `books.service.ts:59-128`. Each returns `null` unless the matching status is selected (see "Conditional-block business rule").
12. Persist in one Prisma `book.create` with nested `create` for tags, list items, and any non-null conditional children → `apps/api/src/modules/books/infrastructure/books.repository.ts:104-120`.
13. Map the Prisma row + relations → `BookView` → `toBookView` at `apps/api/src/modules/books/domain/book.mapper.ts:27`. Enum columns are re-parsed with their Zod schemas; `Decimal` price → `number`; `Date` → `YYYY-MM-DD` strings.
14. Controller returns the `BookView`; Nest serializes it as `201`.

Note: steps 5–10 run before and outside the `book.create` transaction in step 12. This is deliberate (see "Not implemented / Deferred" — non-transactional taxonomy resolve).

## HTTP API

All endpoints require a valid access token (`JwtAccessGuard`). Controller: `apps/api/src/modules/books/api/books.controller.ts`.

| Method | Path             | Success | Errors        | Request schema                  | Response              |
| ------ | ---------------- | ------- | ------------- | ------------------------------- | --------------------- |
| POST   | `/api/books`     | 201     | 400, 401, 404 | `CreateBookInputSchema`         | `BookView`            |
| GET    | `/api/books`     | 200     | 401           | `PaginationQuerySchema` (query) | `Paginator<BookView>` |
| GET    | `/api/books/:id` | 200     | 401, 404      | `:id` `ParseUUIDPipe`           | `BookView`            |
| DELETE | `/api/books/:id` | 204     | 401, 404      | `:id` `ParseUUIDPipe`           | —                     |

Taxonomy autocomplete endpoints (paginated search of "global seeds + own custom", each backed by its own service):

| Method | Path                      | Success | Request                               | Response                   |
| ------ | ------------------------- | ------- | ------------------------------------- | -------------------------- |
| GET    | `/api/authors?search=`    | 200     | `TaxonomySearchPaginationQuerySchema` | `Paginator<AuthorView>`    |
| GET    | `/api/publishers?search=` | 200     | `TaxonomySearchPaginationQuerySchema` | `Paginator<PublisherView>` |
| GET    | `/api/tags?search=`       | 200     | `TaxonomySearchPaginationQuerySchema` | `Paginator<TagView>`       |
| GET    | `/api/series?search=`     | 200     | `TaxonomySearchPaginationQuerySchema` | `Paginator<SeriesView>`    |
| GET    | `/api/lists?search=`      | 200     | `TaxonomySearchPaginationQuerySchema` | `Paginator<BookListView>`  |

Controller route declarations: `tags.controller.ts:23`, `series.controller.ts:23`, `lists.controller.ts:23`, `publishers.controller.ts:23`, `authors.controller.ts:23`. Each exposes a single `@Get()` `search` (e.g. `lists.controller.ts:35-42`).

`PaginationQuerySchema` (`packages/shared/src/index.ts:35-39`): `pageNumber` (coerced int, min 1, default 1), `pageSize` (coerced int, 1..100, default 10), `sortDirection` (`asc`|`desc`, default `desc`). `Paginator<T>` shape: `{ items, page, pagesCount, pageSize, totalCount }` (`index.ts:25-31`, built by `buildPaginator` at `apps/api/src/core/paginator.ts:10`).

## Conditional-block business rule (§8)

`readingStatus` / `ownershipStatus` decide which child table gets a row. The rule lives in `apps/api/src/modules/books/application/books.service.ts`. A child is created only when both the status matches and the matching input object is present.

| Trigger status                                                          | Child table created     | Builder (books.service.ts)                               | Required sub-field                                  |
| ----------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| `readingStatus` ∈ {`reading`, `paused`, `finished`, `dnf`, `rereading`} | `book_reading_progress` | `buildReadingProgressData` (`:110-128`, set at `:34-40`) | none                                                |
| `readingStatus` ∈ {`not_started`, `want_to_read`}                       | none                    | —                                                        | —                                                   |
| `ownershipStatus` = `want_to_buy`                                       | `book_purchase_info`    | `buildPurchaseInfoData` (`:93-108`)                      | none                                                |
| `ownershipStatus` = `in_transit`                                        | `book_delivery_info`    | `buildDeliveryInfoData` (`:59-75`)                       | `deliveryStatus` defaults to `ordered` (`:47, :68`) |
| `ownershipStatus` ∈ {`borrowed_from_someone`, `lent_to_someone`}        | `book_loan_info`        | `buildLoanInfoData` (`:77-91`, set at `:42-45`)          | `personName` (required — see superRefine)           |
| `ownershipStatus` ∈ {`none`, `owned`}                                   | none                    | —                                                        | —                                                   |

If a status does not need a block but the client still sends the matching object, the builder returns `null` and no row is written — the conditional payload is silently dropped, matching the spec's "only active conditional blocks are submitted" intent (§8.10).

Queue placement is a parallel conditional (§11): `addToReadingQueue` controls whether `queuePosition`/`queuePriority` are set on the `books` row itself (no separate table) → `resolveQueuePlacement` (`:241-254`). `BookView.isInReadingQueue` is derived as `queuePosition !== null` (`book.mapper.ts:42`).

## Shared contracts

Location: `packages/shared/src/index.ts`. Both BE and (future) FE import from `@app/shared`. Any change here is a breaking FE↔BE contract change.

### Enums

- `ReadingStatusSchema` (`:424`): `not_started`, `want_to_read`, `reading`, `paused`, `finished`, `dnf`, `rereading`.
- `OwnershipStatusSchema` (`:436`): `none`, `want_to_buy`, `in_transit`, `owned`, `borrowed_from_someone`, `lent_to_someone`.
- `CurrencySchema` (`:447`): `UAH`, `EUR`, `USD`.
- `QueuePrioritySchema` (`:451`): `low`, `normal`, `high`.
- `DeliveryStatusSchema` (`:455`): `ordered`, `in_transit`, `ready_for_pickup`, `cancelled`. (`ordered` is delivery-only and intentionally distinct from the `in_transit` ownership status — spec §8.8.)
- `BookGenreSchema` (`:464`): 29 closed values (`fantasy` … `other`); `BookGenresSchema` (`:500`) caps at 5, no duplicates.
- `BookFormatSchema` (`:505`): `paper`, `ebook`, `audiobook`; `BookFormatsSchema` (`:509`) rejects duplicates, has no `not_specified` member.
- `BookLanguageSchema` (`:516`): `ukrainian`, `english`, `polish`, `german`, `french`, `spanish`, `other`.
- `AgeCategorySchema` (`:528`): `not_specified`, `no_restrictions`, `6_plus`, `12_plus`, `14_plus`, `16_plus`, `18_plus`.
- `SeriesStatusSchema` (`:853`): `completed`, `ongoing`, `unknown`.
- `BookTypeSchema` (`:857`): `solo`, `series_part`.

### `CreateBookInputSchema` (`:932-1032`)

Object fields (defaults applied by Zod at the pipe):

- `title` (`BookTitleSchema`, trimmed, 1..150, no HTML — required)
- `authorId` (uuid, optional) / `authorName` (`TaxonomyNameSchema`, 2..100, no HTML, optional)
- `publisherId` (uuid, optional) / `publisherName` (`TaxonomyNameSchema`, optional)
- `description` (`BookDescriptionSchema`, ≤500, nullable optional)
- `genres` (default `[]`), `tags` (`BookTagsInputSchema`, each 2..30, allowed chars only, ≤12, default `[]`)
- `ageCategory` (default `not_specified`), `language` (default `ukrainian`), `formats` (default `[]`)
- `readingStatus` (default `not_started`), `readingProgress` (`ReadingProgressInputSchema`, optional)
- `ownershipStatus` (default `none`), `purchaseInfo` / `deliveryInfo` / `loanInfo` (optional)
- `bookType` (default `solo`), `seriesId` (uuid, optional) / `newSeries` (`NewSeriesInputSchema`, optional), `partNumber` (1..999, optional)
- `pagesCount` (1..10000, nullable optional), `publicationYear` (1000..currentYear+1, nullable optional), `isbn` (checksum-validated, nullable optional), `originalTitle` (≤200), `translator` (≤100), `illustrator` (≤100), `dedication` (≤300)
- `isFavorite` (default `false`), `addToReadingQueue` (default `false`), `queuePriority` (optional), `listIds` (uuid array, ≤50, optional), `newLists` (≤20, optional)

Key validation rules (`refine` + `superRefine`, `:968-1032`):

- Author: exactly one of `authorId` / `authorName` must be present (XOR) — `:968`.
- Publisher: not both `publisherId` and `publisherName` — `:972` (both absent is allowed → no publisher).
- `readingProgress.currentPage` must not exceed `pagesCount` when both given — `:976-990`.
- Loan: when `ownershipStatus` is a loan status, `loanInfo` (and thus `personName`) is required — `:992-998`.
- Series part: when `bookType === "series_part"`, exactly one of `seriesId` / `newSeries`, and `partNumber` is required — `:1000-1017`.
- `newSeries.totalBooks` must not be fewer than `partNumber` — `:1019-1030`.
- ISBN: input pattern (digits, hyphens, spaces, `X`) plus a real ISBN-10/ISBN-13 checksum — `IsbnSchema` (`:682`), `isValidIsbn` (`:659`).
- Dates use `notInFutureDate(...)` for `startedAt`/`finishedAt`/`pausedAt`/`abandonedAt`/`orderDate`/`loanDate`; `expectedDeliveryDate` ≥ `orderDate` (`:818-827`); `expectedReturnDate` ≥ `loanDate` (`:839-848`).
- Tag duplicate check uses `normalizeTagName` (trim + collapse spaces + lowercase) — `:585`, `:624-627`.

### `BookView` (`:1040-1074`) and nested view types

`BookView` carries the full aggregate: `author {id,name}`, nullable `publisher {id,name}`, `series` (`SeriesView` or null), `tags` (`TagView[]`), `lists` (`BookListView[]`), `genres`, `formats`, `language`, `ageCategory`, `readingStatus`, `ownershipStatus`, `isFavorite`, `isInReadingQueue`, `queuePriority`, `bookType`, `partNumber`, edition fields (`pagesCount`, `publicationYear`, `isbn`, `originalTitle`, `translator`, `illustrator`, `dedication`), and the four conditional view objects: `readingProgress` (`ReadingProgressView`, `:1110`), `purchaseInfo` (`PurchaseInfoView`, `:1100`), `deliveryInfo` (`DeliveryInfoView`, `:1078`), `loanInfo` (`LoanInfoView`, `:1087`) — each nullable. Plus `id`, `userId`, `title`, `description`, `createdAt`, `updatedAt`.

Other exported view/input types: `AuthorView` / `PublisherView` (`{id, name, isCustom}`), `TagView` (`{id, name}`), `BookListView` (`{id, name, description}`), `SeriesView`, `NewSeriesInput`, `NewListInput`, `ReadingProgressInput`, `PurchaseInfoInput`, `DeliveryInfoInput`, `LoanInfoInput`, `TaxonomySearchPaginationQuery`.

## Backend modules (feature-sliced NestJS)

Six modules participate. `BooksModule` imports the other five (`apps/api/src/modules/books/books.module.ts:13-17`) and injects their services into `BooksService`.

### `books`

- Controller `apps/api/src/modules/books/api/books.controller.ts` — `@Controller("api/books")`, methods `create` (`:54`), `list` (`:67`), `getById` (`:81`), `delete` (`:96`, `@HttpCode(204)`). All `@UseGuards(JwtAccessGuard)`.
- Service `apps/api/src/modules/books/application/books.service.ts` — `create` (`:141`), `list` (`:220`, parallel `listByUser` + `countByUser`), `getById` (`:211`, throws `NotFoundError("Book not found")`), `delete` (`:204`, throws when `deleteOwned` count is 0). Conditional builders at `:59-128`; queue placement at `:241`.
- Repository `apps/api/src/modules/books/infrastructure/books.repository.ts` — only Prisma layer. `create` (`:104`) does the nested write; `withRelations` (`:7-17`) eager-loads author, publisher, series, tags, lists, and all four conditional children. `listByUser` (`:133`), `findOwnedById` (`:126`), `deleteOwned` (`:122`, `deleteMany` scoped by `userId`), `maxQueuePosition` (`:143`).
- Mapper `apps/api/src/modules/books/domain/book.mapper.ts` — `toBookView` (`:27`) plus `toDeliveryInfoView`/`toLoanInfoView`/`toPurchaseInfoView`/`toReadingProgressView`/`toSeriesView`. `bookType` is derived as `series === null ? "solo" : "series_part"` (`:31`). `expectedPrice` `Decimal` → `number` via `.toNumber()` (`:110`).

### `authors`, `publishers`, `tags`, `series`, `lists` (taxonomy resolvers)

Each follows the same controller / service / repository / mapper / input-dto shape and shares the same race-safe resolve-or-create pattern: normalize the name (`apps/api/src/core/normalize-name.ts`), look up by `(userId, normalizedName)`, create on miss, and on a `P2002` unique-constraint collision re-read the winner (`isUniqueConstraintError`, `apps/api/src/core/prisma-errors.ts:5`). This handles two concurrent creates of the same custom value.

- `authors` — `resolveOrCreate(userId, {id?, name?})` (`apps/api/src/modules/authors/application/authors.service.ts:21`). Existing path uses `findVisibleById` (own + global seeds where `userId IS NULL`); custom path uses `findByNormalized` then `create`, with the `P2002` reread at `:44-52`. `toAuthorView` sets `isCustom = userId !== null` (`author.mapper.ts:8`).
- `publishers` — mirrors `authors` exactly (`resolveOrCreate` returns nullable id; called with the publisher name/id at `books.service.ts:147`).
- `tags` — `resolveOrCreateMany(userId, names)` (`apps/api/src/modules/tags/application/tags.service.ts:15`) de-dupes by normalized name in a `Map`, then calls the private `resolveOrCreate` per tag (`:53`). Tags are strictly per-user (`tags` table has non-null `userId`).
- `series` — `resolveForBook(userId, {seriesId?, newSeries?})` (`apps/api/src/modules/series/application/series.service.ts:26`). Existing uses `findOwnedById`; new uses `findByNormalized` then `create`, with the same `P2002` reread. Per-user only.
- `lists` — `resolveListsForBook(userId, {listIds?, newLists?})` (`apps/api/src/modules/lists/application/lists.service.ts:26`): validates every requested `listId` via `findOwnedByIds` (throws `NotFoundError("List not found")` on any miss), then resolve-or-creates each `newList`. Returns a de-duplicated id array. Per-user only.

### Models (`apps/api/prisma/schema.prisma`)

- `Book` (`:100-141`, `@@map("books")`) — core (`title`, `userId`), FKs (`authorId` required, `publisherId` nullable, `seriesId` nullable `onDelete: SetNull`), classification (`genres[]`, `formats[]`, `language`, `ageCategory`), status (`readingStatus`, `ownershipStatus`, `isFavorite`), edition (`pagesCount`, `publicationYear`, `isbn`, `originalTitle`, `translator`, `illustrator`, `dedication`), series/queue (`partNumber`, `queuePriority`, `queuePosition`). Status/enum columns are stored as plain `String` with DB defaults (e.g. `reading_status` default `not_started`); the enum guarantee comes from Zod, not a Postgres enum. Indexes on `userId` and `seriesId`.
- Two-tier taxonomy `Author` (`:70-83`) and `Publisher` (`:85-98`) — nullable `userId` (null = global seed, non-null = user custom), `@@unique([userId, normalizedName])`, `@@index([normalizedName])`.
- Per-user `Tag` (`:206-219`) + `BookTag` join (`:221-230`, composite PK `[bookId, tagId]`).
- Per-user `Series` (`:52-68`).
- Per-user `BookList` (`:232-246`) + `BookListItem` join (`:248-257`, composite PK `[listId, bookId]`).
- Four conditional 1:1 children, each with `bookId @unique` and `onDelete: Cascade`: `BookReadingProgress` (`:143-159`), `BookPurchaseInfo` (`:161-174`, `expectedPrice Decimal(10,2)`), `BookDeliveryInfo` (`:176-190`), `BookLoanInfo` (`:192-204`, `personName` required NOT NULL). Date-only fields use `@db.Date`; deleting a book cascades to all children, tags, and list items.

Migrations: 9 additive steps, `20260610163718_book_core` → `20260611115034_book_organization`, in `apps/api/prisma/migrations/`. Schema changes go through `pnpm --filter @app/api db:migrate` with reviewed SQL.

### Errors and middleware

- Service errors are `HttpError` subclasses from `apps/api/src/core/exceptions/errors.js` (`NotFoundError` used here); the global `HttpErrorFilter` maps them to JSON with `requestId`. `ZodError` from the pipes maps to `400`.
- Cross-cutting middleware (request-id correlation, request logger) is applied app-wide, not per-module.

## States designed

| State            | Treatment                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Created          | `201` with full `BookView` including every nested relation                                                                      |
| Listed           | `200` `Paginator<BookView>`, newest-first by `createdAt` (default `sortDirection: desc`)                                        |
| Validation error | `400` with Zod issue path (e.g. `["readingProgress","currentPage"]`, `["loanInfo","personName"]`, `["newSeries","totalBooks"]`) |
| Not found        | `404` `NotFoundError` for unknown book or for a referenced author/publisher/series/list not visible to the user                 |
| Unauthorized     | `401` from `JwtAccessGuard`                                                                                                     |
| Deleted          | `204` no content                                                                                                                |

## Dependencies

### External libraries

- `@nestjs/common`, `@nestjs/swagger`, `nestjs-zod` (`createZodDto` for `CreateBookInputDto`, `PaginationQueryDto`, `TaxonomySearchPaginationQueryDto`)
- `@prisma/client` (engineless Prisma 7) via `PrismaService`
- `zod` (all validation + `superRefine` rules in `@app/shared`)

### Internal primitives

- `core/pipes/zod-body.pipe.ts`, `core/pipes/zod-query.pipe.ts` — boundary validation
- `core/normalize-name.ts`, `core/prisma-errors.ts` (`isUniqueConstraintError`), `core/paginator.ts` (`buildPaginator`)
- `core/exceptions/errors.ts` (`NotFoundError`)
- `modules/auth` — `JwtAccessGuard`, `@CurrentUser()` decorator

## Tests

All backend (Vitest). No frontend tests (no FE slice). Repo-wide suite is green (~491 tests at time of writing).

- `apps/api/src/modules/books/application/books.service.test.ts` — service unit tests: resolve order (author → publisher → book), `BookView` mapping with nested relations, resolved ids passed to repo create, conditional-block creation per status.
- `apps/api/src/modules/books/api/books.controller.test.ts` — controller/integration tests (create, list, get, delete, auth, validation).
- Taxonomy modules each have service + controller tests: `authors`, `publishers`, `tags`, `series`, `lists` under `application/*.service.test.ts` and `api/*.controller.test.ts`, covering resolve-or-create, the `P2002` race reread, and paginated search.

## Not implemented / Deferred

Read this before assuming a capability exists.

- §12 Cover (обкладинка): NOT IMPLEMENTED. There is no `coverUrl` column on `Book`, no cover-upload endpoint, and no object-storage (S3 / MinIO / R2) wiring. Books currently have no cover concept in the backend at all. The user deliberately deferred this to a separate, dedicated effort that will design the image cropping / upload UX. Everything in spec §12 (formats, size limits, 2:3 ratio warnings, replace/remove, alt text, fallback placeholder) is out of scope for now.
- PATCH / edit mode: NOT IMPLEMENTED. Only `POST` (create), `GET` (list), `GET /:id`, and `DELETE /:id` exist. The spec's "Edit Book" mode and all its confirmation-modal behaviors (status change clearing conditional data, removing a book from a series, removing from queue, replacing a cover) are not built.
- Global authors / publishers seed data is empty. A bulk seed was attempted and removed (wrong data). Real authors / publishers / editions data is pending an external API integration the user is researching. Today `GET /api/authors` and `GET /api/publishers` return only the current user's own custom values (the `userId IS NULL` global tier exists in the schema but has no rows).
- Non-transactional taxonomy resolve (approved, deferred). Author / publisher / tag / series / list resolve-or-create runs before and outside the `book.create` transaction (`books.service.ts:142-168` vs the single `book.create` at `:170`). If `book.create` fails, freshly created taxonomy rows are orphaned. This is benign (the rows are reusable and de-duplicated on the next attempt) and was kept non-transactional on purpose for the `P2002` race-safety reread to work cleanly.
- Per-status field restriction not enforced. `readingProgress.rating` and `readingProgress.finishedAt` are accepted for any reading status that creates a progress row, not only `finished`. The spec implies rating/finished belong to the "Завершення" block, but the backend does not gate them by status.
- Duplicated status sets. The "ownership statuses with loan" set is defined both in the shared `superRefine` (`packages/shared/src/index.ts:899-902`) and in `books.service.ts:42-45`; the reading-progress status set lives only in `books.service.ts:34-40`. These can drift and should be reconciled if they grow.
- List endpoint includes all five conditional relations. `withRelations` (`books.repository.ts:7-17`) eager-loads readingProgress, purchaseInfo, deliveryInfo, loanInfo, series, tags, and lists for every row in `GET /api/books`. A lighter list projection was deferred until there is a measured performance need.
- `partNumber` uniqueness within a series is not enforced at the DB or service level (spec §9.8 calls for a warning); there is no unique constraint on `(seriesId, partNumber)`.
- No reading-queue / favorites / lists list endpoints beyond search; series-progress recalculation (spec §9.7) is not implemented (no progress field exists on `Series` beyond `totalBooks`).

## Related

- Spec: `apps/api/md/new-book.md` (§6–§12)
- Architecture overview: `docs/architecture.md`
- Canonical backend workflow: `.claude/agents/backend-engineer.md`, `docs/code-principles.md`
- Feature index: `docs/features/README.md`

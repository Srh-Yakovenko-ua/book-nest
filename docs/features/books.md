# Books

**Status**: active
**Last updated**: 2026-06-27
**Curator**: feature-context-curator

The Books feature lets an authenticated user build and manage a personal book library: create a book, edit it, browse the library, and delete it. It spans all three packages — a NestJS `books` module (plus the `series` / `lists` / `tags` / `authors` / `publishers` / `genres` / `media` taxonomy modules it composes), the shared Zod contracts in `@app/shared`, and a full `apps/web` feature slice with create/edit forms and a library grid. It implements blocks §6–§12 of the spec at `apps/api/md/new-book.md`.

The history of this doc: it started backend-only. The FE slice, edit mode (`PATCH`), and cover upload have since landed; the most recent change is commit `b1d61ae` (2026-06-27) — see the dated changelog near the bottom.

## Purpose

Add a book to a personal library through one `POST /api/books` request that also resolves-or-creates the book's author, publisher, tags, series, and lists, attaches an optional cover, and conditionally creates child rows for reading progress and ownership (purchase / delivery / loan) based on the chosen statuses. The same aggregate can be edited via `PATCH /api/books/:id`, listed via `GET /api/books`, and removed via `DELETE /api/books/:id`.

## User-visible behavior

- `/[locale]/books` — the library grid. Each book renders as a `BookCard` (cover, title, author, reading-status badge, series line, progress bar, all genre chips, rating). Sort newest/oldest, infinite "load more", per-card kebab → delete with confirm, cover click → full-size viewer.
- `/[locale]/books/new` — the create form (`CreateBookForm`).
- `/[locale]/books/[id]/edit` — the edit form (`EditBookForm`), pre-filled from `GET /api/books/:id`.
- Observable states: idle (grid / form), loading (`Skeleton` cards and form skeletons), empty (illustration + "Add book" CTA), error (alert + retry), success (toast `sonner`).

### Form blocks (spec §6–§12)

| Spec block          | Capability                                                                                              | FE section component                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| §6 Basic info       | Title (required), author (catalog / Open Library / custom, required), publisher (optional), description | `book-form.tsx` basic-info block                                                   |
| §7 Classification   | Genres (max 5), tags (per-user combobox, max 12), age category, language                                | `classification-section.tsx`, `tags-field.tsx`                                     |
| §8 Status           | Reading status + progress block; ownership status + purchase / delivery / loan blocks; formats          | `reading-status-section.tsx`, `ownership-status-section.tsx`, `format-section.tsx` |
| §9 Series           | `solo` or `series_part`; existing `seriesId` or `newSeries` draft + `partNumber`                        | `book-type-section.tsx`, `series-autocomplete.tsx`, `create-series-dialog.tsx`     |
| §10 Edition details | Pages, year, ISBN (checksum), original title, translator, illustrator, dedication                       | `edition-details-section.tsx`                                                      |
| §11 Organization    | Favorite, reading queue + priority, lists (existing + new drafts)                                       | `library-organization-section.tsx`                                                 |
| §12 Cover           | Upload + crop, preview, replace, remove                                                                 | `cover-field.tsx`, `library-cover-viewer.tsx`                                      |

## End-to-end data flow

### Create (one `POST /api/books`, from the form)

1. User fills `BookForm` and clicks submit → `apps/web/src/features/books/components/book-form.tsx:575-584`.
2. `handleSubmit` runs the resolver (`zodResolver(CreateBookInputSchema)`) → `book-form.tsx:132-153`, `286`. A reactive guard re-checks `partNumber ≤ series.totalBooks` for the existing-series case before submit → `book-form.tsx:286-295`.
3. If a cover File is selected, it is uploaded first via `useUploadMedia` → `book-form.tsx:299-314`; the returned `mediaId` is set as `payload.coverMediaId`.
4. `useCreateBook` mutation fires → `apps/web/src/features/books/api/use-create-book.ts`, calling the generated `booksControllerCreate` (Orval). Next.js `rewrites()` proxies `/api/*` to the API (`apps/web/next.config.ts`).
5. `JwtAccessGuard` authenticates; `@CurrentUser()` injects the `UserModel` → `apps/api/src/modules/books/api/books.controller.ts:63-67`.
6. `ZodBodyPipe(CreateBookInputSchema)` validates and defaults the body → `books.controller.ts:65`. Schema rules and the `refine`/`superRefine` blocks run here → `packages/shared/src/index.ts:962-1062`.
7. `BooksService.create` orchestrates → `apps/api/src/modules/books/application/books.service.ts:186`. Resolve order: author (`:187`) → publisher (`:189`) → tags (`:194`) → lists (`:196`) → queue placement (`:201`) → series (`:203-211`).
8. Server-side invariants: `assertPartNumberWithinSeriesTotal` for an existing series (`:213-215`), `assertSeriesPartNumberUnique` (`:216`), `genresService.assertGenresSelectable` (`:217`), and `mediaService.assertOwned` for the cover (`:219-221`).
9. Conditional child payloads built from the statuses (`:223-238`) — `null` unless the matching status is selected.
10. One Prisma `book.create` with nested writes for tags, list items, cover link, and non-null children → `apps/api/src/modules/books/infrastructure/books.repository.ts` (`create`).
11. Map row + relations → `BookView` → `apps/api/src/modules/books/domain/book.mapper.ts` (`toBookView`); cover view via `coverViewOf` → `books.service.ts:272`, `539-549`.
12. Controller returns `201` with the `BookView`. FE parses it with `bookViewSchema` (`apps/web/src/features/books/model/book-view-schema.ts`), invalidates `["/api/books"]`, toasts success, and routes to `/books` → `book-form.tsx:330-337`.

### Edit (`PATCH /api/books/:id`)

`UpdateBookInputSchema` is all-optional. `BooksService.update` (`books.service.ts:316`) reads the current row, derives the effective `readingStatus` / `ownershipStatus`, re-validates current-page and loan-person invariants, then applies scalar fields, author/publisher/cover/tags/lists, series placement (`applySeriesFields`, `:419-454`), and queue placement (`applyQueueFields`, `:393-417`). Conditional child blocks are upserted-or-deleted by status via `resolve*Block` (`:109-171`) so a status change clears the stale block. Replacing or removing the cover deletes the old media when no longer referenced (`:382-388`, `551-561`).

## HTTP API

All endpoints require a valid access token (`JwtAccessGuard`).

| Method | Path             | Success | Errors        | Request schema          | Response              |
| ------ | ---------------- | ------- | ------------- | ----------------------- | --------------------- |
| POST   | `/api/books`     | 201     | 400, 401, 404 | `CreateBookInputSchema` | `BookView`            |
| GET    | `/api/books`     | 200     | 401           | `PaginationQuerySchema` | `Paginator<BookView>` |
| GET    | `/api/books/:id` | 200     | 401, 404      | `:id` `ParseUUIDPipe`   | `BookView`            |
| PATCH  | `/api/books/:id` | 200     | 400, 401, 404 | `UpdateBookInputSchema` | `BookView`            |
| DELETE | `/api/books/:id` | 204     | 401, 404      | `:id` `ParseUUIDPipe`   | —                     |

Controller: `apps/api/src/modules/books/api/books.controller.ts` — `create` (`:63`), `list` (`:76`), `getById` (`:90`), `update` (`:107`), `delete` (`:123`). `POST` and `PATCH` are rate-limited via `@Throttle` (`:43-46`, `:61`, `:105`).

Taxonomy endpoints (paginated "global seeds + own custom" search; tags/series/lists are own-only):

| Method | Path                      | Success | Notes                                                             |
| ------ | ------------------------- | ------- | ----------------------------------------------------------------- |
| GET    | `/api/authors?search=`    | 200     | `Paginator<AuthorView>`                                           |
| GET    | `/api/publishers?search=` | 200     | `Paginator<PublisherView>`                                        |
| GET    | `/api/tags?search=`       | 200     | `Paginator<TagView>`; empty `search` returns the user's tags      |
| DELETE | `/api/tags/:id`           | 204     | `apps/api/src/modules/tags/api/tags.controller.ts:61-66`          |
| GET    | `/api/series?search=`     | 200     | `Paginator<SeriesView>`; empty `search` returns the user's series |
| GET    | `/api/lists?search=`      | 200     | `Paginator<BookListView>`                                         |

## Conditional-block business rule (§8)

`readingStatus` / `ownershipStatus` decide which child table gets a row. The status sets live in `apps/api/src/modules/books/domain/book-blocks.ts` (`readingStatusUsesProgress`, `ownershipStatusUsesPurchase`/`Delivery`/`Loan`); the loan set is also in shared (`ownershipStatusUsesLoan`, `packages/shared/src/index.ts:910-917`). A child is created only when the status matches and the matching input object is present.

| Trigger status                                                          | Child table             | Required sub-field                               |
| ----------------------------------------------------------------------- | ----------------------- | ------------------------------------------------ |
| `readingStatus` ∈ {`reading`, `paused`, `finished`, `dnf`, `rereading`} | `book_reading_progress` | none                                             |
| `ownershipStatus` = `want_to_buy`                                       | `book_purchase_info`    | none                                             |
| `ownershipStatus` = `in_transit`                                        | `book_delivery_info`    | `deliveryStatus` defaults to `ordered`           |
| `ownershipStatus` ∈ {`borrowed_from_someone`, `lent_to_someone`}        | `book_loan_info`        | `personName` (required — `superRefine` + server) |
| `ownershipStatus` ∈ {`none`, `owned`}                                   | none                    | —                                                |

On `PATCH`, a status that no longer needs its block deletes the existing child row (`resolve*Block` returns `{ delete: true }`). Queue placement is a parallel conditional (§11): `addToReadingQueue` controls `queuePosition` / `queuePriority` on the `books` row itself.

## Shared contracts

Location: `packages/shared/src/index.ts`. Both FE and BE import from `@app/shared`. Any change here is a breaking FE↔BE contract change.

- `CreateBookInputSchema` (`:962-1062`) and `UpdateBookInputSchema` (`:1064-1153`) — request DTOs. `UpdateBookInputSchema` is the same shape, all fields optional.
- `BookAuthorReferenceSchema` (`:954-958`) — a union of `{ id }`, `{ openLibraryKey }`, or `{ name }`. The author field can reference a catalog row, an Open Library author to materialize, or a custom name.
- `BookView` (`:1203-1238`) — the full aggregate including `cover?: MediaView | null`, `series: SeriesView | null`, `tags: TagView[]`, `lists: BookListView[]`, the four nullable conditional views, queue/series fields, and edition fields.
- `BOOK_DESCRIPTION_MAX = 5000` (`:538`) and `SERIES_DESCRIPTION_MAX = 5000` (`:546`) — both feed `NoHtmlString.max(...)` schemas (`:609`, `:879-884`).
- `OwnershipPriceSchema = z.number().gt(0, "Price must be greater than 0")` (`:799`).
- `BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE` (`:898-899`) — one source of truth for the part-number-vs-total message, consumed by the shared `superRefine` (`:1057`, `:1148`), the FE reactive check, and the BE service.
- Enums: `ReadingStatusSchema`, `OwnershipStatusSchema`, `CurrencySchema`, `QueuePrioritySchema`, `DeliveryStatusSchema`, `BookGenresSchema` (≤5), `BookFormatsSchema`, `BookLanguageSchema`, `AgeCategorySchema`, `SeriesStatusSchema`, `BookTypeSchema`.
- `SeriesView` carries `totalBooks: null | number`, `booksInSeries`, `finishedInSeries`, `status`, `description` (`:1355-1363`).
- `MediaView` / `MediaUploadInputSchema` / `MediaCropSchema` (`:1276-1319`) — the cover contract, owned by the media feature.

## Backend modules (feature-sliced NestJS)

`BooksModule` imports the taxonomy + media + genres modules and injects their services into `BooksService` (constructor at `apps/api/src/modules/books/application/books.service.ts:175-184`).

### `books`

- Controller `api/books.controller.ts` — five routes (see HTTP API).
- Service `application/books.service.ts` — `create` (`:186`), `update` (`:316`), `list` (`:295`), `getById` (`:286`), `delete` (`:275`). Part-number invariants: `assertPartNumberWithinSeriesTotal` (`:501-516`, throws `BadRequestError` field `partNumber`), `assertSeriesPartNumberUnique` (`:518-537`). Author resolution `resolveAuthorId` handles id / Open Library key / custom name (`:563-576`). Cover lifecycle: `coverViewOf` (`:539`), `deleteCoverMedia` (`:551`).
- Repository `infrastructure/books.repository.ts` — only Prisma layer; nested `create`, `updateOwned` (block upserts), `existsSeriesPartNumber`, `countByCoverMediaId`, `maxQueuePosition`, `listByUser`, `findOwnedById`, `deleteOwned`.
- Mapper `domain/book.mapper.ts` — `toBookView` and the per-block mappers. `book-blocks.ts` holds the status-set predicates and the `build*Data` / `build*UpdateData` builders.

### `series`

- Service `application/series.service.ts` — `resolveForBook(userId, { seriesId?, newSeries? })` (`:31-70`) now returns `ResolvedSeries = { id, totalBooks }` (`:17-20`) so the caller can enforce the part-number range. Existing path via `findOwnedById`; new path via `findByNormalized` + `create` with a `P2002` reread (`:60-69`). `search` (`:72`).

### `tags`

- Controller `api/tags.controller.ts` — `search` (`:48`) and `delete` (`:64`, `DELETE /api/tags/:id`, 204).
- Service `application/tags.service.ts` — `resolveOrCreateMany`, `search`, `delete`. Strictly per-user.

### `lists`, `authors`, `publishers`, `genres`, `media`

Each follows the controller / service / repository / mapper shape. `lists.resolveListsForBook` validates ownership of every `listId` and resolve-or-creates each `newList`. `authors` / `publishers` are two-tier (global seed where `userId IS NULL` + per-user custom); the dev DB is seeded (~1432 authors, ~1387 publishers — see project notes). `media` owns the cover upload / derivative / delete pipeline.

### Models (`apps/api/prisma/schema.prisma`)

`Book` (`@@map("books")`) plus the two-tier `Author` / `Publisher`, per-user `Tag` (+ `BookTag` join), per-user `Series`, per-user `BookList` (+ `BookListItem` join), and the four 1:1 conditional children (`BookReadingProgress`, `BookPurchaseInfo`, `BookDeliveryInfo`, `BookLoanInfo`, each `bookId @unique`, `onDelete: Cascade`). The cover is a nullable `coverMediaId` FK to the media table. Schema changes go through reviewed `prisma migrate` SQL.

## Frontend

Feature slice: `apps/web/src/features/books/`. Public API via the barrel `index.ts`.

### Pages (`apps/web/src/app/[locale]/(app)/books/`)

- `page.tsx` → `BooksLibrary`
- `new/page.tsx` → `CreateBookForm` (`= <BookForm mode="create" />`)
- `[id]/edit/page.tsx` → `EditBookForm` (fetches the book, then `<BookForm mode="edit" book={...} />`)

### The form (`components/book-form.tsx`)

One `BookForm` drives both create and edit (discriminated `BookFormProps`, `:61`). It seeds RHF `defaultValues` from the edit book (`bookViewToFormState`) or `createBookFormDefaults`, holds non-RHF selection state for author/publisher/series/cover, persists a sessionStorage draft on every change, and composes the section components listed in the §6–§12 table above. Edit mode adds confirm dialogs for status / series / queue changes that would discard conditional data (`requestReadingStatusChange` etc., `:227-284`).

### API hooks (`api/`)

- `use-books.ts` — `useInfiniteQuery`, key `["/api/books", "list", { sortDirection }]`, parses with `bookViewSchema`.
- `use-book.ts` — single book for edit.
- `use-create-book.ts` / `use-update-book.ts` — mutations; invalidate `["/api/books"]` (and `["/api/books/${id}"]` on update).
- `use-delete-book.ts`, `use-delete-tag.ts` (invalidates `["tags", "search"]`), `use-genres.ts`.
- Autocomplete search hooks: `use-author-search.ts`, `use-publishers-search.ts`, `use-series-search.ts`, `use-tags-search.ts`, `use-lists-search.ts` — debounced `useQuery` over the Orval-generated taxonomy endpoints.

### State

- Server state: TanStack Query (keys above).
- Client state: local component state in `BookForm`; the locale-switch draft lives in `sessionStorage` (see `model/book-form-draft.ts`). No Zustand store.

## Changelog — 2026-06-27 (commit `b1d61ae`, "fix(books): fix create-book and series form bugs")

Nine create/edit-form fixes plus one server-side hardening.

### 1. Form state survives an interface-language switch

Switching locale is a client navigation to a different `/[locale]/` segment, so the form remounts and previously lost all state. Now a sessionStorage "draft" is persisted on every change and restored on mount — but only when the saved draft's locale differs from the current one, so this is scoped to the locale-switch case rather than general draft recovery.

- `model/book-form-draft.ts` — `readBookFormDraft` (`:53`) reads + Zod-parses the envelope (`draftSchema`, `:45-51`) via `parseBookFormDraft` (`:62`) and returns `null` when `draft.locale === locale` (`:58`).
- `book-form.tsx` — lazy seed `useState(() => readBookFormDraft(draftKey, locale))` (`:93`); `defaultValues` merge `{ ...defaults, ...restoredDraft.values }` (`:147-149`); author/publisher/series selection states seeded from the draft (`:103-111`); persist effect via RHF `subscribe` (`:163-191`); `clearDraft()` (`:155-161`) on edit success (`:323`) and `sessionStorage.removeItem(draftKey)` on create success (`:333`). `draftKey` is `book-form-draft:create` or `book-form-draft:edit:${bookId}` (`:92`).

Deliberate trade-offs: the cover File is not serialized into the draft (`File` can't serialize, so it is not restored); the restore is intentionally scoped to the locale-switch case; and a benign React hydration mismatch is possible only on a hard load of a cross-locale URL that already has a different-locale draft (the in-app switcher is a soft navigation and is safe). The cleaner post-mount-effect approach was avoided because it conflicts with the repo's `react-hooks/set-state-in-effect` lint rule.

### 2. Tags field is now a combobox

`components/tags-field.tsx` — previously-saved tags now appear as dropdown options (Popover + cmdk `Command`, `:104-190`); only the book's selected tags render as chips (`TagInput value={value}`, `:124`); typing filters the suggestions (`:81-83`) and offers "Create '{name}'" when the draft is a valid new tag (`draftIsNewTag`, `:84-89`; render `:173-186`); each saved option has a delete button (`:157-168`) that opens a confirm `AlertDialog` (`:199-224`) and calls `useDeleteTag` → `DELETE /api/tags/:id`. Combobox ARIA (`role="combobox"`, `aria-expanded`, `aria-controls`) is wired on the input (`:109-122`). i18n keys `classification.tagsNoSaved`/`tagsCreateHeading`/`tagsDeleteSaved`/`tagsSuggestions` (`apps/web/src/messages/en.json:351-361`).

### 3. Series "books in series" rejects 0/negative

`components/create-series-dialog.tsx:88-91` — `totalBooks < TOTAL_BOOKS_MIN` sets an inline error `t("series.create.totalBooksInvalid")` (`apps/web/src/messages/en.json:422`).

### 4. Series description limit raised 300 → 5000

`SERIES_DESCRIPTION_MAX = 5000` (`packages/shared/src/index.ts:546`) feeds `SeriesDescriptionSchema` (`:879-884`). The dialog counter uses `DESCRIPTION_MAX = SERIES_DESCRIPTION_MAX` (`create-series-dialog.tsx:27`, counter `:195-200`). The DB column is already `text`, so no migration was needed.

### 5. Numeric fields validated with clear field errors

`OwnershipPriceSchema` changed from `.min(0)` to `.gt(0)` (`packages/shared/src/index.ts:799`); the price error surfaces via `FieldError` at `ownership-status-section.tsx:162-165`. `pagesCount` / `publicationYear` already had Zod min/max and now render `FieldError`s at `edition-details-section.tsx:65` and `:92`.

### 6. Part number can't exceed the series total

The shared `superRefine` issue moved from path `["newSeries","totalBooks"]` to `["partNumber"]` so it renders by the field (`CreateBookInputSchema:1049-1060`, `UpdateBookInputSchema:1140-1151`), using the new shared const `BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE` (`:898-899`). The form shows a range hint "This series has N books, so parts 1–N are available" (`book-type-section.tsx:153-157`, i18n `bookType.partNumberHint`, `en.json:399`) and runs a reactive check for the existing-series case (`book-form.tsx:205-213` effect + `:286-295` submit guard).

Server-side enforcement was added because the existing-series `totalBooks` lives only in the DB and the client can be bypassed (client = UX, server = data integrity for untrusted input). `SeriesService.resolveForBook` now returns `{ id, totalBooks }` (`series.service.ts:17-20`, `:31-70`); `BooksService.assertPartNumberWithinSeriesTotal` throws `BadRequestError` (field `partNumber`, `books.service.ts:501-516`) on create (`:213-215`), on a series-part update (`applySeriesFields:448-450`), and on a bare `{ partNumber }` PATCH of a book already in a series (`applySeriesFields:426-432`).

### 7. Series dropdown opens on click

`components/series-autocomplete.tsx` — `onClick`/`onFocus` now open the popover (`:105-106`), and `use-series-search.ts` runs even for an empty query (no `enabled` gate, `:31-42`) so the user's series show on focus. A "Create new series" action is always available when there is no exact match (`showCreateOption`, `:56`; render `:146-157`).

### 8. Library card shows all genres

`components/ui/book-card.tsx:138-148` maps every genre chip (was first-only). `books-library.tsx` `toLibraryBook` maps `book.genres.map(...)` (`:136`) and `books-library-view.tsx` `LibraryBook.genres` is an array (`:35`).

### 9. Lists field (already correct — no code change)

`library-organization-section.tsx:159-180` — `Multiselect` shows existing lists as options, selected lists as chips (value), and an empty-state `t("organization.listsEmpty")` only when there are truly no lists. Documented here for completeness; no change in this commit.

## Known gaps / what's left

- **Validation messages are not fully localized.** Schema-driven errors surface the raw English Zod message through `FieldError` regardless of locale (e.g. "Price must be greater than 0", "Part number can't be greater than the total books in the series"), while FE-only validations use `t(...)` (e.g. `validateTag` in `tags-field.tsx:66-71`, the 0/negative check in `create-series-dialog.tsx:89`). Full i18n of validation messages is not done.
- **The locale-switch draft does not persist the cover image.** A selected `File` can't serialize, so after a language switch the cover selection is lost while every other field is restored (`book-form-draft.ts` envelope has no cover field).
- **Tag/series dropdown options are mouse-primary.** `onOpenAutoFocus` is prevented and `shouldFilter={false}`, so focus stays in the input and the cmdk list is not arrow-navigable — consistent with the existing `series-autocomplete` pattern but a keyboard-nav gap (`tags-field.tsx:131-134`, `series-autocomplete.tsx:117-120`). The delete-saved-tag button is also nested inside a `role="option"` (`CommandItem`); it works via `stopPropagation` (`tags-field.tsx:157-168`) but is invalid ARIA nesting.
- **No DB-level part-number uniqueness.** `assertSeriesPartNumberUnique` (`books.service.ts:518-537`) enforces it at the service layer, but there is no unique constraint on `(seriesId, partNumber)`, so a concurrent double-create could still collide.
- **Non-transactional taxonomy resolve.** Author / publisher / tag / series / list resolve-or-create runs before and outside the single `book.create` (`books.service.ts:187-216`). If the create fails, freshly created taxonomy rows are orphaned — benign (reusable, de-duplicated on retry) and kept this way for the `P2002` race-safe reread.
- **List/get eager-load all relations.** `GET /api/books` includes every conditional child + series + tags + lists per row; a lighter list projection is deferred until there is a measured performance need.
- **Vision not yet built.** A global Work/Edition catalog (for cross-user ratings / comments / tops) is envisioned but not built; cross-locale author search is open; the production DB is not yet seeded with authors / publishers (dev is). Series-progress recalculation (spec §9.7) is not implemented.
- No `TODO` / `FIXME` markers remain in the books / series / lists / tags source at the time of writing.

## Tests

Backend (Vitest): `apps/api/src/modules/books/application/books.service.test.ts`, and controller suites `api/books.controller.test.ts`, `books.controller.update.test.ts`, `books.controller.cover.test.ts`, `books.controller.author.test.ts`. Taxonomy modules each have `application/*.service.test.ts` + `api/*.controller.test.ts`. The 2026-06-27 commit extended `books.controller.test.ts`, `books.service.test.ts`, and `series.service.test.ts` for the part-number rules.

Frontend (Vitest browser-mode / Storybook): `cover-field.test.tsx`, plus stories for `create-book-form`, `edit-book-form`, `books-library-view`, `book-card`, `book-preview`, `cover-field`, and the autocompletes.

## Related

- Spec: `apps/api/md/new-book.md` (§6–§12)
- Architecture overview: `docs/architecture.md`
- Canonical backend workflow: `.claude/agents/backend-engineer.md`, `docs/code-principles.md`
- Feature index: `docs/features/README.md`
  </content>
  </invoke>

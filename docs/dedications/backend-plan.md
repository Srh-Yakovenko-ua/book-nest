# Dedications — backend plan

Backend-only plan for the "Присвяти" (Dedications) module. Spec lives locally in
`apps/api/md/dedications-docs-v1/` (gitignored). FE is out of scope (no `gen:api`).

## Product in one line

A book appears on `/dedications` when its author-dedication text is non-empty.
The user browses/searches/filters/sorts those dedications, opens the book, copies
the text, and marks a dedication as favorite — a favorite state that is strictly
separate from the book favorite.

## What already exists (reuse, do not rebuild)

- `Book.dedication String?` (schema `dedication` column) + `BookView.dedication`
  - `DedicationSchema` in the create/update book schemas. The text field is done.
- Favorite pattern to mirror: `isFavorite` + `applyFavoriteFields` +
  `resolveFavoriteChange` (handled OUTSIDE `SCALAR_KEYS` to stay independent).
- Wishlist read (`GET /api/books/wishlist`, `wishlist.service.ts`,
  `listWishlistBooks` with `WISHLIST_MAX_BOOKS=1000` + warn-log,
  `domain/wishlist-summary.ts`) — the freshest "filtered subset of books +
  summary, return-all-capped" precedent. Dedications mirrors it 1:1.
- `favorites-summary` — the stats-summary endpoint precedent.
- `BookViewAssembler.viewOf` / `toBookView`.

## Decisions

1. **New `isFavoriteDedication Boolean @default(false)` on Book**, strictly
   independent of `isFavorite` (hard spec rule, TC-014/015/016). Handled OUTSIDE
   `SCALAR_KEYS` via `applyFavoriteDedicationFields`, mirroring `isFavorite`.
   **No `favorite_dedication_added_at` timestamp** — `favorites_first` sort only
   needs the boolean and the spec does not ask for a timestamp.
2. **Keep the `dedication` column name** (`authorDedication` is just the spec
   alias). **Bump `BOOK_DEDICATION_MAX` 1000 → 2000** (spec MVP). **Normalize an
   empty/whitespace-only dedication to `null` on write** so "has a dedication" =
   `dedication IS NOT NULL` holds (TC-003). **Auto-reset
   `isFavoriteDedication → false` when the dedication is cleared** (spec allows it;
   keeps the invariant "no favorite dedication without a dedication").
3. **`GET /api/books/dedications` → `{ books: BookView[], summary }`**, mirroring
   the wishlist: return-all-capped (`DEDICATIONS_MAX_BOOKS`), **FE does
   search/filter/sort/pagination** (the spec explicitly allows FE derivation for
   MVP; the 6 sorts / 4 filters / genre filter are client-side URL state).
   `isFavoriteDedication` is added to `BookView` (a cheap scalar column, needed by
   both this page and the Book Details dedication block; the fixture ripple is
   mechanical, exactly like `isFavorite`). The favorite toggle rides the existing
   `PATCH /api/books/:id`. `buildBookSearchConditions` is NOT changed (dedication
   text search is client-side); global-search integration is FE/deferred.
4. **Summary** (`computeDedicationsSummary`, pure, computed in-memory over the
   loaded set like `wishlist-summary`): total, favorites, from-finished,
   from-unfinished, top genre, top author (tie → highest count then alphabetical).

## Slices (all inside `modules/books/`)

- **S1 Foundations + field end-to-end** — `is_favorite_dedication` column +
  additive migration (strip the 4 spurious DROP INDEX lines) + shared
  (`BookView += isFavoriteDedication`, `UpdateBook += isFavoriteDedication`,
  `BOOK_DEDICATION_MAX → 2000`, dedication empty→null normalization, new
  `DedicationsSummaryViewSchema` + `DedicationsViewSchema`) + `toBookView` +
  book service (`applyFavoriteDedicationFields` independent handling + auto-reset
  on clear + empty→null) + fixture updates (apps + web) + tests
  (independence TC-014/015/016, empty→null, auto-reset, max 2000).
- **S2 Dedications read** — repo `listDedicationBooks` (`where { userId,
dedication not null (and not "") }`, `take DEDICATIONS_MAX_BOOKS` + warn-log) +
  pure `computeDedicationsSummary` + `DedicationsService` + `GET
/api/books/dedications` on `books.controller` (before `:id`, throttled, guarded)
  returning `{ books, summary }`. Tests.

## Out of scope / deferred

- All FE (`/dedications` page, Book Details dedication block UI, `gen:api`).
- Server-side pagination / dedication-text search / global-search indexing
  (FE-derived for MVP per the spec).
- `${bookId}:dedication` composite id + nested `BookDedication` struct (spec's
  full-version, explicitly not MVP).

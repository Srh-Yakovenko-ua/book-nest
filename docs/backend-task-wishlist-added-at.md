# Wishlist entry date: finishing the migration and the summary counts

## What this is

Branch `feat/wishlist-added-at` adds `Book.wishlistAddedAt` and the rule that keeps it correct. The code is written, typechecks, and lints clean. **The Prisma migration is missing**, and no API test has ever been run against it.

The machine this was written on has no Postgres, no Docker, and no `apps/api/.env`, so the migration could not be generated and the API suite could not be executed. Everything else was verified.

Please do not merge this branch until step 1 and step 2 below are green.

## Why the branch is currently unmergeable

`schema.prisma` declares `wishlist_added_at`, and the generated Prisma client selects it in every book query. No migration file exists, so:

- CI builds its test database from `prisma/migrations/` (`apps/api/src/test/global-setup.ts`, `prisma migrate deploy`). The column will not exist there.
- Every API test that touches a book will fail with `42703: column "wishlist_added_at" does not exist`.
- If the CI gate were bypassed, `apps/api/docker-entrypoint.sh` runs `migrate deploy` on boot, finds nothing to apply, and the container starts healthy while every book endpoint returns 500. The health check does not read books, so nothing would notice.

## Step 1: generate the migration

```bash
pnpm db:up
pnpm --filter @app/api db:migrate --name add_wishlist_added_at
```

`--name` is required. A bare `prisma migrate dev` blocks forever on the interactive name prompt in a non-TTY shell.

Then open the generated `migration.sql` and make two edits before applying anything.

### Edit 1: strip the spurious DROP INDEX lines

Ten indexes live in hand-written SQL and are not expressible in `schema.prisma`, so every generated migration emits a `DROP INDEX` for each of them. Delete those lines. `apps/api/src/core/database/raw-sql-indexes.test.ts` asserts all ten still exist, so a forgotten strip turns CI red rather than silently dropping the invariant. The full list and the reasoning are in `CLAUDE.md`, section 6.

### Edit 2: add the backfill

The generated SQL will only add the column. Add this, or every book already sitting in the wishlist reads as "entry date unknown" forever and both time-based counts come out as zero on day one:

```sql
UPDATE "books"
SET "wishlist_added_at" = "created_at"
WHERE "ownership_status" = 'want_to_buy'
  AND "deleted_at" IS NULL;
```

`created_at` is an approximation. A book that sat at `none` for months and moved to the wishlist yesterday will read as old. It is the only signal available, and the alternative is no data at all. If you would rather ship honest NULLs, drop this statement and say so, because it changes what card 1 and card 4 show.

Consider adding a partial index while you are here. The two counts filter on this column for one user at a time:

```sql
CREATE INDEX "books_user_wishlist_added_at_idx"
  ON "books" ("user_id", "wishlist_added_at")
  WHERE "wishlist_added_at" IS NOT NULL AND "deleted_at" IS NULL;
```

If you add it, it becomes an eleventh hand-written index: add it to `raw-sql-indexes.test.ts` and to the `CLAUDE.md` list, or the next migration will silently drop it.

Apply with:

```bash
pnpm --filter @app/api db:migrate:deploy
```

## Step 2: run the API suite

```bash
pnpm --filter @app/api test
```

These files were changed by hand to match the new patch shape and have never been executed:

- `apps/api/src/modules/books/domain/wishlist-added-at.test.ts` (new, 10 cases)
- `apps/api/src/modules/books/domain/ownership-transition.test.ts`
- `apps/api/src/modules/books/application/book-ownership.service.test.ts`
- `apps/api/src/modules/delivery/domain/delivery-transition.test.ts`
- `apps/api/src/modules/quotes/application/quotes.service.test.ts`

Expect the possibility that a controller integration test asserts an exact book response body and now needs `wishlistAddedAt` added.

## What the rule is

One domain module, `apps/api/src/modules/books/domain/wishlist-added-at.ts`:

- a book created as `want_to_buy` gets the date;
- any transition into `want_to_buy` sets a fresh date, including a re-add;
- any transition out of `want_to_buy` clears it;
- editing a book that stays in the wishlist does not touch the date;
- transitions that never involve the wishlist do not touch it.

It is applied in five places. Three of them are not in the original task description but would have broken the invariant:

| Path                  | File                                              |
| --------------------- | ------------------------------------------------- |
| create                | `books.service.ts`                                |
| update                | `book-update-fields.ts` via `applyWishlistFields` |
| ownership endpoints   | `ownership-transition.ts`                         |
| bulk status change    | `bulk-books.repository.ts`                        |
| delivery cancellation | `delivery-transition.ts`                          |

Bulk is the subtle one. A single `updateMany` setting `want_to_buy` would have reset the date on books that were already in the wishlist, so the date is stamped in a separate statement filtered to `ownershipStatus: { not: "want_to_buy" }` and that statement runs before the status change.

Delivery cancellation with "keep as want to buy" is a genuine re-add and stamps a fresh date.

## Step 3: the four summary counts

Not started. The field exists so these become possible.

The wishlist page needs four static, non-clickable stat cards. Return the aggregates from the wishlist summary endpoint (`WishlistSummaryViewSchema` in `packages/shared/src/book-store-links.ts`, assembled in `wishlist.service.ts`). Use `wishlistAddedAt` for anything time-based, never `createdAt`.

1. **Total to buy.** Count of `want_to_buy`. Sub-line: how many have `wishlistAddedAt` within the last 30 days.
2. **Missing from series.** Wishlist books that fill an interior gap in a series the user already owns part of. Sub-line: number of distinct series.
3. **Next in series.** Wishlist books that come after the last part the user has, rather than filling a gap. Must not double-count anything already in card 2. Sub-line: number of distinct series.
4. **Waiting a long time.** Wishlist books whose `wishlistAddedAt` is older than 6 months.

For cards 2 and 3, the rule that matches the examples in the task: within a series, take the highest `partNumber` among books that are **not** in the wishlist. A wishlist book below that number fills a gap; above it, it continues the series.

Two cases the task does not settle, which need a decision before implementing:

- A series where the user has no books outside the wishlist. There is no "last part you have", so nothing is being continued and no gap is being filled. Counting them in neither card is the reading that matches the wording, but it is a guess.
- Wishlist books with `partNumber` of null cannot be placed in either card and have to be excluded.

The current summary is computed in memory from the wishlist rows (`wishlist.service.ts`), which is fine for the counts in cards 1 and 4 but not for 2 and 3: those need the series' other books, which the wishlist query does not load. Expect a new repository query rather than an extension of the existing one.

`WishlistSummaryView` is consumed by `apps/web/src/features/books-to-buy`. The sidebar stats block was removed in `feat/wishlist-unset-ownership`, so nothing renders these numbers yet; the frontend cards are a separate piece of work.

## Frontend note

`feat/wishlist-unset-ownership` is the frontend branch and is independent of this one. It is green and mergeable on its own. If it lands first, rebase this branch onto the updated `dev`; the only likely conflicts are in the generated API client, which you should resolve by rerunning `pnpm gen:api` rather than by hand.

## What was verified

- `pnpm typecheck` across all three packages
- `pnpm lint`, 0 errors
- `pnpm exec prettier --check` on every changed file
- `pnpm gen:api` regenerated and committed

## What was not

- the migration, because there is no database on that machine
- every API test, for the same reason
- any runtime behaviour of the new field

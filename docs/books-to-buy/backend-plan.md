# Books to Buy — backend plan

Backend-only plan for the "Books to Buy" (purchase wishlist) module. Spec lives
locally in `apps/api/md/books-to-buy/` (gitignored). This file records the design
decisions and the slice breakdown. FE is out of scope (no `gen:api`).

## Product in one line

A book is on the wishlist when `ownershipStatus === "want_to_buy"`. The user
attaches store links (many per book), compares prices via a derived best offer,
and moves the book onward: mark as bought (`→ owned`), remove from the list
(`→ none`), or start delivery (`→ in_transit`).

## What already exists (reuse, do not rebuild)

- Ownership enum + transitions: `book-ownership.service.ts` — `markBought`
  (`want_to_buy → owned`), `markOwned`, `wantToBuy` (`none → want_to_buy`),
  `removeOwned` (`owned → none`). Pure builder `ownership-transition.ts`.
- Delivery "move to in_transit": `POST /api/books/:id/deliveries` already accepts
  `want_to_buy` and sets `ownershipStatus="in_transit"` + delivery `status="ordered"`.
  Zero new delivery code.
- `BookPurchaseInfo` (1:1 recorded purchase): storeName/storeUrl/expectedPrice/
  currency/note/purchasedAt. Kept as-is — it is the "where/when I bought it"
  record, distinct from wishlist offers.
- Money/validation schemas: `OwnershipStoreNameSchema` (≤100, trim, no-HTML),
  `OwnershipStoreUrlSchema` (https-only, ≤300), `OwnershipPriceSchema` (`>0`,
  ≤99999999.99), `CurrencySchema` (`UAH|USD|EUR`).
- 1:N per-user child-table pattern to mirror: `UserSocialLink` +
  `social-link.repository.ts`/`social-link.service.ts` (optional trailing
  `client: Prisma.TransactionClient = this.prisma`, transactional count-then-cap,
  ownership → NotFound, dup guard via ConflictError).
- Summary endpoint pattern: `GET /api/books/favorites-summary` (coexists with
  `GET /api/books/:id` — static segment does not clash).

## Decisions

1. **New `BookStoreLink` (1:N) table, coexists with `BookPurchaseInfo` (1:1).**
   They serve different purposes (wishlist offers to compare vs the single
   recorded purchase). Additive; `BookPurchaseInfo`, `BookView.purchaseInfo`, and
   `recentPurchaseStores` are untouched.
2. **`BookView` is not modified.** Store links would bloat the library list query
   (loaded per book) and ripple across every `BookView` producer/fixture. Instead:
   a dedicated `GET /api/books/:id/store-links` for Book Details, and inline store
   links in the wishlist endpoint.
3. **Wishlist read returns the full enriched list + summary; search/filter/sort is
   client-side.** Mirrors the series page — a personal `want_to_buy` set is
   bounded. No server pagination, no store-name search on the BE (the FE has the
   links). Keeps the library query clean.
4. **Reuse the existing money/url/store-name schemas.** URL is https-only, price is
   `>0` (empty = unknown price; a 0 offer is not a real offer), store name ≤100,
   currency enum default `UAH` when a price is given without one. New
   `want_to_buy → none` transition for remove-from-wishlist. mark-bought and
   move-to-in_transit are reused unchanged (add `{ code }` for the stale case so
   the FE can map the copy).
5. **Best offer** per book = the lowest-price link among links that have a price
   (tie → earliest `createdAt`), with its currency attached. Page summary groups
   the estimate/average by currency, no conversion. MVP simplification: a single
   book with mixed-currency links takes a raw numeric min (rare; currency is
   surfaced). Price sorts (FE) use best offer, books without a price last.
6. **Uniqueness `(bookId, url)`** (bookId implies the owner) via a normal Prisma
   `@@unique` — exact match, no raw SQL, no strip-trap. **Max 20 links per book.**

## Slices (all inside `modules/books/`, like book-delivery / book-ownership)

- **S1 Foundations** — `BookStoreLink` model (`id, userId, bookId, storeName, url,
price Decimal?(10,2), currency String?, createdAt, updatedAt`; FK book + user
  `onDelete: Cascade`; `@@unique([bookId, url])`, `@@index([bookId])`,
  `@@index([userId])`, `@@map("book_store_links")`) + additive migration
  (strip the spurious DROP INDEX for the 4 raw-SQL indexes before deploy) + shared
  DTOs (`BookStoreLinkViewSchema`, `Create/UpdateBookStoreLinkInputSchema`,
  `BestOfferViewSchema`, error codes, `MAX_STORE_LINKS_PER_BOOK`) + barrel.
- **S2 Store-link CRUD** — repository + service + controller:
  `POST/PATCH/DELETE /api/books/:id/store-links(/:linkId)` + `GET
/api/books/:id/store-links` (links + best offer). Dedup-url (pre-check + P2002
  catch), cap (transactional count-then-create), best offer as a pure domain
  function. Tests.
- **S3 Remove from wishlist** — `computeOwnershipChange` case `want_to_buy → none`
  - service `removeFromWishlist` + `POST /api/books/:id/ownership/remove-from-wishlist`
  - stale `{ code }`. Store links persist. Tests.
- **S4 Wishlist read** — `GET /api/books/wishlist` → `{ books (enriched:
storeLinks, bestOffer, linkCount, hasPrice, trackedStores), summary (count, avg
best offer by currency, min best offer, tracked-stores count, top-3 cheapest) }`.
  Tests.

## Out of scope / deferred

- All FE (`/books-to-buy` page, Book Details purchase block UI, `gen:api`).
- Dashboard/Statistics aggregates (cross-feature, not MVP critical path).
- Cached `isBestOffer`/best-offer column (spec says derive; add only under a
  measured need).

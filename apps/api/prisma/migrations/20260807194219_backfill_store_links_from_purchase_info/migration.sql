-- Migration A of docs/backend-task-wishlist-store-links.md — data only, no DDL.
--
-- The "want to buy" dialog used to write the store and price into book_purchase_info,
-- while the wishlist page reads book_store_links. On the dev account that hid 29 store
-- urls and 30 prices behind a page reporting "0 stores tracked". The write path was
-- fixed in the preceding release; this moves the rows already recorded under the old one.
--
-- Non-destructive on purpose: book_purchase_info is left exactly as it is. Blanking the
-- duplicated columns is migration B, and it runs only once this one is verified on real
-- data.
--
-- Deliberately NOT filtered by books.deleted_at: a trashed book keeps its link, so
-- restoring it later still restores where to buy it.

-- purchased_at IS NULL is the guard that separates "where I mean to buy it" from "where
-- I did buy it" — the latter legitimately belongs to purchase info and must not be
-- duplicated into a store link.
--
-- store_name is NOT NULL here, so it falls back to the url host and then to the url
-- itself; no locale-specific placeholder, since the app is bilingual and the reader can
-- rename it. currency defaults to UAH only when there is a price to denominate, matching
-- DEFAULT_CURRENCY in packages/shared/src/book-store-links.ts.
--
-- ON CONFLICT keeps a re-run idempotent and yields to any link added by hand meanwhile.
INSERT INTO "book_store_links" (
  "id",
  "user_id",
  "book_id",
  "store_name",
  "url",
  "price",
  "currency",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  b."user_id",
  p."book_id",
  COALESCE(
    NULLIF(btrim(p."store_name"), ''),
    NULLIF(substring(btrim(p."store_url") FROM '^https?://([^/?#]+)'), ''),
    btrim(p."store_url")
  ),
  btrim(p."store_url"),
  p."expected_price",
  CASE
    WHEN p."expected_price" IS NULL THEN p."currency"
    ELSE COALESCE(p."currency", 'UAH')
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "book_purchase_info" p
JOIN "books" b ON b."id" = p."book_id"
WHERE p."purchased_at" IS NULL
  AND p."store_url" IS NOT NULL
  AND btrim(p."store_url") <> ''
ON CONFLICT ("book_id", "url") DO NOTHING;

-- A price with no url cannot become a store link: url is NOT NULL and is the whole point
-- of the row. Those rows stay in purchase info untouched, and migration B must skip them
-- as well. Their number is checked after deploy against the API rather than raised as a
-- NOTICE here: a DO $$ block would be the first dollar-quoted statement in this repo, and
-- there is no way to prove it survives the migration runner's statement splitting without
-- a database to try it on. A logging nicety is not worth risking the whole migration.

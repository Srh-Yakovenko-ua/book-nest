-- Migration B of docs/backend-task-wishlist-store-links.md — data only, no DDL.
--
-- Migration A copied the planned store into book_store_links and deliberately left the
-- originals in place, so nothing was lost if it read the data wrong. It read it right:
-- 29 of 29 rows carrying a store url became links. This removes the copy that is now
-- duplicated, leaving book_store_links as the only answer to "where can I buy this".
--
-- Destructive by design, which is why it is a separate migration and why the code that
-- read and wrote these columns for a wanted book was removed first. Without that step a
-- single save of the book form would have written them straight back.
--
-- The columns themselves stay: for a book that WAS bought, store_name / expected_price /
-- currency describe the purchase that happened, and purchased_at IS NULL keeps those rows
-- out of reach here.

-- Only rows whose data actually made it into a link are cleared. A planned purchase that
-- never named a url (2 rows on dev — a price with no shop) has no link to fall back on,
-- so it keeps what it has rather than losing it to a cleanup.
--
-- note is not touched: a store link has no field for it, and the book page still shows it.
UPDATE "book_purchase_info" p
SET
  "store_name" = NULL,
  "store_url" = NULL,
  "expected_price" = NULL,
  "currency" = NULL,
  "updated_at" = CURRENT_TIMESTAMP
WHERE p."purchased_at" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "book_store_links" l
    WHERE l."book_id" = p."book_id"
      AND l."url" = btrim(p."store_url")
  );

-- A row that now holds nothing at all is not a record of anything. Dropping it keeps
-- "has purchase info" meaning "there is something to say about buying this book", which
-- is what the book page and the ownership block both test for.
DELETE FROM "book_purchase_info"
WHERE "purchased_at" IS NULL
  AND "store_name" IS NULL
  AND "store_url" IS NULL
  AND "expected_price" IS NULL
  AND "currency" IS NULL
  AND "note" IS NULL;

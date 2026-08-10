-- AlterTable
ALTER TABLE "books" ADD COLUMN     "wishlist_added_at" TIMESTAMPTZ;

-- Backfill: books already sitting in the wishlist have no entry date, so both
-- time-based counts would read zero on day one. created_at is an approximation
-- and overstates the age of a book that sat at 'none' for months before moving
-- to the wishlist, but it is the only signal that exists.
UPDATE "books"
SET "wishlist_added_at" = "created_at"
WHERE "ownership_status" = 'want_to_buy';

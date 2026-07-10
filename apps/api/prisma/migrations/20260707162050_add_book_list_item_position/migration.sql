-- AlterTable
ALTER TABLE "book_list_items" ADD COLUMN "added_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "book_list_items" ADD COLUMN "position" INTEGER;

UPDATE "book_list_items" bli
SET "position" = sub.rn
FROM (
  SELECT list_id, book_id,
         row_number() OVER (PARTITION BY list_id ORDER BY book_id) AS rn
  FROM "book_list_items"
) sub
WHERE bli.list_id = sub.list_id AND bli.book_id = sub.book_id;

ALTER TABLE "book_list_items" ALTER COLUMN "position" SET NOT NULL;

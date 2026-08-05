-- AlterTable
ALTER TABLE "books" ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "books_user_id_deleted_at_idx" ON "books"("user_id", "deleted_at");

-- A trashed book must stop holding its slot in the series, otherwise the user
-- cannot re-add part N until the trash is emptied. The index name is kept so
-- book-relations-resolver keeps mapping P2002 to a friendly conflict error.
DROP INDEX "books_series_id_part_number_key";
CREATE UNIQUE INDEX "books_series_id_part_number_key" ON "books"("series_id", "part_number") WHERE "deleted_at" IS NULL;

-- Reading-queue reads, shifts and resequences all exclude trashed books.
DROP INDEX "books_user_queue_position_idx";
CREATE INDEX "books_user_queue_position_idx" ON "books"("user_id", "queue_position") WHERE "queue_position" IS NOT NULL AND "deleted_at" IS NULL;

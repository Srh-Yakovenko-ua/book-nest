-- AlterTable
ALTER TABLE "book_lists" ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "book_lists_user_id_deleted_at_idx" ON "book_lists"("user_id", "deleted_at");

-- A trashed list must release its name so the user can create a new list with
-- the same title. The index name is kept so lists.service keeps mapping P2002
-- on it to the friendly "name already taken" conflict.
DROP INDEX "book_lists_user_id_normalized_name_key";
CREATE UNIQUE INDEX "book_lists_user_id_normalized_name_key" ON "book_lists"("user_id", "normalized_name") WHERE "deleted_at" IS NULL;

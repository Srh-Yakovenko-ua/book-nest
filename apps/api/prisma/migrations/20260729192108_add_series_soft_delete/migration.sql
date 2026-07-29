-- AlterTable
ALTER TABLE "series" ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "series_user_id_deleted_at_idx" ON "series"("user_id", "deleted_at");

-- A trashed series must release its name so the user can create a new series
-- with the same title. The index name is kept so series.service keeps mapping
-- P2002 on it to the friendly "name already taken" conflict.
DROP INDEX "series_user_id_normalized_name_key";
CREATE UNIQUE INDEX "series_user_id_normalized_name_key" ON "series"("user_id", "normalized_name") WHERE "deleted_at" IS NULL;

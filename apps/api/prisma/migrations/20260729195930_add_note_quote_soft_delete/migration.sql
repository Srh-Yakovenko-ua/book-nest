-- AlterTable
ALTER TABLE "notes" ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "notes_user_id_deleted_at_idx" ON "notes"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "quotes_user_id_deleted_at_idx" ON "quotes"("user_id", "deleted_at");

-- AlterTable
ALTER TABLE "book_timelines" ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "book_timelines_book_id_deleted_at_idx" ON "book_timelines"("book_id", "deleted_at");

-- AlterTable
ALTER TABLE "book_characters" ADD COLUMN     "importance_rank" INTEGER NOT NULL DEFAULT 5;

-- Backfill
UPDATE "book_characters"
SET "importance_rank" = CASE "importance"
  WHEN 'central' THEN 0
  WHEN 'major' THEN 1
  WHEN 'supporting' THEN 2
  WHEN 'episodic' THEN 3
  WHEN 'mentioned' THEN 4
  ELSE 5
END;

-- CreateIndex
CREATE INDEX "book_characters_book_id_importance_rank_idx" ON "book_characters"("book_id", "importance_rank");

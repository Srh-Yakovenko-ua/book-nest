-- AlterTable
ALTER TABLE "book_characters" ADD COLUMN     "is_unreliable_narrator" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_unreliable_narrator_spoiler" BOOLEAN NOT NULL DEFAULT false;

-- Backfill
UPDATE "book_characters" SET "is_unreliable_narrator" = true, "narrator_type" = NULL WHERE "narrator_type" = 'unreliable';

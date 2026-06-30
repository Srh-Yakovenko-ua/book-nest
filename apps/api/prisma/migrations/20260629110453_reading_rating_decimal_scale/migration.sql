-- AlterTable
ALTER TABLE "book_reading_progress" ALTER COLUMN "rating" SET DATA TYPE DOUBLE PRECISION;

-- Convert legacy 1-5 integer ratings to the new 0.5-10 scale
UPDATE "book_reading_progress" SET "rating" = "rating" * 2 WHERE "rating" IS NOT NULL;

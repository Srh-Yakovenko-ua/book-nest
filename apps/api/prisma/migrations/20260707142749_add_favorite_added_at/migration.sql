-- AlterTable
ALTER TABLE "books" ADD COLUMN     "favorite_added_at" TIMESTAMPTZ;

-- Backfill existing favorites so they carry a meaningful timestamp
UPDATE "books" SET "favorite_added_at" = "created_at" WHERE "is_favorite" = true AND "favorite_added_at" IS NULL;

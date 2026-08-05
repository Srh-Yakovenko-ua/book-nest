ALTER TABLE "books" ADD COLUMN "purge_at" TIMESTAMPTZ;
ALTER TABLE "series" ADD COLUMN "purge_at" TIMESTAMPTZ;
ALTER TABLE "notes" ADD COLUMN "purge_at" TIMESTAMPTZ;
ALTER TABLE "book_lists" ADD COLUMN "purge_at" TIMESTAMPTZ;
ALTER TABLE "quotes" ADD COLUMN "purge_at" TIMESTAMPTZ;
ALTER TABLE "book_timelines" ADD COLUMN "purge_at" TIMESTAMPTZ;
ALTER TABLE "characters" ADD COLUMN "purge_at" TIMESTAMPTZ;

UPDATE "books" SET "purge_at" = "deleted_at" + INTERVAL '90 days' WHERE "deleted_at" IS NOT NULL;
UPDATE "series" SET "purge_at" = "deleted_at" + INTERVAL '90 days' WHERE "deleted_at" IS NOT NULL;
UPDATE "notes" SET "purge_at" = "deleted_at" + INTERVAL '90 days' WHERE "deleted_at" IS NOT NULL;
UPDATE "book_lists" SET "purge_at" = "deleted_at" + INTERVAL '90 days' WHERE "deleted_at" IS NOT NULL;
UPDATE "quotes" SET "purge_at" = "deleted_at" + INTERVAL '90 days' WHERE "deleted_at" IS NOT NULL;
UPDATE "book_timelines" SET "purge_at" = "deleted_at" + INTERVAL '90 days' WHERE "deleted_at" IS NOT NULL;
UPDATE "characters" SET "purge_at" = "deleted_at" + INTERVAL '90 days' WHERE "deleted_at" IS NOT NULL;

ALTER TABLE "books" ADD CONSTRAINT "books_purge_at_matches_deleted_at" CHECK (("deleted_at" IS NULL) = ("purge_at" IS NULL));
ALTER TABLE "series" ADD CONSTRAINT "series_purge_at_matches_deleted_at" CHECK (("deleted_at" IS NULL) = ("purge_at" IS NULL));
ALTER TABLE "notes" ADD CONSTRAINT "notes_purge_at_matches_deleted_at" CHECK (("deleted_at" IS NULL) = ("purge_at" IS NULL));
ALTER TABLE "book_lists" ADD CONSTRAINT "book_lists_purge_at_matches_deleted_at" CHECK (("deleted_at" IS NULL) = ("purge_at" IS NULL));
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_purge_at_matches_deleted_at" CHECK (("deleted_at" IS NULL) = ("purge_at" IS NULL));
ALTER TABLE "book_timelines" ADD CONSTRAINT "book_timelines_purge_at_matches_deleted_at" CHECK (("deleted_at" IS NULL) = ("purge_at" IS NULL));
ALTER TABLE "characters" ADD CONSTRAINT "characters_purge_at_matches_deleted_at" CHECK (("deleted_at" IS NULL) = ("purge_at" IS NULL));

DROP INDEX "books_deleted_at_idx";
DROP INDEX "series_deleted_at_idx";
DROP INDEX "notes_deleted_at_idx";
DROP INDEX "book_lists_deleted_at_idx";
DROP INDEX "quotes_deleted_at_idx";
DROP INDEX "book_timelines_deleted_at_idx";

CREATE INDEX "books_purge_at_idx" ON "books"("purge_at");
CREATE INDEX "series_purge_at_idx" ON "series"("purge_at");
CREATE INDEX "notes_purge_at_idx" ON "notes"("purge_at");
CREATE INDEX "book_lists_purge_at_idx" ON "book_lists"("purge_at");
CREATE INDEX "quotes_purge_at_idx" ON "quotes"("purge_at");
CREATE INDEX "book_timelines_purge_at_idx" ON "book_timelines"("purge_at");
CREATE INDEX "characters_purge_at_idx" ON "characters"("purge_at");

-- A trashed timeline must release its name, matching how a trashed series or
-- list releases theirs. Without this a user hits "name already taken" for a
-- timeline they cannot see anywhere. The index name is kept so
-- TimelineService keeps mapping P2002 on it to the duplicate-name conflict.
DROP INDEX "book_timelines_book_id_name_lower_idx";
CREATE UNIQUE INDEX "book_timelines_book_id_name_lower_idx" ON "book_timelines"("book_id", lower("name")) WHERE "deleted_at" IS NULL;

-- The hourly purge reconcilers scan `deleted_at < $1` across all users, which the
-- (user_id, deleted_at) indexes cannot serve because their leading column is
-- unbounded. Without these each sweep is a seq scan plus a sort.
CREATE INDEX "books_deleted_at_idx" ON "books"("deleted_at");
CREATE INDEX "series_deleted_at_idx" ON "series"("deleted_at");
CREATE INDEX "book_lists_deleted_at_idx" ON "book_lists"("deleted_at");
CREATE INDEX "notes_deleted_at_idx" ON "notes"("deleted_at");
CREATE INDEX "quotes_deleted_at_idx" ON "quotes"("deleted_at");
CREATE INDEX "book_timelines_deleted_at_idx" ON "book_timelines"("deleted_at");

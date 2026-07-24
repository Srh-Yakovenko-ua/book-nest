-- DropIndex
DROP INDEX "book_lists_user_id_idx";

-- DropIndex
DROP INDEX "books_user_id_idx";

-- DropIndex
DROP INDEX "character_graph_layouts_user_id_idx";

-- DropIndex
DROP INDEX "character_groups_user_id_idx";

-- DropIndex
DROP INDEX "character_relationships_user_id_idx";

-- DropIndex
DROP INDEX "character_theories_user_id_idx";

-- DropIndex
DROP INDEX "characters_user_id_idx";

-- DropIndex
DROP INDEX "delivery_services_user_id_idx";

-- DropIndex
DROP INDEX "genres_user_id_idx";

-- DropIndex
DROP INDEX "notes_user_id_idx";

-- DropIndex
DROP INDEX "series_user_id_idx";

-- DropIndex
DROP INDEX "tags_user_id_idx";

-- CreateIndex
CREATE INDEX "book_deliveries_user_id_status_idx" ON "book_deliveries"("user_id", "status");

-- CreateIndex
CREATE INDEX "book_loans_user_id_status_idx" ON "book_loans"("user_id", "status");

-- CreateIndex
CREATE INDEX "books_user_id_created_at_id_idx" ON "books"("user_id", "created_at" DESC, "id");

-- CreateIndex
CREATE INDEX "books_user_id_ownership_status_idx" ON "books"("user_id", "ownership_status");

-- CreateIndex
CREATE INDEX "books_user_id_reading_status_idx" ON "books"("user_id", "reading_status");

-- CreateIndex
CREATE INDEX "books_publisher_id_idx" ON "books"("publisher_id");

-- CreateIndex (partial: reading-queue reads/shifts/resequences filter queue_position IS NOT NULL; Prisma cannot express a partial index)
CREATE INDEX IF NOT EXISTS "books_user_queue_position_idx" ON "books"("user_id", "queue_position") WHERE "queue_position" IS NOT NULL;

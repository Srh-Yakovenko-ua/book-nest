-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "book_id" UUID,
    "series_id" UUID,
    "text" TEXT NOT NULL,
    "category" TEXT,
    "custom_category" TEXT,
    "chapter" TEXT,
    "page" INTEGER,
    "is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notes_user_id_idx" ON "notes"("user_id");

-- CreateIndex
CREATE INDEX "notes_book_id_idx" ON "notes"("book_id");

-- CreateIndex
CREATE INDEX "notes_series_id_idx" ON "notes"("series_id");

-- CreateIndex
CREATE INDEX "notes_user_id_entity_type_idx" ON "notes"("user_id", "entity_type");

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce that exactly one target entity (book or series) is set
ALTER TABLE "notes" ADD CONSTRAINT "notes_single_entity_check" CHECK (
    ("book_id" IS NOT NULL AND "series_id" IS NULL)
    OR ("book_id" IS NULL AND "series_id" IS NOT NULL)
);

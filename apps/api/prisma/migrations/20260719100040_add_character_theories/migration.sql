-- CreateTable
CREATE TABLE "character_theories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "character_id" UUID,
    "book_id" UUID,
    "series_id" UUID,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unverified',
    "is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "character_theories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "character_theories_user_id_idx" ON "character_theories"("user_id");

-- CreateIndex
CREATE INDEX "character_theories_character_id_idx" ON "character_theories"("character_id");

-- CreateIndex
CREATE INDEX "character_theories_book_id_idx" ON "character_theories"("book_id");

-- CreateIndex
CREATE INDEX "character_theories_series_id_idx" ON "character_theories"("series_id");

-- CreateIndex
CREATE INDEX "character_theories_user_id_status_idx" ON "character_theories"("user_id", "status");

-- AddForeignKey
ALTER TABLE "character_theories" ADD CONSTRAINT "character_theories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_theories" ADD CONSTRAINT "character_theories_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_theories" ADD CONSTRAINT "character_theories_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_theories" ADD CONSTRAINT "character_theories_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce that a theory targets at least one of character, book or series
ALTER TABLE "character_theories" ADD CONSTRAINT "character_theories_at_least_one_target_check" CHECK (
    "character_id" IS NOT NULL OR "book_id" IS NOT NULL OR "series_id" IS NOT NULL
);

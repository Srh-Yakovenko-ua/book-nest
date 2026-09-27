-- CreateTable
CREATE TABLE "note_rediscovery_impressions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "note_id" UUID NOT NULL,
    "surface" TEXT NOT NULL,
    "context_key" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "shown_on" DATE NOT NULL,
    "shown_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_rediscovery_impressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_post_finish_reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reading_cycle_id" UUID NOT NULL,
    "reviewed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_post_finish_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "note_rediscovery_impressions_note_id_shown_on_idx" ON "note_rediscovery_impressions"("note_id", "shown_on" DESC);

-- CreateIndex
CREATE INDEX "note_rediscovery_impressions_user_id_surface_context_key_sh_idx" ON "note_rediscovery_impressions"("user_id", "surface", "context_key", "shown_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "note_rediscovery_impressions_user_id_surface_context_key_no_key" ON "note_rediscovery_impressions"("user_id", "surface", "context_key", "note_id", "shown_on");

-- CreateIndex
CREATE INDEX "note_post_finish_reviews_reading_cycle_id_idx" ON "note_post_finish_reviews"("reading_cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "note_post_finish_reviews_user_id_reading_cycle_id_key" ON "note_post_finish_reviews"("user_id", "reading_cycle_id");

-- AddForeignKey
ALTER TABLE "note_rediscovery_impressions" ADD CONSTRAINT "note_rediscovery_impressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_rediscovery_impressions" ADD CONSTRAINT "note_rediscovery_impressions_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_post_finish_reviews" ADD CONSTRAINT "note_post_finish_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_post_finish_reviews" ADD CONSTRAINT "note_post_finish_reviews_reading_cycle_id_fkey" FOREIGN KEY ("reading_cycle_id") REFERENCES "book_reading_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

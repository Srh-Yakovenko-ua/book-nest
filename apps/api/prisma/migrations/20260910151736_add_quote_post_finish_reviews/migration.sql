-- CreateTable
CREATE TABLE "quote_post_finish_reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reading_cycle_id" UUID NOT NULL,
    "reviewed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_post_finish_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quote_post_finish_reviews_reading_cycle_id_idx" ON "quote_post_finish_reviews"("reading_cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_post_finish_reviews_user_id_reading_cycle_id_key" ON "quote_post_finish_reviews"("user_id", "reading_cycle_id");

-- AddForeignKey
ALTER TABLE "quote_post_finish_reviews" ADD CONSTRAINT "quote_post_finish_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_post_finish_reviews" ADD CONSTRAINT "quote_post_finish_reviews_reading_cycle_id_fkey" FOREIGN KEY ("reading_cycle_id") REFERENCES "book_reading_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

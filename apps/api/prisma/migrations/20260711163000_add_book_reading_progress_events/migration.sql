-- CreateTable
CREATE TABLE "book_reading_progress_events" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "page" INTEGER NOT NULL,
    "pages_read" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_reading_progress_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_reading_progress_events_book_id_date_idx" ON "book_reading_progress_events"("book_id", "date");

-- AddForeignKey
ALTER TABLE "book_reading_progress_events" ADD CONSTRAINT "book_reading_progress_events_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "book_reading_progress" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "current_page" INTEGER,
    "started_at" DATE,
    "finished_at" DATE,
    "paused_at" DATE,
    "abandoned_at" DATE,
    "rating" INTEGER,
    "note" TEXT,
    "impression" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_reading_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "book_reading_progress_book_id_key" ON "book_reading_progress"("book_id");

-- AddForeignKey
ALTER TABLE "book_reading_progress" ADD CONSTRAINT "book_reading_progress_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

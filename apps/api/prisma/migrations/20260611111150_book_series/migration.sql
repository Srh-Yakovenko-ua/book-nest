-- AlterTable
ALTER TABLE "books" ADD COLUMN     "part_number" INTEGER,
ADD COLUMN     "series_id" UUID;

-- CreateTable
CREATE TABLE "series" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "total_books" INTEGER,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "series_user_id_idx" ON "series"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "series_user_id_normalized_name_key" ON "series"("user_id", "normalized_name");

-- CreateIndex
CREATE INDEX "books_series_id_idx" ON "books"("series_id");

-- AddForeignKey
ALTER TABLE "series" ADD CONSTRAINT "series_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

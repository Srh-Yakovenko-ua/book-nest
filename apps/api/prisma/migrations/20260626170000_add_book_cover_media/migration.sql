-- AlterTable
ALTER TABLE "books" ADD COLUMN "cover_media_id" UUID;

-- CreateIndex
CREATE INDEX "books_cover_media_id_idx" ON "books"("cover_media_id");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

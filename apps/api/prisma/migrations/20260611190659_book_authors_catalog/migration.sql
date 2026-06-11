-- AlterTable
ALTER TABLE "authors" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "birth_year" INTEGER,
ADD COLUMN     "country_code" TEXT,
ADD COLUMN     "death_year" INTEGER,
ADD COLUMN     "open_library_key" TEXT,
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "wikidata_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "authors_wikidata_id_key" ON "authors"("wikidata_id");

-- CreateIndex
CREATE UNIQUE INDEX "authors_open_library_key_key" ON "authors"("open_library_key");

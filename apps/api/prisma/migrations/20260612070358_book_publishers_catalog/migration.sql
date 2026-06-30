-- AlterTable
ALTER TABLE "publishers" ADD COLUMN     "country_code" TEXT,
ADD COLUMN     "founded_year" INTEGER,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "website_url" TEXT,
ADD COLUMN     "wikidata_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "publishers_wikidata_id_key" ON "publishers"("wikidata_id");

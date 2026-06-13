-- AlterTable
ALTER TABLE "publishers" ADD COLUMN     "search_text" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "publisher_names" (
    "id" UUID NOT NULL,
    "publisher_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "publisher_names_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "publisher_names_publisher_id_idx" ON "publisher_names"("publisher_id");

-- CreateIndex
CREATE INDEX "publisher_names_normalized_name_idx" ON "publisher_names"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "publisher_names_publisher_id_locale_normalized_name_key" ON "publisher_names"("publisher_id", "locale", "normalized_name");

-- AddForeignKey
ALTER TABLE "publisher_names" ADD CONSTRAINT "publisher_names_publisher_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "publishers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigram search support for cross-locale publisher search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "publishers_search_text_trgm_idx" ON "publishers" USING gin ("search_text" gin_trgm_ops);

UPDATE "publishers" SET "search_text" = "normalized_name" WHERE "search_text" = '';

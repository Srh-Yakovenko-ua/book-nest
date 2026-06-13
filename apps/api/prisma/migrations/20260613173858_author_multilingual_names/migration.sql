-- AlterTable
ALTER TABLE "authors" ADD COLUMN     "search_text" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "author_names" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "author_names_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "author_names_author_id_idx" ON "author_names"("author_id");

-- CreateIndex
CREATE INDEX "author_names_normalized_name_idx" ON "author_names"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "author_names_author_id_locale_normalized_name_key" ON "author_names"("author_id", "locale", "normalized_name");

-- AddForeignKey
ALTER TABLE "author_names" ADD CONSTRAINT "author_names_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigram search support for cross-locale author search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "authors_search_text_trgm_idx" ON "authors" USING gin ("search_text" gin_trgm_ops);

UPDATE "authors" SET "search_text" = "normalized_name" WHERE "search_text" = '';

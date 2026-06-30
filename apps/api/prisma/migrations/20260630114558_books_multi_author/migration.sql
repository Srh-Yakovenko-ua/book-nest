-- CreateTable
CREATE TABLE "book_authors" (
    "book_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "book_authors_pkey" PRIMARY KEY ("book_id","author_id")
);

-- CreateIndex
CREATE INDEX "book_authors_author_id_idx" ON "book_authors"("author_id");

-- AddForeignKey
ALTER TABLE "book_authors" ADD CONSTRAINT "book_authors_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_authors" ADD CONSTRAINT "book_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "books" ADD COLUMN "first_author_name" TEXT NOT NULL DEFAULT '';

-- Backfill the join table from the existing single-author column
INSERT INTO "book_authors" ("book_id", "author_id", "position")
SELECT "id", "author_id", 0 FROM "books";

-- Backfill the denormalized sort key
UPDATE "books" b SET "first_author_name" = a."name"
FROM "authors" a WHERE a."id" = b."author_id";

-- CreateIndex
CREATE INDEX "books_user_id_first_author_name_idx" ON "books"("user_id", "first_author_name");

-- DropForeignKey
ALTER TABLE "books" DROP CONSTRAINT "books_author_id_fkey";

-- AlterTable
ALTER TABLE "books" DROP COLUMN "author_id";

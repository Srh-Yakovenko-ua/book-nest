-- CreateTable
CREATE TABLE "series_authors" (
    "series_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,

    CONSTRAINT "series_authors_pkey" PRIMARY KEY ("series_id","author_id")
);

-- CreateIndex
CREATE INDEX "series_authors_author_id_idx" ON "series_authors"("author_id");

-- AddForeignKey
ALTER TABLE "series_authors" ADD CONSTRAINT "series_authors_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_authors" ADD CONSTRAINT "series_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

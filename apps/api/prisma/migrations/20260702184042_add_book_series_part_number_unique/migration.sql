-- CreateIndex
CREATE UNIQUE INDEX "books_series_id_part_number_key" ON "books"("series_id", "part_number");

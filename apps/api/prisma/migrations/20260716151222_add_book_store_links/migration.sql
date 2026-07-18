-- CreateTable
CREATE TABLE "book_store_links" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "store_name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "price" DECIMAL(10,2),
    "currency" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_store_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_store_links_book_id_idx" ON "book_store_links"("book_id");

-- CreateIndex
CREATE INDEX "book_store_links_user_id_idx" ON "book_store_links"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_store_links_book_id_url_key" ON "book_store_links"("book_id", "url");

-- AddForeignKey
ALTER TABLE "book_store_links" ADD CONSTRAINT "book_store_links_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_store_links" ADD CONSTRAINT "book_store_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

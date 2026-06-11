-- AlterTable
ALTER TABLE "books" ADD COLUMN     "queue_position" INTEGER,
ADD COLUMN     "queue_priority" TEXT;

-- CreateTable
CREATE TABLE "book_lists" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_list_items" (
    "list_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,

    CONSTRAINT "book_list_items_pkey" PRIMARY KEY ("list_id","book_id")
);

-- CreateIndex
CREATE INDEX "book_lists_user_id_idx" ON "book_lists"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_lists_user_id_normalized_name_key" ON "book_lists"("user_id", "normalized_name");

-- CreateIndex
CREATE INDEX "book_list_items_book_id_idx" ON "book_list_items"("book_id");

-- AddForeignKey
ALTER TABLE "book_lists" ADD CONSTRAINT "book_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_list_items" ADD CONSTRAINT "book_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "book_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_list_items" ADD CONSTRAINT "book_list_items_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

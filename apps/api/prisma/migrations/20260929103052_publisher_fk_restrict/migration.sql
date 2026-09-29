-- DropForeignKey
ALTER TABLE "books" DROP CONSTRAINT "books_publisher_id_fkey";

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_publisher_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "publishers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

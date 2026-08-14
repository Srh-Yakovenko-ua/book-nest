-- DropForeignKey
ALTER TABLE "book_deliveries" DROP CONSTRAINT "book_deliveries_user_id_fkey";

-- DropForeignKey
ALTER TABLE "book_deliveries" DROP CONSTRAINT "book_deliveries_book_id_fkey";

-- DropTable
DROP TABLE "book_deliveries";

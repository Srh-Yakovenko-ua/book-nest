-- AlterTable
ALTER TABLE "book_loan_info" ADD COLUMN     "contact" TEXT,
ADD COLUMN     "remind_to_return" BOOLEAN NOT NULL DEFAULT false;

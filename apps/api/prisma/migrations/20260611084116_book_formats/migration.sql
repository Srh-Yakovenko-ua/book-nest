-- AlterTable
ALTER TABLE "books" ADD COLUMN     "formats" TEXT[] DEFAULT ARRAY[]::TEXT[];

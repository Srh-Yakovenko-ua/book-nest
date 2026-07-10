-- AlterTable
ALTER TABLE "series" ADD COLUMN     "genres" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "books" ADD COLUMN     "age_category" TEXT NOT NULL DEFAULT 'not_specified',
ADD COLUMN     "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'ukrainian';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "favorite_book_quote" TEXT,
ADD COLUMN     "favorite_genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "last_name" TEXT;

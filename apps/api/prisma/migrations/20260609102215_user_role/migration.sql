-- CreateEnum
CREATE TYPE "role" AS ENUM ('user', 'super_admin');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "role" NOT NULL DEFAULT 'user';

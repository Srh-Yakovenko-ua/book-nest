-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "color" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "last_used_at" TIMESTAMPTZ,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'custom';

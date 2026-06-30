ALTER TABLE "media_assets" RENAME COLUMN "original_key" TO "storage_key";
ALTER TABLE "media_assets" DROP COLUMN "derivatives";

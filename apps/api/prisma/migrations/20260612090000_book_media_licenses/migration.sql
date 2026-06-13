-- AlterTable
ALTER TABLE "authors" ADD COLUMN     "photo_attribution" TEXT,
ADD COLUMN     "photo_license" TEXT,
ADD COLUMN     "photo_license_url" TEXT;

-- AlterTable
ALTER TABLE "publishers" ADD COLUMN     "logo_attribution" TEXT,
ADD COLUMN     "logo_license" TEXT,
ADD COLUMN     "logo_license_url" TEXT;

-- CreateEnum
CREATE TYPE "changelog_category" AS ENUM ('feature', 'improvement', 'fix');

-- CreateTable
CREATE TABLE "changelog_entries" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "version" TEXT,
    "category" "changelog_category" NOT NULL,
    "title_uk" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "body_uk" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "changelog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "changelog_reads" (
    "user_id" UUID NOT NULL,
    "last_seen_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "changelog_reads_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "changelog_entries_slug_key" ON "changelog_entries"("slug");

-- AddForeignKey
ALTER TABLE "changelog_reads" ADD CONSTRAINT "changelog_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

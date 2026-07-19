-- CreateTable
CREATE TABLE "character_groups" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "series_id" UUID,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "custom_type" TEXT,
    "description" TEXT,
    "is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "character_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_group_memberships" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "book_id" UUID,
    "role" TEXT,
    "status" TEXT,
    "is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "character_group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "character_groups_user_id_idx" ON "character_groups"("user_id");

-- CreateIndex
CREATE INDEX "character_groups_user_id_series_id_idx" ON "character_groups"("user_id", "series_id");

-- CreateIndex
CREATE INDEX "character_groups_user_id_normalized_name_idx" ON "character_groups"("user_id", "normalized_name");

-- CreateIndex
CREATE INDEX "character_group_memberships_group_id_idx" ON "character_group_memberships"("group_id");

-- CreateIndex
CREATE INDEX "character_group_memberships_character_id_idx" ON "character_group_memberships"("character_id");

-- CreateIndex
CREATE INDEX "character_group_memberships_book_id_idx" ON "character_group_memberships"("book_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_group_memberships_group_id_character_id_book_id_key" ON "character_group_memberships"("group_id", "character_id", "book_id");

-- AddForeignKey
ALTER TABLE "character_groups" ADD CONSTRAINT "character_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_groups" ADD CONSTRAINT "character_groups_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_group_memberships" ADD CONSTRAINT "character_group_memberships_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "character_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_group_memberships" ADD CONSTRAINT "character_group_memberships_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_group_memberships" ADD CONSTRAINT "character_group_memberships_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

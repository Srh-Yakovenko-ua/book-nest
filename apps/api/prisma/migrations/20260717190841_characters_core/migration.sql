-- CreateTable
CREATE TABLE "characters" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "entity_kind" TEXT NOT NULL DEFAULT 'individual',
    "species" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'unknown',
    "custom_gender" TEXT,
    "pronouns" TEXT,
    "neutral_description" TEXT,
    "avatar_media_id" UUID,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "global_attitude" TEXT,
    "archived_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_aliases" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'nickname',
    "book_id" UUID,
    "is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "character_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_characters" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "display_name" TEXT,
    "importance" TEXT NOT NULL DEFAULT 'supporting',
    "status" TEXT NOT NULL DEFAULT 'active',
    "status_custom_text" TEXT,
    "description" TEXT,
    "personal_impression" TEXT,
    "appearance_notes" TEXT,
    "species_override" TEXT,
    "portrait_media_id" UUID,
    "attitude" TEXT,
    "first_appearance_chapter" TEXT,
    "first_appearance_page" INTEGER,
    "first_appearance_audio_seconds" INTEGER,
    "first_appearance_note" TEXT,
    "is_pov_character" BOOLEAN NOT NULL DEFAULT false,
    "narrator_type" TEXT,
    "sort_order" INTEGER,
    "hide_presence_as_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "display_name_is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "status_is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "description_is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "personal_impression_is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "appearance_notes_is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "species_override_is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "portrait_is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_character_roles" (
    "id" UUID NOT NULL,
    "book_character_id" UUID NOT NULL,
    "role_type" TEXT NOT NULL,
    "custom_role" TEXT,
    "is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_character_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "characters_user_id_idx" ON "characters"("user_id");

-- CreateIndex
CREATE INDEX "characters_user_id_normalized_name_idx" ON "characters"("user_id", "normalized_name");

-- CreateIndex
CREATE INDEX "characters_user_id_is_favorite_idx" ON "characters"("user_id", "is_favorite");

-- CreateIndex
CREATE INDEX "characters_user_id_archived_at_idx" ON "characters"("user_id", "archived_at");

-- CreateIndex
CREATE INDEX "characters_user_id_deleted_at_idx" ON "characters"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "characters_avatar_media_id_idx" ON "characters"("avatar_media_id");

-- CreateIndex
CREATE INDEX "character_aliases_character_id_idx" ON "character_aliases"("character_id");

-- CreateIndex
CREATE INDEX "character_aliases_book_id_idx" ON "character_aliases"("book_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_aliases_character_id_book_id_normalized_name_type_key" ON "character_aliases"("character_id", "book_id", "normalized_name", "type");

-- CreateIndex
CREATE INDEX "book_characters_book_id_idx" ON "book_characters"("book_id");

-- CreateIndex
CREATE INDEX "book_characters_character_id_idx" ON "book_characters"("character_id");

-- CreateIndex
CREATE INDEX "book_characters_book_id_importance_idx" ON "book_characters"("book_id", "importance");

-- CreateIndex
CREATE INDEX "book_characters_portrait_media_id_idx" ON "book_characters"("portrait_media_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_characters_book_id_character_id_key" ON "book_characters"("book_id", "character_id");

-- CreateIndex
CREATE INDEX "book_character_roles_book_character_id_idx" ON "book_character_roles"("book_character_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_character_roles_book_character_id_role_type_custom_rol_key" ON "book_character_roles"("book_character_id", "role_type", "custom_role");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_aliases" ADD CONSTRAINT "character_aliases_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_aliases" ADD CONSTRAINT "character_aliases_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_characters" ADD CONSTRAINT "book_characters_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_characters" ADD CONSTRAINT "book_characters_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_characters" ADD CONSTRAINT "book_characters_portrait_media_id_fkey" FOREIGN KEY ("portrait_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_character_roles" ADD CONSTRAINT "book_character_roles_book_character_id_fkey" FOREIGN KEY ("book_character_id") REFERENCES "book_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

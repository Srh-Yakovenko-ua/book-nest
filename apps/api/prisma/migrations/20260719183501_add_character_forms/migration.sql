-- CreateTable
CREATE TABLE "character_forms" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "description" TEXT,
    "form_type" TEXT NOT NULL DEFAULT 'other',
    "portrait_media_id" UUID,
    "is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "character_forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "character_forms_character_id_idx" ON "character_forms"("character_id");

-- CreateIndex
CREATE INDEX "character_forms_portrait_media_id_idx" ON "character_forms"("portrait_media_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_forms_character_id_normalized_name_key" ON "character_forms"("character_id", "normalized_name");

-- AddForeignKey
ALTER TABLE "character_forms" ADD CONSTRAINT "character_forms_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_forms" ADD CONSTRAINT "character_forms_portrait_media_id_fkey" FOREIGN KEY ("portrait_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

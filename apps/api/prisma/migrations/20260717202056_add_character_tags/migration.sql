-- CreateTable
CREATE TABLE "character_tags" (
    "character_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "character_tags_pkey" PRIMARY KEY ("character_id","tag_id")
);

-- CreateIndex
CREATE INDEX "character_tags_tag_id_idx" ON "character_tags"("tag_id");

-- AddForeignKey
ALTER TABLE "character_tags" ADD CONSTRAINT "character_tags_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_tags" ADD CONSTRAINT "character_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

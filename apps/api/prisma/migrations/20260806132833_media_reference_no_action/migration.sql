-- DropForeignKey
ALTER TABLE "book_characters" DROP CONSTRAINT "book_characters_portrait_media_id_fkey";

-- DropForeignKey
ALTER TABLE "books" DROP CONSTRAINT "books_cover_media_id_fkey";

-- DropForeignKey
ALTER TABLE "character_forms" DROP CONSTRAINT "character_forms_portrait_media_id_fkey";

-- DropForeignKey
ALTER TABLE "characters" DROP CONSTRAINT "characters_avatar_media_id_fkey";

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media_assets"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media_assets"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_forms" ADD CONSTRAINT "character_forms_portrait_media_id_fkey" FOREIGN KEY ("portrait_media_id") REFERENCES "media_assets"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_characters" ADD CONSTRAINT "book_characters_portrait_media_id_fkey" FOREIGN KEY ("portrait_media_id") REFERENCES "media_assets"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

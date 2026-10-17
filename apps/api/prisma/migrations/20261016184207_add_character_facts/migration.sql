-- CreateTable
CREATE TABLE "character_facts" (
    "id" UUID NOT NULL,
    "book_character_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "chapter" TEXT,
    "page" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "character_facts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "character_facts_book_character_id_created_at_id_idx" ON "character_facts"("book_character_id", "created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "character_facts" ADD CONSTRAINT "character_facts_book_character_id_fkey" FOREIGN KEY ("book_character_id") REFERENCES "book_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

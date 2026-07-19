-- CreateTable
CREATE TABLE "character_relationships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_character_id" UUID NOT NULL,
    "target_character_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "custom_type" TEXT,
    "directionality" TEXT NOT NULL DEFAULT 'directed',
    "source_label" TEXT,
    "target_label" TEXT,
    "is_canonical" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "character_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_relationship_book_states" (
    "id" UUID NOT NULL,
    "relationship_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT,
    "intensity" TEXT,
    "is_type_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "is_description_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "hide_relationship_as_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "introduced_chapter" TEXT,
    "introduced_page" INTEGER,
    "introduced_audio_seconds" INTEGER,
    "ended_chapter" TEXT,
    "ended_page" INTEGER,
    "ended_audio_seconds" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "character_relationship_book_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "character_relationships_user_id_idx" ON "character_relationships"("user_id");

-- CreateIndex
CREATE INDEX "character_relationships_source_character_id_idx" ON "character_relationships"("source_character_id");

-- CreateIndex
CREATE INDEX "character_relationships_target_character_id_idx" ON "character_relationships"("target_character_id");

-- CreateIndex
CREATE INDEX "character_relationships_user_id_category_idx" ON "character_relationships"("user_id", "category");

-- CreateIndex
CREATE INDEX "character_relationship_book_states_book_id_idx" ON "character_relationship_book_states"("book_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_relationship_book_states_relationship_id_book_id_key" ON "character_relationship_book_states"("relationship_id", "book_id");

-- AddForeignKey
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_source_character_id_fkey" FOREIGN KEY ("source_character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_target_character_id_fkey" FOREIGN KEY ("target_character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_relationship_book_states" ADD CONSTRAINT "character_relationship_book_states_relationship_id_fkey" FOREIGN KEY ("relationship_id") REFERENCES "character_relationships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_relationship_book_states" ADD CONSTRAINT "character_relationship_book_states_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "genres" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "group_key" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "genres_key_idx" ON "genres"("key");

-- CreateIndex
CREATE INDEX "genres_user_id_idx" ON "genres"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "genres_user_id_normalized_name_key" ON "genres"("user_id", "normalized_name");

-- AddForeignKey
ALTER TABLE "genres" ADD CONSTRAINT "genres_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

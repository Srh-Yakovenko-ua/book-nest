-- CreateTable
CREATE TABLE "user_social_links" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "username" TEXT,
    "url" TEXT,
    "label" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_social_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_social_links_user_id_idx" ON "user_social_links"("user_id");

-- AddForeignKey
ALTER TABLE "user_social_links" ADD CONSTRAINT "user_social_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

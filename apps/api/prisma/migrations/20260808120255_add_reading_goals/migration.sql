-- CreateTable
CREATE TABLE "reading_goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "list_id" UUID,
    "name" TEXT,
    "target_count" INTEGER NOT NULL,
    "deadline" DATE NOT NULL,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reading_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reading_goals_user_id_archived_at_idx" ON "reading_goals"("user_id", "archived_at");

-- CreateIndex
CREATE INDEX "reading_goals_list_id_idx" ON "reading_goals"("list_id");

-- A list carries at most one goal that is still open. Archiving a goal releases
-- the slot, and goals not attached to a list are not covered by the invariant.
-- Prisma cannot express a partial unique index, so it lives here in raw SQL and
-- is asserted by src/core/database/raw-sql-indexes.test.ts.
CREATE UNIQUE INDEX "reading_goals_active_list_idx" ON "reading_goals" ("list_id") WHERE "archived_at" IS NULL AND "list_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "reading_goals" ADD CONSTRAINT "reading_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_goals" ADD CONSTRAINT "reading_goals_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "book_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "reading_goal_books" (
    "goal_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "qualified_finished_at" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reading_goal_books_pkey" PRIMARY KEY ("goal_id","book_id")
);

-- CreateTable
CREATE TABLE "reading_goal_activities" (
    "id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "book_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_goal_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reading_goal_books_book_id_idx" ON "reading_goal_books"("book_id");

-- CreateIndex
CREATE INDEX "reading_goal_books_goal_id_qualified_finished_at_idx" ON "reading_goal_books"("goal_id", "qualified_finished_at");

-- CreateIndex
CREATE INDEX "reading_goal_activities_goal_id_created_at_idx" ON "reading_goal_activities"("goal_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reading_goal_activities_user_id_created_at_idx" ON "reading_goal_activities"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reading_goal_activities_book_id_idx" ON "reading_goal_activities"("book_id");

-- CreateIndex
CREATE INDEX "reading_goals_user_id_created_at_idx" ON "reading_goals"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "reading_goals_user_id_deadline_idx" ON "reading_goals"("user_id", "deadline");

-- AddForeignKey
ALTER TABLE "reading_goal_books" ADD CONSTRAINT "reading_goal_books_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "reading_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_goal_books" ADD CONSTRAINT "reading_goal_books_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_goal_activities" ADD CONSTRAINT "reading_goal_activities_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "reading_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_goal_activities" ADD CONSTRAINT "reading_goal_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_goal_activities" ADD CONSTRAINT "reading_goal_activities_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE SET NULL ON UPDATE CASCADE;

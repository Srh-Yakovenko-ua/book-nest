-- CreateTable
CREATE TABLE "character_graph_layouts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_id" UUID,
    "mode" TEXT NOT NULL,
    "context_book_id" UUID,
    "layout_version" TEXT NOT NULL,
    "positions" JSONB NOT NULL,
    "viewport" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "character_graph_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "character_graph_layouts_user_id_idx" ON "character_graph_layouts"("user_id");

-- CreateIndex
CREATE INDEX "character_graph_layouts_user_id_scope_type_scope_id_idx" ON "character_graph_layouts"("user_id", "scope_type", "scope_id");

-- AddForeignKey
ALTER TABLE "character_graph_layouts" ADD CONSTRAINT "character_graph_layouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

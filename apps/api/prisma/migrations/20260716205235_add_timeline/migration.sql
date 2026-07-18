-- CreateTable
CREATE TABLE "book_timelines" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color_key" TEXT,
    "position" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_timelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_timeline_events" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "timeline_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "chapter" TEXT,
    "page_number" INTEGER,
    "location" TEXT,
    "story_time" TEXT,
    "event_type" TEXT NOT NULL DEFAULT 'main',
    "importance" TEXT NOT NULL DEFAULT 'medium',
    "importance_rank" INTEGER NOT NULL DEFAULT 1,
    "personal_note" TEXT,
    "thread_status" TEXT,
    "resolved_by_event_id" UUID,
    "book_order" INTEGER NOT NULL,
    "timeline_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_timeline_event_relations" (
    "id" UUID NOT NULL,
    "source_event_id" UUID NOT NULL,
    "target_event_id" UUID NOT NULL,
    "relation_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_timeline_event_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_timelines_book_id_idx" ON "book_timelines"("book_id");

-- CreateIndex
CREATE INDEX "book_timeline_events_book_id_idx" ON "book_timeline_events"("book_id");

-- CreateIndex
CREATE INDEX "book_timeline_events_timeline_id_idx" ON "book_timeline_events"("timeline_id");

-- CreateIndex
CREATE INDEX "book_timeline_events_resolved_by_event_id_idx" ON "book_timeline_events"("resolved_by_event_id");

-- CreateIndex
CREATE INDEX "book_timeline_events_book_id_importance_rank_idx" ON "book_timeline_events"("book_id", "importance_rank");

-- CreateIndex
CREATE UNIQUE INDEX "book_timeline_events_book_id_book_order_key" ON "book_timeline_events"("book_id", "book_order");

-- CreateIndex
CREATE UNIQUE INDEX "book_timeline_events_timeline_id_timeline_order_key" ON "book_timeline_events"("timeline_id", "timeline_order");

-- CreateIndex
CREATE INDEX "book_timeline_event_relations_target_event_id_idx" ON "book_timeline_event_relations"("target_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_timeline_event_relations_source_event_id_target_event__key" ON "book_timeline_event_relations"("source_event_id", "target_event_id", "relation_type");

-- AddForeignKey
ALTER TABLE "book_timelines" ADD CONSTRAINT "book_timelines_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_timeline_events" ADD CONSTRAINT "book_timeline_events_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_timeline_events" ADD CONSTRAINT "book_timeline_events_timeline_id_fkey" FOREIGN KEY ("timeline_id") REFERENCES "book_timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_timeline_events" ADD CONSTRAINT "book_timeline_events_resolved_by_event_id_fkey" FOREIGN KEY ("resolved_by_event_id") REFERENCES "book_timeline_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_timeline_event_relations" ADD CONSTRAINT "book_timeline_event_relations_source_event_id_fkey" FOREIGN KEY ("source_event_id") REFERENCES "book_timeline_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_timeline_event_relations" ADD CONSTRAINT "book_timeline_event_relations_target_event_id_fkey" FOREIGN KEY ("target_event_id") REFERENCES "book_timeline_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One default timeline per book (partial unique index — not expressible in the Prisma schema)
CREATE UNIQUE INDEX "book_timelines_default_book_idx" ON "book_timelines"("book_id") WHERE "is_default";

-- Case-insensitive unique timeline name per book (functional unique index — not expressible in the Prisma schema)
CREATE UNIQUE INDEX "book_timelines_book_id_name_lower_idx" ON "book_timelines"("book_id", lower("name"));

-- An event relation cannot point at itself (CHECK constraint — not expressible in the Prisma schema)
ALTER TABLE "book_timeline_event_relations" ADD CONSTRAINT "book_timeline_event_relations_no_self_ref" CHECK ("source_event_id" <> "target_event_id");

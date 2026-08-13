-- Backfill the snapshot for goals created before it existed. A goal now owns a frozen
-- membership, but the list membership it had at creation time was never recorded, so the
-- best available approximation is the membership the list carries right now. This is
-- explicitly best-effort and documented as such in the spec; do not try to reconstruct
-- history from book_list_items.added_at, which only says when a book was added, never when
-- one was removed.
--
-- This runs as its own migration so the previous one's foreign keys are already committed.
-- ADD CONSTRAINT ... FOREIGN KEY takes a ShareRowExclusiveLock on books and users, and
-- Prisma runs one migration file in one transaction, so a backfill sharing that file would
-- scan the library while writes to both tables are blocked.
--
-- A book keeps its snapshot row even while it sits in the trash. Membership is frozen at
-- creation; qualification is not. Trashing a book only clears qualified_finished_at, and
-- restoring it re-qualifies the same row, so the row has to exist for either transition to
-- have something to update.
--
-- qualified_finished_at follows the same rule the runtime calculator applies: a book counts
-- when it is active, finished on or after the goal's creation day, and finished on or before
-- the deadline. created_at is timestamptz and both finished_at and deadline are date, so the
-- lower bound needs a cast. "AT TIME ZONE 'UTC'" pins that cast to the UTC calendar day
-- instead of the session TimeZone, which is what src/core/iso-date.ts startOfUtcDay()
-- computes in the application. A plain created_at::date would classify a goal created near
-- midnight one day off whenever the connection runs on a non-UTC TimeZone.
--
-- The user_id match mirrors countedBookWhere in reading-goals.repository.ts, the runtime
-- query this snapshot freezes. Goals with list_id IS NULL join to nothing and contribute no
-- rows. target_count is left untouched: the snapshot records what the goal contains, never
-- what it asks for.
INSERT INTO "reading_goal_books" ("goal_id", "book_id", "position", "qualified_finished_at", "created_at", "updated_at")
SELECT
    "reading_goals"."id",
    "book_list_items"."book_id",
    "book_list_items"."position",
    CASE
        WHEN "books"."deleted_at" IS NULL
            AND "book_reading_progress"."finished_at" >= ("reading_goals"."created_at" AT TIME ZONE 'UTC')::date
            AND "book_reading_progress"."finished_at" <= "reading_goals"."deadline"
        THEN "book_reading_progress"."finished_at"
        ELSE NULL
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "reading_goals"
JOIN "book_list_items" ON "book_list_items"."list_id" = "reading_goals"."list_id"
JOIN "books" ON "books"."id" = "book_list_items"."book_id"
    AND "books"."user_id" = "reading_goals"."user_id"
LEFT JOIN "book_reading_progress" ON "book_reading_progress"."book_id" = "book_list_items"."book_id"
WHERE "reading_goals"."list_id" IS NOT NULL
ON CONFLICT ("goal_id", "book_id") DO NOTHING;

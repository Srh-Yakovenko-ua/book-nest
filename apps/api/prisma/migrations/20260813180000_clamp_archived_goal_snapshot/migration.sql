-- The backfill in 20260813101420 qualified a book on the deadline alone, but archiving a goal
-- moves the end of its counting window to min(archived_at, deadline): the runtime calculator
-- applies that clamp on every read (resolveReadingGoalCountingEnd in
-- src/modules/reading-goals/domain/reading-goal-window.ts), while the stored column keeps
-- whatever the backfill wrote. For a goal archived before its deadline, with a book whose
-- finished date falls after the archive, the two disagree inside one response: the book is
-- listed as counted while completedCount excludes it.
--
-- This clears exactly those rows. Goals that are still open are untouched, because their
-- counting window ends at the deadline the backfill already respected. archived_at is
-- timestamptz and qualified_finished_at is date, so the cast is pinned to the UTC calendar
-- day the same way the backfill pins created_at.
UPDATE "reading_goal_books"
SET "qualified_finished_at" = NULL, "updated_at" = CURRENT_TIMESTAMP
FROM "reading_goals"
WHERE "reading_goals"."id" = "reading_goal_books"."goal_id"
  AND "reading_goals"."archived_at" IS NOT NULL
  AND "reading_goal_books"."qualified_finished_at" IS NOT NULL
  AND "reading_goal_books"."qualified_finished_at" > ("reading_goals"."archived_at" AT TIME ZONE 'UTC')::date;

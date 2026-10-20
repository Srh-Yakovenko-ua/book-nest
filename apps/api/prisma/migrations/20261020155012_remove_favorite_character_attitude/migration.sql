SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- Backfill
UPDATE "characters" SET "global_attitude" = 'like', "is_favorite" = true WHERE "global_attitude" = 'favorite';

UPDATE "book_characters" SET "attitude" = 'like' WHERE "attitude" = 'favorite';

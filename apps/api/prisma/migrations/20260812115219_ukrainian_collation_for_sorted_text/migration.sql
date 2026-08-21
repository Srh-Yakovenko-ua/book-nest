-- Alphabetical ordering is done by Postgres, which compares by Unicode codepoint
-- unless a column carries a collation. Ukrainian Ґ Є І Ї live outside the А–Я block,
-- so every ORDER BY on a user-visible name put them in the wrong place.
--
-- "uk-UA-x-icu" is deterministic: it changes ordering only. Equality stays byte-exact,
-- so unique indexes, LIKE and lower() keep their current meaning.
--
-- Prisma cannot express a collation in schema.prisma, so this migration is hand-written
-- and the columns below are invisible to the schema differ. See CLAUDE.md section 6 and
-- src/core/database/collated-columns.test.ts, which asserts every column listed here.

-- Every statement below takes an AccessExclusiveLock, and all 17 run in one transaction,
-- so the first lock is held until the last one commits. The work is microseconds; the wait
-- is the risk. Without a timeout a single long-running SELECT makes the migration queue,
-- and every later query queues behind it. Three seconds, then fail and retry when quieter.
SET LOCAL lock_timeout = '3s';

ALTER TABLE "books" ALTER COLUMN "title" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "books" ALTER COLUMN "first_author_name" TYPE text COLLATE "uk-UA-x-icu";

ALTER TABLE "authors" ALTER COLUMN "name" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "publishers" ALTER COLUMN "name" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "publisher_names" ALTER COLUMN "name" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "series" ALTER COLUMN "name" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "book_lists" ALTER COLUMN "name" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "characters" ALTER COLUMN "name" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "character_groups" ALTER COLUMN "name" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "tags" ALTER COLUMN "name" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "genres" ALTER COLUMN "name" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "delivery_services" ALTER COLUMN "name" TYPE text COLLATE "uk-UA-x-icu";

ALTER TABLE "book_loans" ALTER COLUMN "person_name" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "book_deliveries" ALTER COLUMN "store_name" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "book_deliveries" ALTER COLUMN "delivery_service" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "book_purchase_info" ALTER COLUMN "store_name" TYPE text COLLATE "uk-UA-x-icu";
ALTER TABLE "book_store_links" ALTER COLUMN "store_name" TYPE text COLLATE "uk-UA-x-icu";

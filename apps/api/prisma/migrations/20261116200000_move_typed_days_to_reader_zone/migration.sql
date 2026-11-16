SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- Typed days saved before the reader time zone work sit at UTC midnight of the typed day.
-- Move each one to the start of that same day in the owner's profile zone, the way new typed days are saved.
-- Exact UTC midnight is only ever a typed day: untyped receipts and returns carry now() with milliseconds.
-- A missing settings row falls back to Europe/Kyiv like the API; a zone Postgres does not know falls back too,
-- since no reader day query can read it. The zone match ignores case, as AT TIME ZONE does.
-- Rows of owners at UTC offset zero already sit at their day start and are skipped, so a rerun changes nothing.

WITH "owner_zone" AS (
  SELECT
    "users"."id" AS "user_id",
    COALESCE("known_zone"."name", 'Europe/Kyiv') AS "time_zone"
  FROM "users"
  LEFT JOIN "user_profile_settings" ON "user_profile_settings"."user_id" = "users"."id"
  LEFT JOIN "pg_timezone_names" AS "known_zone" ON lower("known_zone"."name") = lower("user_profile_settings"."timezone")
),
"typed_receipt" AS (
  SELECT
    "shipments"."id",
    (("shipments"."received_at" AT TIME ZONE 'UTC')::date)::timestamp AT TIME ZONE "owner_zone"."time_zone" AS "reader_day_start"
  FROM "shipments"
  JOIN "book_orders" ON "book_orders"."id" = "shipments"."order_id"
  JOIN "owner_zone" ON "owner_zone"."user_id" = "book_orders"."user_id"
  WHERE ("shipments"."received_at" AT TIME ZONE 'UTC')::time = TIME '00:00'
)
UPDATE "shipments"
SET "received_at" = "typed_receipt"."reader_day_start"
FROM "typed_receipt"
WHERE "shipments"."id" = "typed_receipt"."id"
  AND "shipments"."received_at" <> "typed_receipt"."reader_day_start";

WITH "owner_zone" AS (
  SELECT
    "users"."id" AS "user_id",
    COALESCE("known_zone"."name", 'Europe/Kyiv') AS "time_zone"
  FROM "users"
  LEFT JOIN "user_profile_settings" ON "user_profile_settings"."user_id" = "users"."id"
  LEFT JOIN "pg_timezone_names" AS "known_zone" ON lower("known_zone"."name") = lower("user_profile_settings"."timezone")
),
"typed_receipt" AS (
  SELECT
    "book_order_items"."id",
    (("book_order_items"."received_at" AT TIME ZONE 'UTC')::date)::timestamp AT TIME ZONE "owner_zone"."time_zone" AS "reader_day_start"
  FROM "book_order_items"
  JOIN "book_orders" ON "book_orders"."id" = "book_order_items"."order_id"
  JOIN "owner_zone" ON "owner_zone"."user_id" = "book_orders"."user_id"
  WHERE ("book_order_items"."received_at" AT TIME ZONE 'UTC')::time = TIME '00:00'
)
UPDATE "book_order_items"
SET "received_at" = "typed_receipt"."reader_day_start"
FROM "typed_receipt"
WHERE "book_order_items"."id" = "typed_receipt"."id"
  AND "book_order_items"."received_at" <> "typed_receipt"."reader_day_start";

WITH "owner_zone" AS (
  SELECT
    "users"."id" AS "user_id",
    COALESCE("known_zone"."name", 'Europe/Kyiv') AS "time_zone"
  FROM "users"
  LEFT JOIN "user_profile_settings" ON "user_profile_settings"."user_id" = "users"."id"
  LEFT JOIN "pg_timezone_names" AS "known_zone" ON lower("known_zone"."name") = lower("user_profile_settings"."timezone")
),
"typed_return" AS (
  SELECT
    "book_loans"."id",
    (("book_loans"."returned_at" AT TIME ZONE 'UTC')::date)::timestamp AT TIME ZONE "owner_zone"."time_zone" AS "reader_day_start"
  FROM "book_loans"
  JOIN "owner_zone" ON "owner_zone"."user_id" = "book_loans"."user_id"
  WHERE ("book_loans"."returned_at" AT TIME ZONE 'UTC')::time = TIME '00:00'
)
UPDATE "book_loans"
SET "returned_at" = "typed_return"."reader_day_start"
FROM "typed_return"
WHERE "book_loans"."id" = "typed_return"."id"
  AND "book_loans"."returned_at" <> "typed_return"."reader_day_start";

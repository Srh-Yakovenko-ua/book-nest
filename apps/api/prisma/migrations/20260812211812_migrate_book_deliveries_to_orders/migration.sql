-- Copies every book_deliveries row into the three-level model created by the previous
-- migration. Data only: no DDL, and book_deliveries is left exactly as it is. Every read in
-- apps/api still goes through it, so it is dropped only after the repository, domain and
-- service layers move over (task T18 of docs/specs/delivery-order-shipment/tasks.json).
--
-- One legacy row always becomes exactly one book_order_items row, and it keeps the legacy id.
-- That is what makes this migration auditable: after it runs, every legacy row can be joined
-- to its successor by id, and docs/specs/delivery-order-shipment/legacy-profile.md carries the
-- post-flight query that proves field by field that nothing was lost, plus the DELETE that
-- undoes the copy while the new tables are still write-idle.
--
-- GROUPING (decision D7). Rows are folded into one order only when the identity of the order
-- is provable from the data itself:
--
--   1. user_id      - a user's order is never another user's order.
--   2. store_name   - the same order number in two shops is two orders. NULL is folded to ''
--                     so that "shop not recorded" is one bucket rather than one per row.
--                     Deliberately exact: "Yakaboo" and "yakaboo " stay apart, because a
--                     spelling difference is not proof of the same purchase (docs/transit.md
--                     section 14.3 asks for separate orders over a wrong merge).
--   3. identity     - the order number when there is one; otherwise the tracking number,
--                     which is the only other evidence two rows travelled as one purchase;
--                     otherwise the row's own id, which keeps it alone. Blank counts as
--                     absent - see the comment on the "normalized" CTE below.
--   4. order_date and currency - two rows that disagree on either are two orders. This is the
--                     conservative branch: an order carries a single date and a single
--                     currency, so merging rows that disagree would silently drop one value.
--                     It does split real orders where one row simply has the field empty.
--                     The pre-flight query in legacy-profile.md lists exactly those groups
--                     before the deploy so they can be merged by hand afterwards.
--   5. status class - only for the groups that need it, see the "book_classes" CTE below.
--
-- Shipments are grouped inside their order by the same standard of proof: a shared non-blank
-- tracking number plus agreement on every field a shipment carries (service, url, expected
-- date, status, note, cancel reason). A row without a tracking number gets a shipment of its
-- own, because nothing in the legacy row proves it shared a parcel with anything else. Status
-- lives on the shipment in the new model, so every legacy row needs one; there is no branch
-- that leaves an item without a shipment.
--
-- Not filtered by books.deleted_at on purpose: a trashed book keeps its delivery history, so
-- restoring it later restores where it came from.

-- Same reasoning as the lock_timeout in 20260812211553: the risk of a long migration is the
-- wait, not the work. This one only reads book_deliveries and writes three empty tables, but
-- it holds a single transaction for all of it, so both bounds are cheap insurance.
-- statement_timeout sits three orders of magnitude above what a full scan of book_deliveries
-- costs; if it ever trips, the table is not the size anyone thought it was and the deploy
-- should stop rather than hold its locks for another minute.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- GUARD. Aborts the whole migration when book_deliveries holds a status the new model has no
-- rule for. Deriving anything from an unknown status means inventing it: parking the row as a
-- cancelled item would claim a cancellation the reader never made, and the raw value would at
-- the same time land in shipments.status, which the read path Zod-parses against five values -
-- so the item and its shipment would disagree and the later parse would throw. Both are worse
-- than refusing to run.
--
-- Spelled as a failing cast rather than a DO $$ block on purpose: migration 20260807194219
-- already established that this repo does not introduce dollar-quoted statements without a
-- database to prove they survive the runner's statement splitting. When the count is zero,
-- nullif() makes the whole expression NULL and the cast is a no-op; when it is not, the cast
-- fails and the message names the count, so the failure reads as
--   invalid input syntax for type integer: "3 rows in book_deliveries carry a status ..."
-- The count comes from the aggregate rather than a literal because a constant expression would
-- be folded at plan time and would fail even on a clean table.
--
-- Pre-flight query 2 in docs/specs/delivery-order-shipment/legacy-profile.md is this same
-- count, run before the deploy; it is a hard gate there for exactly this reason.
SELECT CAST(
  nullif(count(*), 0)::text ||
  ' rows in book_deliveries carry a status outside ordered|in_transit|ready_for_pickup|received|cancelled - fix them first, see pre-flight query 2 in docs/specs/delivery-order-shipment/legacy-profile.md'
  AS integer
)
FROM "book_deliveries"
WHERE "status" NOT IN ('ordered', 'in_transit', 'ready_for_pickup', 'received', 'cancelled');

-- The map is a temp table rather than a repeated CTE so the grouping rule is written once and
-- the three inserts below cannot drift apart. It is dropped explicitly at the end, and a
-- failed migration rolls the whole file back.
CREATE TEMP TABLE "legacy_delivery_map" AS
-- Blank is not an identity. OwnershipOrderNumberSchema and TrackingNumberSchema collapse
-- whitespace but carry no .min(1), and the write path maps only undefined to NULL, so '' is a
-- storable value meaning "not recorded" exactly as NULL does. Keying on it would merge two
-- genuinely different purchases from the same shop on the same day into one order and one
-- parcel. nullif(btrim(...), '') sends both spellings of "not recorded" to the row's own id.
-- The btrimmed text is also what the key carries: unlike a shop name, whitespace around a
-- machine-issued number is not evidence of a different purchase. Pre-flight query 10 in
-- legacy-profile.md counts these rows, and is the second hard gate before the deploy.
WITH "normalized" AS (
  SELECT
    d."id",
    d."user_id",
    d."book_id",
    COALESCE(d."store_name", '') AS "store_name",
    d."order_number",
    d."order_date",
    d."currency",
    d."price",
    d."delivery_service",
    d."tracking_number",
    d."tracking_url",
    d."expected_delivery_date",
    d."status",
    d."note",
    d."cancel_reason",
    d."received_at",
    d."cancelled_at",
    d."created_at",
    d."updated_at",
    nullif(btrim(d."order_number"), '') AS "order_identity",
    nullif(btrim(d."tracking_number"), '') AS "tracking_identity",
    CASE WHEN d."status" = 'cancelled' THEN 'cancelled' ELSE 'open' END AS "status_class"
  FROM "book_deliveries" d
),
"based" AS (
  SELECT
    n.*,
    concat_ws(
      E'\x1f',
      n."user_id"::text,
      n."store_name",
      CASE
        WHEN n."order_identity" IS NOT NULL THEN 'number:' || n."order_identity"
        WHEN n."tracking_identity" IS NOT NULL THEN 'tracking:' || n."tracking_identity"
        ELSE 'row:' || n."id"::text
      END,
      COALESCE(n."order_date"::text, ''),
      COALESCE(n."currency", '')
    ) AS "base_order_key"
  FROM "normalized" n
),
-- Status class splits an order only where the same book appears in it under both classes.
-- That is the cancel-then-reorder case: the reader cancelled a book and ordered it again from
-- the same shop, the second row reuses the order number, and folding the two together would
-- invent a single order that never existed. A shop cancelling one book out of three is the
-- opposite case - different books, one real order - and splitting it produced two orders
-- sharing an order number and two parcels sharing a tracking number, which is the exact defect
-- this refactor exists to remove.
--
-- min() <> max() over a two-valued class is count(DISTINCT) spelled the way a window function
-- allows. bool_or then lifts the per-book conflict to the whole candidate order, because once
-- one book has to be split off, the rows it is split from need somewhere to land and the class
-- is the only thing in the data that says where.
"book_classes" AS (
  SELECT
    b.*,
    min(b."status_class") OVER (PARTITION BY b."base_order_key", b."book_id")
      <> max(b."status_class") OVER (PARTITION BY b."base_order_key", b."book_id")
      AS "book_seen_in_both_classes"
  FROM "based" b
),
"keyed" AS (
  SELECT
    c.*,
    concat_ws(
      E'\x1f',
      c."base_order_key",
      CASE
        WHEN bool_or(c."book_seen_in_both_classes") OVER (PARTITION BY c."base_order_key")
          THEN c."status_class"
        ELSE 'one class'
      END
    ) AS "order_key"
  FROM "book_classes" c
),
"shipment_keyed" AS (
  SELECT
    k.*,
    concat_ws(
      E'\x1f',
      k."order_key",
      CASE
        WHEN k."tracking_identity" IS NOT NULL THEN 'tracking:' || k."tracking_identity"
        ELSE 'row:' || k."id"::text
      END,
      -- status stays in the shipment key deliberately. Taking it out would require a rule for
      -- what a parcel's status is when its books disagree - three received and one cancelled -
      -- and inventing that rule is a design decision about the new model, not a repair of this
      -- migration. Keeping it means a cancelled book of a shared parcel gets a shipment row of
      -- its own, which is at least honest: one row per outcome, mergeable by hand later.
      k."status",
      COALESCE(k."delivery_service", ''),
      COALESCE(k."tracking_url", ''),
      COALESCE(k."expected_delivery_date"::text, ''),
      COALESCE(k."note", ''),
      COALESCE(k."cancel_reason", '')
      -- received_at and cancelled_at are deliberately NOT part of this key. They are per-book
      -- timestamps: four books of one parcel marked received a minute apart would otherwise
      -- become four shipments sharing one tracking number, which is the "N parcels where there
      -- was one" problem this refactor exists to remove. The shipment takes max() of each
      -- instead - a parcel is received when its last book is - and the exact per-row value
      -- survives on the item, which is where the post-flight check in legacy-profile.md
      -- reads it.
    ) AS "shipment_key"
  FROM "keyed" k
),
-- gen_random_uuid() is drawn once per distinct key. The DISTINCT subquery is what guarantees
-- that: calling the volatile function over the whole set would hand every row its own id.
"order_ids" AS (
  SELECT "order_key", gen_random_uuid() AS "order_id"
  FROM (SELECT DISTINCT "order_key" FROM "shipment_keyed") k
),
"shipment_ids" AS (
  SELECT "shipment_key", gen_random_uuid() AS "shipment_id"
  FROM (SELECT DISTINCT "shipment_key" FROM "shipment_keyed") k
)
SELECT s.*, o."order_id", h."shipment_id"
FROM "shipment_keyed" s
JOIN "order_ids" o USING ("order_key")
JOIN "shipment_ids" h USING ("shipment_key");

-- Order level. total_amount, delivery_price and discount stay NULL: the legacy row never held
-- an order total, only a per-book price, and adding the prices up would state an amount the
-- reader never entered. note is a per-book field in the legacy row, so it travels with the
-- shipment instead, where it cannot be merged away.
INSERT INTO "book_orders" (
  "id",
  "user_id",
  "store_name",
  "order_number",
  "order_date",
  "currency",
  "total_amount",
  "delivery_price",
  "discount",
  "note",
  "created_at",
  "updated_at"
)
SELECT
  m."order_id",
  m."user_id",
  m."store_name",
  max(m."order_number"),
  max(m."order_date"),
  max(m."currency"),
  NULL,
  NULL,
  NULL,
  NULL,
  min(m."created_at"),
  max(m."updated_at")
FROM "legacy_delivery_map" m
GROUP BY m."order_id", m."user_id", m."store_name";

-- Shipment level. Every aggregated column except the two timestamps is part of the shipment
-- key, so max() only ever sees one distinct value per group and nothing is chosen over
-- anything else. received_at and cancelled_at are the deliberate exception: they are per-book
-- in the legacy row and per-parcel here, so the shipment takes the last of them.
--
-- delivery_service_id is resolved against the catalog on normalized_name - collapseSpaces plus
-- toLowerCase, the same value normalizeName() writes, packages/shared/src/common.ts - and not
-- on lower(name), so the equality can be served by the (user_id, normalized_name) unique index
-- instead of forcing a sequential scan with a function call per catalog row. The reader's own
-- service still wins over the shared global one (decision D5), and created_at then id break
-- any remaining tie, so two global rows spelling the same name cannot resolve one way today
-- and the other way on a re-run. When no row matches, the FK stays NULL and
-- delivery_service_name still carries the text, so the service itself is never lost - that
-- snapshot is the other half of D5.
WITH "grouped" AS (
  SELECT
    m."shipment_id",
    m."order_id",
    m."user_id",
    max(m."delivery_service") AS "delivery_service",
    max(m."tracking_number") AS "tracking_number",
    max(m."tracking_url") AS "tracking_url",
    max(m."expected_delivery_date") AS "expected_delivery_date",
    max(m."status") AS "status",
    max(m."note") AS "note",
    max(m."cancel_reason") AS "cancel_reason",
    max(m."received_at") AS "received_at",
    max(m."cancelled_at") AS "cancelled_at",
    min(m."created_at") AS "created_at",
    max(m."updated_at") AS "updated_at"
  FROM "legacy_delivery_map" m
  GROUP BY m."shipment_id", m."order_id", m."user_id"
)
INSERT INTO "shipments" (
  "id",
  "order_id",
  "delivery_service_id",
  "delivery_service_name",
  "tracking_number",
  "tracking_url",
  "expected_delivery_date",
  "pickup_until",
  "status",
  "received_at",
  "cancelled_at",
  "cancel_reason",
  "note",
  "created_at",
  "updated_at"
)
SELECT
  g."shipment_id",
  g."order_id",
  catalog."id",
  g."delivery_service",
  g."tracking_number",
  g."tracking_url",
  g."expected_delivery_date",
  NULL,
  g."status",
  g."received_at",
  g."cancelled_at",
  g."cancel_reason",
  g."note",
  g."created_at",
  g."updated_at"
FROM "grouped" g
LEFT JOIN LATERAL (
  SELECT s."id"
  FROM "delivery_services" s
  WHERE g."delivery_service" IS NOT NULL
    AND s."normalized_name" = lower(btrim(regexp_replace(g."delivery_service", '\s+', ' ', 'g')))
    AND (s."user_id" = g."user_id" OR s."user_id" IS NULL)
  ORDER BY (s."user_id" IS NULL), s."created_at", s."id"
  LIMIT 1
) catalog ON TRUE;

-- Item level. The id is the legacy id, which keeps every row traceable to where it came from
-- and keeps any stored reference to a delivery pointing at the book it always meant.
--
-- received_at and cancelled_at are derived from the legacy status rather than copied, because
-- they are what makes an item terminal for book_order_items_active_book_idx, the partial
-- unique index that keeps a book out of two active orders at once. A row whose status
-- disagrees with its timestamps would otherwise produce an item that is active while its
-- shipment is not. Where the timestamp is present it is copied exactly, which also makes the
-- item the place where the per-book value survives when several books share one shipment row.
--
-- There is no branch for an unrecognised status: the guard at the top of this file has already
-- refused to run on one, so the two CASEs below cover every value that can reach them.
INSERT INTO "book_order_items" (
  "id",
  "order_id",
  "book_id",
  "shipment_id",
  "price",
  "received_at",
  "cancelled_at",
  "cancel_reason",
  "created_at",
  "updated_at"
)
SELECT
  m."id",
  m."order_id",
  m."book_id",
  m."shipment_id",
  m."price",
  CASE WHEN m."status" = 'received' THEN COALESCE(m."received_at", m."updated_at") END,
  CASE WHEN m."status" = 'cancelled' THEN COALESCE(m."cancelled_at", m."updated_at") END,
  CASE WHEN m."status" = 'cancelled' THEN m."cancel_reason" END,
  m."created_at",
  m."updated_at"
FROM "legacy_delivery_map" m;

DROP TABLE "legacy_delivery_map";

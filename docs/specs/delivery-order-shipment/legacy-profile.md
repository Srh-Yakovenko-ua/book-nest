# Legacy profile of `book_deliveries`

Task T17a of `docs/specs/delivery-order-shipment/tasks.json`. It exists to answer one question
before the data migration runs: what shape is the data actually in.

The document has two parts, and they are not interchangeable.

- **Part A** is a reconstruction. It was derived from the script that produced most of the dev
  data, not from the database. No counter in it was executed against Postgres.
- **Part B** is a script that produces the real counters. It is the part that decides whether the
  migration is safe to deploy.

**Part A is not a substitute for Part B.** Run Part B against the dev database, paste its output
into this file, and only then apply `20260812211812_migrate_book_deliveries_to_orders`. A
reconstruction can only tell you what the seeding script wrote; it cannot tell you what a year of
hand entry, cancelled re-orders and half-filled forms left behind.

> **Part B has not been run.** The results table under "Recording the result" is empty because
> nobody working on this refactor could reach the real database: the machine has no Docker and no
> local Postgres, and the dev database is only reachable from the deployed environment. Every
> number in Part A is a reconstruction, and the two hard gates below are unmeasured. Whoever
> deploys the migration runs Part B first and fills the table in; until then, this document
> describes what to check, not what was found.

---

## Part A. Reconstruction from the seeding script

Source: `seed-delivery.mjs`, the script that filled the dev account through the public API. It
created 46 books and 49 `book_deliveries` rows. Every number below is counted from that script's
input arrays, not from the database.

### A.1 Row counts

| Counter                                 | Reconstructed value | How it arises                                       |
| --------------------------------------- | ------------------- | --------------------------------------------------- |
| rows in `book_deliveries`               | 49                  | 46 books, three of which carry a second row         |
| distinct books                          | 46                  |                                                     |
| books with more than one row            | 3                   | Джерело, It, Шантарам: cancelled, then re-ordered   |
| rows with `order_number IS NULL`        | 6                   | six in-transit rows entered without an order number |
| rows with `tracking_number IS NULL`     | 11                  |                                                     |
| rows with `tracking_url IS NULL`        | 42                  | only 7 rows ever carried a URL                      |
| rows with `price IS NULL`               | 4                   |                                                     |
| rows with `currency IS NULL`            | 5                   | one row has a price but no currency                 |
| rows with `expected_delivery_date` null | 2                   |                                                     |
| rows with `delivery_service IS NULL`    | 1                   |                                                     |
| rows with `store_name IS NULL`          | 0                   | every seeded row names a shop                       |
| rows with `note IS NOT NULL`            | 6                   |                                                     |
| rows whose book is in the trash         | 0                   |                                                     |

### A.2 Status distribution

| Status             | Reconstructed rows |
| ------------------ | ------------------ |
| `ordered`          | 8                  |
| `in_transit`       | 7                  |
| `ready_for_pickup` | 3                  |
| `received`         | 24                 |
| `cancelled`        | 7                  |

All 24 received rows carry a `received_at`, all 7 cancelled rows carry a `cancelled_at`, and 6 of
the 7 carry a `cancel_reason`. Nothing in the script can produce a status outside these five.

### A.3 Grouping candidates

| Counter                                                                                | Reconstructed value |
| -------------------------------------------------------------------------------------- | ------------------- |
| groups `(user_id, store_name, order_number)` holding more than one row                 | 0                   |
| groups `(user_id, tracking_number)` holding more than one row, where order number null | 0                   |
| candidate groups mixing a cancelled row with an active or received one                 | 0                   |

The reason is mechanical: the 22 received and 7 cancelled rows get their order number from
`ORD-<yyyymmdd>` of the order date, and no two of them share an order date. The 17 in-transit rows
carry hand-written order numbers that are unique per shop. The six rows without an order number all
have distinct tracking numbers.

**So on the reconstructed data the migration merges nothing: 49 legacy rows become 49 orders, 49
shipments and 49 items.** The three books with two rows each end up with two separate orders. They
would even if they shared an order number, because the status class keeps a book that appears in
the group as both cancelled and active in two orders (decision D7) — that is the cancel-then-reorder
case, and it is the only case the status class splits. Different books of one order stay together
whatever their statuses, so a shop cancelling one book of three leaves one order with three items.

### A.4 The gap

Roughly three rows in the dev database predate the seeding script, and their contents are unknown.
The reconstruction says nothing about them. They are the reason Part B exists rather than being a
formality: three unprofiled rows are enough to hold a shared order number, a store name typed two
ways, a status the app no longer writes, or a received row whose timestamp was never set.

The migration is written so that none of those cases can lose data, but "written so that" is a claim
about the SQL, not about the data. Part B is what turns it into a measurement.

---

## Part B. Pre-flight script — run this against the real database

Read-only. Safe to run at any time, including while the app is serving. Run it on the database you
are about to migrate, and keep the output next to the deploy.

**Two of these queries are hard gates. Both must come back at zero before the deploy proceeds.**

| Gate     | Query                                | What a non-zero result means                                                                                                                                                                                            |
| -------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HARD** | 2, rows with `unknown_status = true` | The migration will refuse to run, by design. Correct those statuses in `book_deliveries` first: there is no rule for deriving an item's state from a status the model does not have.                                    |
| **HARD** | 10, the two blank-identity counters  | Blank order and tracking numbers are treated as absent, so each such row stays its own order. Non-zero is not automatically a blocker, but it is a decision, and it is made before the deploy, not discovered after it. |

Queries 4 to 8 are not gates. They are the record of what the migration is about to do, and they
belong in the deploy notes so the merges can be reviewed afterwards.

```sql
-- ============================================================================
-- Pre-flight profile of book_deliveries, for migration
-- 20260812211812_migrate_book_deliveries_to_orders.
-- Read-only. Every query below answers one question the migration depends on.
-- ============================================================================

-- 1. Scalar counters -------------------------------------------------------
WITH d AS (SELECT * FROM book_deliveries)
SELECT 'rows total'                          AS metric, count(*)                                                   AS value FROM d
UNION ALL SELECT 'distinct books',           count(DISTINCT book_id)                                                     FROM d
UNION ALL SELECT 'distinct users',           count(DISTINCT user_id)                                                     FROM d
UNION ALL SELECT 'order_number IS NULL',     count(*) FILTER (WHERE order_number IS NULL)                                FROM d
UNION ALL SELECT 'tracking_number IS NULL',  count(*) FILTER (WHERE tracking_number IS NULL)                             FROM d
UNION ALL SELECT 'tracking_url IS NULL',     count(*) FILTER (WHERE tracking_url IS NULL)                                FROM d
UNION ALL SELECT 'store_name IS NULL',       count(*) FILTER (WHERE store_name IS NULL)                                  FROM d
UNION ALL SELECT 'order_date IS NULL',       count(*) FILTER (WHERE order_date IS NULL)                                  FROM d
UNION ALL SELECT 'currency IS NULL',         count(*) FILTER (WHERE currency IS NULL)                                    FROM d
UNION ALL SELECT 'price IS NULL',            count(*) FILTER (WHERE price IS NULL)                                       FROM d
UNION ALL SELECT 'delivery_service IS NULL', count(*) FILTER (WHERE delivery_service IS NULL)                            FROM d
UNION ALL SELECT 'expected_date IS NULL',    count(*) FILTER (WHERE expected_delivery_date IS NULL)                      FROM d
UNION ALL SELECT 'note IS NOT NULL',         count(*) FILTER (WHERE note IS NOT NULL)                                    FROM d
UNION ALL SELECT 'cancel_reason IS NOT NULL', count(*) FILTER (WHERE cancel_reason IS NOT NULL)                          FROM d
UNION ALL SELECT 'received_at IS NOT NULL',  count(*) FILTER (WHERE received_at IS NOT NULL)                             FROM d
UNION ALL SELECT 'cancelled_at IS NOT NULL', count(*) FILTER (WHERE cancelled_at IS NOT NULL)                            FROM d
UNION ALL SELECT 'rows on a trashed book',   count(*) FILTER (WHERE b.deleted_at IS NOT NULL)
  FROM book_deliveries d2 JOIN books b ON b.id = d2.book_id
UNION ALL SELECT 'books with more than one row', count(*) FROM (
  SELECT book_id FROM book_deliveries GROUP BY book_id HAVING count(*) > 1
) x
ORDER BY metric;

-- 2. Status distribution, and statuses the app no longer writes ------------
-- HARD GATE. Any status outside the five known values aborts the migration: the new model has no
-- rule for deriving an item's received_at or cancelled_at from it, and inventing one would put a
-- cancellation on the item that the reader never made while shipments.status kept a sixth value
-- the read path Zod-parses against five. Fix the rows, then deploy.
SELECT status,
       count(*) AS rows,
       count(*) FILTER (WHERE received_at IS NOT NULL)  AS with_received_at,
       count(*) FILTER (WHERE cancelled_at IS NOT NULL) AS with_cancelled_at,
       status NOT IN ('ordered', 'in_transit', 'ready_for_pickup', 'received', 'cancelled') AS unknown_status
FROM book_deliveries
GROUP BY status
ORDER BY rows DESC;

-- 3. Rows whose status disagrees with its timestamps ------------------------
-- The item's received_at and cancelled_at are derived from the status, not copied, so these rows
-- are the ones where the item timestamp will differ from the legacy column. The raw value still
-- survives on the shipment. Expect zero; investigate anything that appears.
SELECT id, book_id, status, received_at, cancelled_at, updated_at
FROM book_deliveries
WHERE (status = 'received'  AND received_at IS NULL)
   OR (status = 'cancelled' AND cancelled_at IS NULL)
   OR (status <> 'received'  AND received_at IS NOT NULL)
   OR (status <> 'cancelled' AND cancelled_at IS NOT NULL)
ORDER BY status, id;

-- 4. Order groups that will actually merge ---------------------------------
-- The migration key, spelled out: user, store (NULL folded to ''), identity (order number, else
-- tracking number, else the row itself, with blank counting as absent), order date, currency,
-- and the status class only where one book appears in the group under both classes.
-- Anything with count > 1 here is a genuine merge; everything else stays its own order.
WITH keyed AS (
  SELECT d.*,
         COALESCE(d.store_name, '') AS store_key,
         CASE WHEN d.status = 'cancelled' THEN 'cancelled' ELSE 'open' END AS status_class,
         CASE
           WHEN nullif(btrim(d.order_number), '') IS NOT NULL
             THEN 'number:' || btrim(d.order_number)
           WHEN nullif(btrim(d.tracking_number), '') IS NOT NULL
             THEN 'tracking:' || btrim(d.tracking_number)
           ELSE 'row:' || d.id::text
         END AS identity
  FROM book_deliveries d
),
classed AS (
  SELECT k.*,
         min(k.status_class) OVER w <> max(k.status_class) OVER w AS book_seen_in_both_classes
  FROM keyed k
  WINDOW w AS (PARTITION BY k.user_id, k.store_key, k.identity, k.order_date, k.currency, k.book_id)
),
scoped AS (
  SELECT c.*,
         CASE
           WHEN bool_or(c.book_seen_in_both_classes)
                  OVER (PARTITION BY c.user_id, c.store_key, c.identity, c.order_date, c.currency)
             THEN c.status_class
           ELSE 'one class'
         END AS order_class
  FROM classed c
)
SELECT user_id, store_key, identity, order_date, currency, order_class,
       count(*) AS rows,
       array_agg(id ORDER BY id) AS delivery_ids,
       array_agg(DISTINCT status) AS statuses
FROM scoped
GROUP BY user_id, store_key, identity, order_date, currency, order_class
HAVING count(*) > 1
ORDER BY rows DESC;

-- 5. Groups the conservative rules deliberately split ----------------------
-- These would have been one order under a looser rule. They are reported rather than merged,
-- because merging them would have to drop one of the two conflicting values. Reviewing this
-- output after the deploy is how they get merged by hand, if they should be. A differing status
-- class is no longer on this list unless it is the same book twice: a shop cancelling one book
-- of a three-book order leaves one order with three items.
WITH keyed AS (
  SELECT d.*,
         COALESCE(d.store_name, '') AS store_key,
         CASE WHEN d.status = 'cancelled' THEN 'cancelled' ELSE 'open' END AS status_class
  FROM book_deliveries d
  WHERE nullif(btrim(d.order_number), '') IS NOT NULL
)
SELECT user_id, store_key, order_number,
       count(*) AS rows,
       count(DISTINCT order_date) AS distinct_order_dates,
       count(DISTINCT currency)   AS distinct_currencies,
       count(DISTINCT book_id) < count(*) AS a_book_appears_twice,
       array_agg(id ORDER BY id) AS delivery_ids
FROM keyed
GROUP BY user_id, store_key, order_number
HAVING count(*) > 1
   AND (count(DISTINCT order_date) > 1
     OR count(DISTINCT currency) > 1
     OR count(DISTINCT book_id) < count(*)
     OR count(*) FILTER (WHERE order_date IS NULL) BETWEEN 1 AND count(*) - 1
     OR count(*) FILTER (WHERE currency IS NULL)   BETWEEN 1 AND count(*) - 1)
ORDER BY rows DESC;

-- 6. Store names that differ only by case or spacing -----------------------
-- Matched exactly by the migration, so these stay separate orders and separate store names.
-- If the same shop appears twice here, rename it before the deploy and the rows will merge.
SELECT user_id,
       lower(regexp_replace(btrim(store_name), '\s+', ' ', 'g')) AS normalized_store,
       array_agg(DISTINCT store_name) AS spellings,
       count(*) AS rows
FROM book_deliveries
WHERE store_name IS NOT NULL
GROUP BY user_id, lower(regexp_replace(btrim(store_name), '\s+', ' ', 'g'))
HAVING count(DISTINCT store_name) > 1
ORDER BY rows DESC;

-- 7. The fallback branch: no order number, shared tracking number ----------
SELECT user_id, btrim(tracking_number) AS tracking_number, count(*) AS rows,
       array_agg(DISTINCT COALESCE(store_name, '')) AS stores,
       array_agg(DISTINCT status) AS statuses,
       array_agg(id ORDER BY id) AS delivery_ids
FROM book_deliveries
WHERE nullif(btrim(order_number), '') IS NULL
  AND nullif(btrim(tracking_number), '') IS NOT NULL
GROUP BY user_id, btrim(tracking_number)
HAVING count(*) > 1
ORDER BY rows DESC;

-- 8. Delivery services that will not resolve to a catalog row --------------
-- The name is kept on the shipment either way (decision D5); only the FK stays NULL. A long
-- list here means the tracking URL template will be unavailable for those shipments. Matched on
-- normalized_name, the same way the migration does, so a name that differs from the catalog only
-- by case or spacing does not appear here.
SELECT d.delivery_service, d.user_id, count(*) AS rows
FROM book_deliveries d
WHERE d.delivery_service IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM delivery_services s
    WHERE s.normalized_name = lower(btrim(regexp_replace(d.delivery_service, '\s+', ' ', 'g')))
      AND (s.user_id = d.user_id OR s.user_id IS NULL)
  )
GROUP BY d.delivery_service, d.user_id
ORDER BY rows DESC;

-- 9. The invariant the new partial unique index will enforce ---------------
-- Must return zero rows. If it does not, the legacy index book_deliveries_active_book_idx was
-- lost at some point and the migration would fail on book_order_items_active_book_idx.
SELECT book_id, count(*) AS active_rows, array_agg(id) AS delivery_ids
FROM book_deliveries
WHERE status IN ('ordered', 'in_transit', 'ready_for_pickup')
GROUP BY book_id
HAVING count(*) > 1;

-- 10. Blank and suspiciously short identities ------------------------------
-- HARD GATE for the first two counters. `OwnershipOrderNumberSchema` and `TrackingNumberSchema`
-- collapse whitespace but carry no `.min(1)`, and the write path maps only `undefined` to NULL,
-- so '' is a value the table can hold and it means exactly what NULL means: not recorded. The
-- migration treats blank as absent, so these rows stay one order each. If the count is large,
-- decide before the deploy whether that is what you want; do not discover it afterwards.
--
-- The third counter is not a gate and not a denylist. It surfaces placeholders like '-' or '0'
-- as a number to go and look at, because guessing at a set of junk values in SQL is how a
-- migration merges two real purchases while claiming to be conservative.
SELECT 'order_number blank'                AS metric,
       count(*) FILTER (WHERE order_number IS NOT NULL AND btrim(order_number) = '')       AS value
FROM book_deliveries
UNION ALL
SELECT 'tracking_number blank',
       count(*) FILTER (WHERE tracking_number IS NOT NULL AND btrim(tracking_number) = '')
FROM book_deliveries
UNION ALL
SELECT 'tracking_number shorter than 5 characters',
       count(*) FILTER (WHERE btrim(tracking_number) <> '' AND length(btrim(tracking_number)) < 5)
FROM book_deliveries
UNION ALL
SELECT 'order_number shorter than 3 characters',
       count(*) FILTER (WHERE btrim(order_number) <> '' AND length(btrim(order_number)) < 3)
FROM book_deliveries;

-- 10b. The short values themselves, so a human can judge them --------------
SELECT 'order_number' AS column, btrim(order_number) AS value, count(*) AS rows
FROM book_deliveries
WHERE btrim(order_number) <> '' AND length(btrim(order_number)) < 3
GROUP BY btrim(order_number)
UNION ALL
SELECT 'tracking_number', btrim(tracking_number), count(*)
FROM book_deliveries
WHERE btrim(tracking_number) <> '' AND length(btrim(tracking_number)) < 5
GROUP BY btrim(tracking_number)
ORDER BY rows DESC, value;
```

### Recording the result

Paste the output of query 1 into the table below before deploying, and keep queries 4-8 and 10 as
an attachment to the deploy notes. **The table is empty because Part B has never been run** — see
the note at the top of this document.

| Counter | Real value | Taken at |
| ------- | ---------- | -------- |
|         |            |          |

### Rolling back, while the new tables are still write-idle

The data migration only inserts, and every `book_order_items.id` is the `book_deliveries.id` it
came from. Between the migration and the moment the application starts writing to the new tables,
that makes the copy exactly undoable: delete the items whose ids came from `book_deliveries`, then
the orders and shipments those items were the only reason to have.

```sql
BEGIN;

-- Items that this migration created: their id is a legacy delivery id.
CREATE TEMP TABLE undo_items AS
SELECT i.id, i.order_id, i.shipment_id
FROM book_order_items i
JOIN book_deliveries d ON d.id = i.id;

DELETE FROM book_order_items i USING undo_items u WHERE i.id = u.id;

-- Shipments and orders left with nothing pointing at them. The NOT EXISTS is what keeps this
-- honest: anything the application has written since is not touched.
DELETE FROM shipments s
WHERE s.id IN (SELECT shipment_id FROM undo_items WHERE shipment_id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM book_order_items i WHERE i.shipment_id = s.id);

DELETE FROM book_orders o
WHERE o.id IN (SELECT order_id FROM undo_items)
  AND NOT EXISTS (SELECT 1 FROM book_order_items i WHERE i.order_id = o.id)
  AND NOT EXISTS (SELECT 1 FROM shipments s WHERE s.order_id = o.id);

DROP TABLE undo_items;

-- Expect three zeros.
SELECT (SELECT count(*) FROM book_orders)      AS orders,
       (SELECT count(*) FROM book_order_items) AS items,
       (SELECT count(*) FROM shipments)        AS shipments;

COMMIT;
```

Then `DELETE FROM _prisma_migrations WHERE migration_name = '20260812211812_migrate_book_deliveries_to_orders';`
so the migration can be applied again.

**This undo expires the moment the application starts writing to the new tables.** After that, an
order can hold items the migration never created, a shipment can have been split or merged by
hand, and the `NOT EXISTS` guards above will correctly refuse to delete those parents — leaving a
half-rolled-back state that is worse than either end. Past that point the way back is a restore
from backup, not this script. `book_deliveries` itself is never touched by any of it, which is
why it is dropped in a separate, later migration (T18) rather than in the same deploy.

---

## Part C. Post-flight verification — run this right after the migration

The migration keeps the legacy id on `book_order_items`, so every legacy row can be joined to its
successor and checked field by field. All three queries must return zero rows.

```sql
-- 1. Every legacy row has exactly one item, one order and one shipment.
SELECT count(*) AS legacy_rows_without_an_item
FROM book_deliveries d
LEFT JOIN book_order_items i ON i.id = d.id
WHERE i.id IS NULL;

-- 2. No field was lost. Each row of the output is a field where a non-null legacy value did not
-- survive into the new tables; an empty result is the proof the migration asks for.
WITH joined AS (
  SELECT d.*, i.price AS item_price, i.book_id AS item_book_id,
         i.received_at AS item_received_at, i.cancelled_at AS item_cancelled_at,
         o.store_name AS new_store_name, o.order_number AS new_order_number,
         o.order_date AS new_order_date, o.currency AS new_currency,
         s.delivery_service_name, s.tracking_number AS new_tracking_number,
         s.tracking_url AS new_tracking_url, s.expected_delivery_date AS new_expected,
         s.status AS new_status, s.note AS new_note, s.received_at AS new_received_at,
         s.cancelled_at AS new_cancelled_at, s.cancel_reason AS new_cancel_reason
  FROM book_deliveries d
  JOIN book_order_items i ON i.id = d.id
  JOIN book_orders o ON o.id = i.order_id
  LEFT JOIN shipments s ON s.id = i.shipment_id
)
SELECT field, count(*) AS lost_values FROM (
  SELECT 'book relation' AS field FROM joined WHERE item_book_id IS DISTINCT FROM book_id
  UNION ALL SELECT 'store'            FROM joined WHERE new_store_name IS DISTINCT FROM COALESCE(store_name, '')
  UNION ALL SELECT 'order number'     FROM joined WHERE order_number IS NOT NULL AND new_order_number IS DISTINCT FROM order_number
  UNION ALL SELECT 'order date'       FROM joined WHERE order_date IS NOT NULL AND new_order_date IS DISTINCT FROM order_date
  UNION ALL SELECT 'price'            FROM joined WHERE price IS NOT NULL AND item_price IS DISTINCT FROM price
  UNION ALL SELECT 'currency'         FROM joined WHERE currency IS NOT NULL AND new_currency IS DISTINCT FROM currency
  UNION ALL SELECT 'tracking number'  FROM joined WHERE tracking_number IS NOT NULL AND new_tracking_number IS DISTINCT FROM tracking_number
  UNION ALL SELECT 'tracking url'     FROM joined WHERE tracking_url IS NOT NULL AND new_tracking_url IS DISTINCT FROM tracking_url
  UNION ALL SELECT 'delivery service' FROM joined WHERE delivery_service IS NOT NULL AND delivery_service_name IS DISTINCT FROM delivery_service
  UNION ALL SELECT 'expected date'    FROM joined WHERE expected_delivery_date IS NOT NULL AND new_expected IS DISTINCT FROM expected_delivery_date
  UNION ALL SELECT 'status'           FROM joined WHERE new_status IS DISTINCT FROM status
  UNION ALL SELECT 'note'             FROM joined WHERE note IS NOT NULL AND new_note IS DISTINCT FROM note
  -- received_at and cancelled_at are per-book in the legacy row and per-parcel on the shipment,
  -- which takes the last of them. The exact per-row value survives on the item, so the check is
  -- "still reachable from the legacy id", not "sits in one named column".
  UNION ALL SELECT 'received at'      FROM joined WHERE received_at IS NOT NULL
    AND new_received_at IS DISTINCT FROM received_at AND item_received_at IS DISTINCT FROM received_at
  UNION ALL SELECT 'cancelled at'     FROM joined WHERE cancelled_at IS NOT NULL
    AND new_cancelled_at IS DISTINCT FROM cancelled_at AND item_cancelled_at IS DISTINCT FROM cancelled_at
  UNION ALL SELECT 'cancel reason'    FROM joined WHERE cancel_reason IS NOT NULL AND new_cancel_reason IS DISTINCT FROM cancel_reason
) losses
GROUP BY field
ORDER BY lost_values DESC;

-- 3. Ownership was not touched: the count per status must match what it was before the deploy.
SELECT ownership_status, count(*) FROM books WHERE deleted_at IS NULL GROUP BY ownership_status ORDER BY ownership_status;
```

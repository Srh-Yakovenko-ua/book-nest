-- Splits the one flat "book_deliveries" row into the three levels it was carrying at once:
-- book_orders (what was bought in a shop), book_order_items (which book) and shipments
-- (how and when it physically travels). See docs/transit.md and
-- docs/specs/delivery-order-shipment/tasks.json (T13-T16).
--
-- DDL only. Nothing is copied and nothing is dropped here: book_deliveries keeps serving
-- every read in apps/api until the repository and service layers move over. The copy is the
-- next migration, and the DROP TABLE is a later one (T18).
--
-- Four things below are hand-written because Prisma cannot express them in schema.prisma,
-- so the schema differ neither generates them nor sees them afterwards: two COLLATE clauses
-- and two partial unique indexes. src/core/database/collated-columns.test.ts
-- and src/core/database/raw-sql-indexes.test.ts assert all four, so losing one turns CI red
-- instead of silently degrading sorting or an invariant. See CLAUDE.md section 6.

-- Only "delivery_services" is an ALTER of a live table, and it takes an AccessExclusiveLock
-- for the microseconds it needs to add two nullable columns. The risk is the wait, not the
-- work: without a timeout one long-running SELECT makes this migration queue and every later
-- query queue behind it. Three seconds, then fail and retry when the database is quieter.
-- statement_timeout bounds the other half of the same risk: adding two nullable columns and
-- creating indexes on three empty tables is milliseconds of work, so a statement that runs for
-- a minute is not slow, it is stuck, and it should let go of its locks rather than wait.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- AlterTable
ALTER TABLE "delivery_services" ADD COLUMN     "provider_key" TEXT,
ADD COLUMN     "tracking_url_template" TEXT;

-- CreateTable
-- "store_name" carries COLLATE "uk-UA-x-icu": the in-transit list and the per-store statistics
-- sort by it, and without the collation Postgres orders by Unicode codepoint, which puts
-- Ukrainian G-with-upturn, IE, I and YI outside the A-YA block. Same reason as
-- book_deliveries.store_name in migration 20260812115219.
CREATE TABLE "book_orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "store_name" TEXT COLLATE "uk-UA-x-icu" NOT NULL,
    "order_number" TEXT,
    "order_date" DATE,
    "currency" TEXT,
    "total_amount" DECIMAL(10,2),
    "delivery_price" DECIMAL(10,2),
    "discount" DECIMAL(10,2),
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "shipment_id" UUID,
    "price" DECIMAL(10,2),
    "received_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- "delivery_service_name" is the snapshot half of decision D5: the shipment points at the
-- catalog row for the tracking template, and keeps the name it was created with so renaming
-- or deleting a custom service never rewrites delivery history. It carries the same Ukrainian
-- collation because the list sorts by service name.
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "delivery_service_id" UUID,
    "delivery_service_name" TEXT COLLATE "uk-UA-x-icu",
    "tracking_number" TEXT,
    "tracking_url" TEXT,
    "expected_delivery_date" DATE,
    "pickup_until" DATE,
    "status" TEXT NOT NULL DEFAULT 'ordered',
    "received_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "cancel_reason" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_orders_user_id_order_date_idx" ON "book_orders"("user_id", "order_date" DESC);

-- CreateIndex
CREATE INDEX "book_orders_user_id_store_name_idx" ON "book_orders"("user_id", "store_name");

-- CreateIndex
CREATE INDEX "book_order_items_order_id_idx" ON "book_order_items"("order_id");

-- CreateIndex
CREATE INDEX "book_order_items_book_id_idx" ON "book_order_items"("book_id");

-- CreateIndex
CREATE INDEX "book_order_items_shipment_id_idx" ON "book_order_items"("shipment_id");

-- CreateIndex
CREATE INDEX "shipments_order_id_idx" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_delivery_service_id_idx" ON "shipments"("delivery_service_id");

-- CreateIndex
CREATE INDEX "shipments_status_expected_delivery_date_idx" ON "shipments"("status", "expected_delivery_date");

-- AddForeignKey
ALTER TABLE "book_orders" ADD CONSTRAINT "book_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_order_items" ADD CONSTRAINT "book_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "book_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_order_items" ADD CONSTRAINT "book_order_items_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_order_items" ADD CONSTRAINT "book_order_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "book_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_delivery_service_id_fkey" FOREIGN KEY ("delivery_service_id") REFERENCES "delivery_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex (hand-written: partial unique, which Prisma cannot express in a model)
-- The successor of book_deliveries_active_book_idx (migration 20260702113600) and the reason
-- Book.ownership_status stays a function of the data: a book can sit in at most one order item
-- that is neither received nor cancelled, so it can never be in transit twice at once.
-- Decision D4. The item, not the shipment, carries the invariant, because a single book of a
-- shipment can be cancelled on its own (docs/transit.md section 8).
CREATE UNIQUE INDEX "book_order_items_active_book_idx" ON "book_order_items"("book_id") WHERE "cancelled_at" IS NULL AND "received_at" IS NULL;

-- CreateIndex (hand-written: partial unique, which Prisma cannot express in a model)
-- provider_key names the carrier a tracking URL template belongs to, so the curated global
-- catalog must not hold it twice. Custom rows (user_id IS NOT NULL) are excluded on purpose:
-- they are a private copy of the catalog and two users may well pick the same key. A plain
-- @@unique([userId, providerKey]) would not do this, because Postgres treats every NULL
-- user_id as distinct and would let the global rows repeat a key.
CREATE UNIQUE INDEX "delivery_services_global_provider_key_idx" ON "delivery_services"("provider_key") WHERE "user_id" IS NULL AND "provider_key" IS NOT NULL;

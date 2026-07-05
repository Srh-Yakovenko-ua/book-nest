-- CreateTable
CREATE TABLE "book_deliveries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "store_name" TEXT,
    "order_date" DATE,
    "expected_delivery_date" DATE,
    "order_number" TEXT,
    "tracking_url" TEXT,
    "tracking_number" TEXT,
    "delivery_service" TEXT,
    "price" DECIMAL(10,2),
    "currency" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ordered',
    "received_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_deliveries_book_id_idx" ON "book_deliveries"("book_id");

-- CreateIndex
CREATE INDEX "book_deliveries_user_id_idx" ON "book_deliveries"("user_id");

-- AddForeignKey
ALTER TABLE "book_deliveries" ADD CONSTRAINT "book_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_deliveries" ADD CONSTRAINT "book_deliveries_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy legacy 1:1 delivery info into the new 1:N history table before dropping it
INSERT INTO "book_deliveries" (id, user_id, book_id, store_name, order_number, order_date, expected_delivery_date, status, note, created_at, updated_at)
SELECT d.id, b.user_id, d.book_id, d.store_name, d.order_number, d.order_date, d.expected_delivery_date, COALESCE(d.delivery_status, 'ordered'), d.note, d.created_at, d.updated_at
FROM "book_delivery_info" d
JOIN "books" b ON b.id = d.book_id;

-- DropForeignKey
ALTER TABLE "book_delivery_info" DROP CONSTRAINT "book_delivery_info_book_id_fkey";

-- DropTable
DROP TABLE "book_delivery_info";

-- CreateIndex (partial unique: at most one active delivery per book; Prisma cannot express a partial index)
CREATE UNIQUE INDEX "book_deliveries_active_book_idx" ON "book_deliveries"("book_id") WHERE status IN ('ordered', 'in_transit', 'ready_for_pickup');

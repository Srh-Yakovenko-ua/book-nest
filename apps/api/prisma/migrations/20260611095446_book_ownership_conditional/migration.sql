-- CreateTable
CREATE TABLE "book_purchase_info" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "store_name" TEXT,
    "store_url" TEXT,
    "expected_price" DECIMAL(10,2),
    "currency" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_purchase_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_delivery_info" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "store_name" TEXT,
    "order_number" TEXT,
    "order_date" DATE,
    "expected_delivery_date" DATE,
    "delivery_status" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_delivery_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_loan_info" (
    "id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "person_name" TEXT NOT NULL,
    "loan_date" DATE,
    "expected_return_date" DATE,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_loan_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "book_purchase_info_book_id_key" ON "book_purchase_info"("book_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_delivery_info_book_id_key" ON "book_delivery_info"("book_id");

-- CreateIndex
CREATE UNIQUE INDEX "book_loan_info_book_id_key" ON "book_loan_info"("book_id");

-- AddForeignKey
ALTER TABLE "book_purchase_info" ADD CONSTRAINT "book_purchase_info_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_delivery_info" ADD CONSTRAINT "book_delivery_info_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_loan_info" ADD CONSTRAINT "book_loan_info_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

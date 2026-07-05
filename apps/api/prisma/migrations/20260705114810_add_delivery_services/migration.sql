-- CreateTable
CREATE TABLE "delivery_services" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "delivery_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_services_user_id_idx" ON "delivery_services"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_services_user_id_normalized_name_key" ON "delivery_services"("user_id", "normalized_name");

-- AddForeignKey
ALTER TABLE "delivery_services" ADD CONSTRAINT "delivery_services_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

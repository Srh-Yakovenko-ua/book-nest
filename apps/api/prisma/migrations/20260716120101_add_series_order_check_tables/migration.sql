-- CreateTable
CREATE TABLE "series_order_ignored_issues" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_order_ignored_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series_order_disabled_series" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "series_order_disabled_series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "series_order_ignored_issues_user_id_series_id_idx" ON "series_order_ignored_issues"("user_id", "series_id");

-- CreateIndex
CREATE UNIQUE INDEX "series_order_ignored_issues_user_id_fingerprint_key" ON "series_order_ignored_issues"("user_id", "fingerprint");

-- CreateIndex
CREATE INDEX "series_order_disabled_series_user_id_idx" ON "series_order_disabled_series"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "series_order_disabled_series_user_id_series_id_key" ON "series_order_disabled_series"("user_id", "series_id");

-- AddForeignKey
ALTER TABLE "series_order_ignored_issues" ADD CONSTRAINT "series_order_ignored_issues_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_order_ignored_issues" ADD CONSTRAINT "series_order_ignored_issues_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_order_disabled_series" ADD CONSTRAINT "series_order_disabled_series_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_order_disabled_series" ADD CONSTRAINT "series_order_disabled_series_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

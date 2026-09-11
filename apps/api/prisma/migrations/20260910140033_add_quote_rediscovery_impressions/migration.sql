-- CreateTable
CREATE TABLE "quote_rediscovery_impressions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "shown_on" DATE NOT NULL,
    "shown_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_rediscovery_impressions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quote_rediscovery_impressions_user_id_shown_on_idx" ON "quote_rediscovery_impressions"("user_id", "shown_on");

-- CreateIndex
CREATE INDEX "quote_rediscovery_impressions_user_id_quote_id_shown_at_idx" ON "quote_rediscovery_impressions"("user_id", "quote_id", "shown_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "quote_rediscovery_impressions_user_id_quote_id_shown_on_key" ON "quote_rediscovery_impressions"("user_id", "quote_id", "shown_on");

-- AddForeignKey
ALTER TABLE "quote_rediscovery_impressions" ADD CONSTRAINT "quote_rediscovery_impressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_rediscovery_impressions" ADD CONSTRAINT "quote_rediscovery_impressions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

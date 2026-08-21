-- The per-currency monthly book-spending budget, stored as a version history rather than a
-- single current value: changing the budget closes the running version and opens a new one, so
-- a completed month keeps the budget it was actually judged against. See
-- apps/api/md/booknest-order-statistics-spec/backend/13_budget_persistence_and_api.md and
-- docs/specs/booknest-order-statistics/tasks.json (T57, decision D6).
--
-- DDL only. Nothing is backfilled and no existing row is rewritten: a currency the user never
-- configured simply has no row here.
--
-- "valid_to_month" is EXCLUSIVE — it holds the first month the version no longer covers, so a
-- version runs over [valid_from_month, valid_to_month) and the open one has it NULL.
--
-- Two things below are hand-written because Prisma cannot express them in schema.prisma, so the
-- schema differ neither generates them nor sees them afterwards: one partial unique index and
-- one CHECK constraint. src/core/database/raw-sql-indexes.test.ts asserts both, so losing one
-- turns CI red instead of silently dropping a money invariant. See CLAUDE.md section 6.

-- CreateTable
CREATE TABLE "book_budgets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "currency" TEXT NOT NULL,
    "monthly_amount" DECIMAL(10,2) NOT NULL,
    "valid_from_month" DATE NOT NULL,
    "valid_to_month" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "book_budgets_user_id_currency_valid_from_month_key" ON "book_budgets"("user_id", "currency", "valid_from_month");

-- CreateIndex (hand-written: partial unique, which Prisma cannot express in a model)
-- Decision D6: at most one OPEN version per user and currency. Two open versions would make the
-- remaining-balance and forecast numbers depend on which row a query happened to read first, so
-- the invariant is a database fact here, the same way one active order item per book and one
-- open goal per list already are. Closing a version releases the slot.
CREATE UNIQUE INDEX "book_budgets_active_currency_idx" ON "book_budgets"("user_id", "currency") WHERE "valid_to_month" IS NULL;

-- AddCheckConstraint
-- Both bounds address a whole calendar month, so they are stored on its first day. Without this
-- a budget written from 2026-08-14 would silently cover a fortnight of August, and every
-- comparison against a month boundary elsewhere would read as an off-by-one that is impossible
-- to reproduce from the API. The ::timestamp cast pins the immutable date_trunc overload, which
-- a CHECK constraint requires — the timestamptz one depends on the session time zone.
ALTER TABLE "book_budgets" ADD CONSTRAINT "book_budgets_months_are_first_of_month" CHECK (
    "valid_from_month" = date_trunc('month', "valid_from_month"::timestamp)::date
    AND ("valid_to_month" IS NULL OR "valid_to_month" = date_trunc('month', "valid_to_month"::timestamp)::date)
);

-- AddForeignKey
ALTER TABLE "book_budgets" ADD CONSTRAINT "book_budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

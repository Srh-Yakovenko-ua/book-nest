-- Every BookOrder now carries a canonical final total. "Free" stops being an amount of zero
-- that nobody can tell apart from a forgotten price, and becomes an explicit state the writer
-- has to choose: is_free = true means the books arrived at no cost, is_free = false means the
-- order cost a real, positive amount. Nothing derives the flag from total_amount = 0, because
-- a zero that was typed and a zero that was defaulted read the same in the data.
--
-- ADD COLUMN with a non-volatile DEFAULT is metadata-only on Postgres 11+: no table rewrite,
-- no per-row work, an ACCESS EXCLUSIVE lock held for microseconds. Existing rows read false
-- without being touched, which is the right starting point - a legacy order is presumed paid,
-- and the dev-data backfill flips the handful that were genuinely free.

SET LOCAL lock_timeout = '3s';

-- AlterTable
ALTER TABLE "book_orders" ADD COLUMN "is_free" BOOLEAN NOT NULL DEFAULT false;

-- The hourly reminder sweep asks "which loans and deliveries fall due in this window",
-- unanchored by user, so the (user_id, status) indexes cannot serve it. Measured on a
-- 500k-loan / 300k-delivery copy: without these the candidate subqueries are parallel
-- seq scans discarding 163k and 99k rows per worker (sweep page 170ms); with them the
-- planner takes a bitmap index scan over only the due rows (sweep page 90ms), and the
-- cost stops growing with total loans ever recorded.
--
-- Partial indexes carrying the reminder predicate measure the same to within noise and
-- the same size, so these stay plain and Prisma-expressible rather than joining the
-- hand-written raw-SQL index list that every future migration must be stripped against.

-- CreateIndex
CREATE INDEX "book_deliveries_status_expected_delivery_date_idx" ON "book_deliveries"("status", "expected_delivery_date");

-- CreateIndex
CREATE INDEX "book_loans_status_remind_to_return_returned_at_expected_ret_idx" ON "book_loans"("status", "remind_to_return", "returned_at", "expected_return_date");

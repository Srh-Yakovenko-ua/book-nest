-- The loan history read-model scopes every query to (user_id, status = 'returned') and then
-- orders or ranges over returned_at. (user_id, status) is a strict left prefix of the widened
-- index, so Postgres serves the existing active-loan queries from it and a second index would
-- only cost write throughput on every loan mutation.

-- DropIndex
DROP INDEX "book_loans_user_id_status_idx";

-- CreateIndex
CREATE INDEX "book_loans_user_id_status_returned_at_idx" ON "book_loans"("user_id", "status", "returned_at");

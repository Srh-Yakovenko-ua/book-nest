-- CreateTable
CREATE TABLE "book_loans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "person_name" TEXT NOT NULL,
    "contact" TEXT,
    "loan_date" DATE,
    "expected_return_date" DATE,
    "note" TEXT,
    "remind_to_return" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "returned_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_loans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "book_loans_book_id_idx" ON "book_loans"("book_id");

-- CreateIndex
CREATE INDEX "book_loans_user_id_idx" ON "book_loans"("user_id");

-- AddForeignKey
ALTER TABLE "book_loans" ADD CONSTRAINT "book_loans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_loans" ADD CONSTRAINT "book_loans_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy legacy 1:1 loan info into the new 1:N history table before dropping it.
-- The loan type is taken from the owning book's ownership status; every legacy row is a currently active loan.
INSERT INTO "book_loans" (id, user_id, book_id, type, person_name, contact, loan_date, expected_return_date, note, remind_to_return, status, created_at, updated_at)
SELECT l.id, b.user_id, l.book_id, b.ownership_status, l.person_name, l.contact, l.loan_date, l.expected_return_date, l.note, l.remind_to_return, 'active', l.created_at, l.updated_at
FROM "book_loan_info" l
JOIN "books" b ON b.id = l.book_id
WHERE b.ownership_status IN ('borrowed_from_someone', 'lent_to_someone');

-- DropTable
ALTER TABLE "book_loan_info" DROP CONSTRAINT IF EXISTS "book_loan_info_book_id_fkey";
DROP TABLE "book_loan_info";

-- CreateIndex (partial unique: at most one active loan per book; Prisma cannot express a partial index)
CREATE UNIQUE INDEX "book_loans_active_book_idx" ON "book_loans"("book_id") WHERE status = 'active';

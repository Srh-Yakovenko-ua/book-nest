-- Slice A of docs/specs/loan-contacts/SPEC.md — the person in a loan becomes an entity.
--
-- book_loans.person_name and book_loans.contact stay exactly as they are: they are the
-- snapshot taken when the loan was created, and renaming a contact must not rewrite them.
-- The new loan_contact_id is nullable in this migration on purpose (D10). Making it NOT
-- NULL here would break every write from the code that is still deployed while this
-- migration runs; the constraint follows in the slice that teaches the write path to fill
-- the column.

-- The work below is microseconds on a table of tens of rows; the wait is the risk. Adding a
-- column takes ACCESS EXCLUSIVE on the live book_loans, and without a timeout that request
-- queues behind any in-flight read while every later query queues behind the request.
-- Failing fast and rolling back is cheaper than taking the loans endpoints down.
SET LOCAL lock_timeout = '3s';

-- CreateTable
CREATE TABLE "loan_contacts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "contact" TEXT,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "loan_contacts_pkey" PRIMARY KEY ("id")
);

-- The contact list is ordered by name, and the name it orders is the one book_loans
-- .person_name used to carry, which is already COLLATE "uk-UA-x-icu" so that Ґ Є І Ї sort
-- where a Ukrainian reader expects them. Prisma cannot express a collation, so this line
-- is hand-written and asserted by src/core/database/collated-columns.test.ts.
ALTER TABLE "loan_contacts" ALTER COLUMN "name" TYPE text COLLATE "uk-UA-x-icu";

-- A plain unique, deliberately without a "WHERE archived_at IS NULL" predicate (D3). The
-- partial variant used by series and lists would let an archived and a live contact hold
-- the same name at once, and restoring the archived one would then violate the invariant
-- with no way out. An archived contact keeps its name reserved.
-- CreateIndex
CREATE UNIQUE INDEX "loan_contacts_user_id_normalized_name_key" ON "loan_contacts"("user_id", "normalized_name");

-- AddForeignKey
ALTER TABLE "loan_contacts" ADD CONSTRAINT "loan_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "book_loans" ADD COLUMN "loan_contact_id" UUID;

-- ON DELETE RESTRICT, not SET NULL: a contact is archived, never hard deleted, so a
-- delete reaching this constraint is a bug and should fail loudly instead of quietly
-- unlinking loans that the next migration will require to be linked. Deleting a user
-- removes both sides, since loans and contacts each cascade from users, but that relies
-- on Postgres firing the loans cascade before the contacts one; CI deletes users in
-- several suites, so a regression there surfaces as a failing test rather than in prod.
-- AddForeignKey
ALTER TABLE "book_loans" ADD CONSTRAINT "book_loans_loan_contact_id_fkey" FOREIGN KEY ("loan_contact_id") REFERENCES "loan_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill.
--
-- Normalization mirrors normalizeName() in packages/shared/src/common.ts, which is
-- collapseSpaces(name).toLowerCase(), i.e. every run of whitespace becomes one space, the
-- ends are trimmed, and the result is lowercased. regexp_replace runs before btrim so
-- that a leading tab is collapsed into a space that btrim can then remove.
--
-- One contact per user per normalized name, across every loan regardless of type or
-- status: a returned loan is exactly as much evidence of a person as an active one.
--
-- personName is optional upstream and reaches the table as an empty string (D8), so those
-- rows are grouped under one per-user placeholder. The group only exists when such rows
-- exist, so no user gets an empty placeholder. A user who genuinely has a loan spelled
-- "Без імені" lands in the same group, which is what the unique index requires anyway.
--
-- The displayed name and the contact are each taken from the most recent loan of the
-- group that carries a non-empty value (D11), created_at being the loan's own timestamp.
WITH collapsed AS (
  SELECT
    loan."id" AS loan_id,
    loan."user_id" AS user_id,
    loan."created_at" AS created_at,
    btrim(regexp_replace(loan."person_name", '\s+', ' ', 'g')) AS collapsed_name,
    btrim(regexp_replace(COALESCE(loan."contact", ''), '\s+', ' ', 'g')) AS collapsed_contact
  FROM "book_loans" loan
),
keyed AS (
  SELECT
    loan_id,
    user_id,
    created_at,
    collapsed_name,
    collapsed_contact,
    CASE
      WHEN collapsed_name = '' THEN 'без імені'
      ELSE lower(collapsed_name)
    END AS normalized_name
  FROM collapsed
),
seed AS (
  SELECT
    user_id,
    normalized_name,
    COALESCE(
      (array_agg(collapsed_name ORDER BY created_at DESC, loan_id DESC)
        FILTER (WHERE collapsed_name <> ''))[1],
      'Без імені'
    ) AS name,
    (array_agg(collapsed_contact ORDER BY created_at DESC, loan_id DESC)
      FILTER (WHERE collapsed_contact <> ''))[1] AS contact
  FROM keyed
  GROUP BY user_id, normalized_name
)
INSERT INTO "loan_contacts" (
  "id",
  "user_id",
  "name",
  "normalized_name",
  "contact",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  user_id,
  name,
  normalized_name,
  contact,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM seed
ON CONFLICT ("user_id", "normalized_name") DO NOTHING;

-- Same key expression as above, so every loan finds the contact seeded for its group.
WITH keyed AS (
  SELECT
    loan."id" AS loan_id,
    loan."user_id" AS user_id,
    CASE
      WHEN btrim(regexp_replace(loan."person_name", '\s+', ' ', 'g')) = '' THEN 'без імені'
      ELSE lower(btrim(regexp_replace(loan."person_name", '\s+', ' ', 'g')))
    END AS normalized_name
  FROM "book_loans" loan
  WHERE loan."loan_contact_id" IS NULL
)
UPDATE "book_loans" loan
SET "loan_contact_id" = contacts."id"
FROM keyed, "loan_contacts" contacts
WHERE keyed.loan_id = loan."id"
  AND contacts."user_id" = keyed.user_id
  AND contacts."normalized_name" = keyed.normalized_name;

-- Built after the backfill on purpose: creating it first would force every backfilled row
-- into a non-HOT update with an index insert, and the foreign key above does not need it.
-- CreateIndex
CREATE INDEX "book_loans_loan_contact_id_idx" ON "book_loans"("loan_contact_id");

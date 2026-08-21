-- Slice C of docs/specs/loan-contacts/SPEC.md — every loan now points at a contact.
--
-- 20260814100000_add_loan_contacts added the nullable column and backfilled it (D10). The
-- code that fills it on every write ships with this migration, so the constraint can
-- finally land. The backfill below is the same statement pair as in that migration, repeated
-- verbatim: it is idempotent (ON CONFLICT DO NOTHING for the seed, WHERE loan_contact_id IS
-- NULL for the link) and it catches the loans written by the old code in the window between
-- the two deploys. Without it SET NOT NULL would fail on exactly those rows.
--
-- SET NOT NULL takes an ACCESS EXCLUSIVE lock on book_loans and scans the table once to
-- validate the constraint. book_loans holds tens of rows per user, so the scan is a few
-- milliseconds and the lock window is not worth engineering around. The work is
-- microseconds; the wait is the risk, so the same lock timeout as the predecessor guards
-- it. SET LOCAL lives for one transaction, so the predecessor's line does not carry over.

SET LOCAL lock_timeout = '3s';

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

-- AlterTable
ALTER TABLE "book_loans" ALTER COLUMN "loan_contact_id" SET NOT NULL;

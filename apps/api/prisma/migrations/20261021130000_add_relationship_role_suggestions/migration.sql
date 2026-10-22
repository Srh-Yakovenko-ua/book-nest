-- CreateTable
CREATE TABLE "user_relationship_role_suggestions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "normalized_label" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "last_used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_relationship_role_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_relationship_role_suggestions_user_id_normalized_label_key" ON "user_relationship_role_suggestions"("user_id", "normalized_label");

-- CreateIndex
CREATE INDEX "user_relationship_role_suggestions_user_id_last_used_at_id_idx" ON "user_relationship_role_suggestions"("user_id", "last_used_at" DESC, "id");

-- AddForeignKey
ALTER TABLE "user_relationship_role_suggestions" ADD CONSTRAINT "user_relationship_role_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill the personal role-suggestion dictionary from the source_label and target_label
-- of every existing relationship edge, with or without book states, whatever its type.
-- Data only: character_relationships and character_relationship_book_states are read,
-- never written. Labels deleted before this migration ran have no source and stay gone.
-- A SHARE lock on character_relationships keeps the backfill and its verification on the
-- same edges.
--
-- Normalization mirrors normalizeName() in packages/shared/src/common.ts: collapse every
-- whitespace run to one space, trim, lowercase. The whitespace class is spelled out as the
-- exact set JavaScript's \s matches, because Postgres's own \s follows the libc locale, and
-- lower() runs under the ICU root collation, which applies the same full Unicode case
-- mapping as String.prototype.toLowerCase. The helper lives in pg_temp, so it vanishes
-- with the migration's session; its name differs from the custom-type migration's helper.
--
-- Each edge contributes up to two labels, one per side. Labels are grouped per edge owner
-- by normalized label, with no directionality. A collapsed label that is empty or longer
-- than 120 characters is skipped, never truncated. The display label is the collapsed
-- spelling from the most recently updated edge in the group, ties broken by the lowest
-- edge id and then source side before target side; created_at is the group's earliest
-- edge creation and last_used_at its latest edge activity. ON CONFLICT DO NOTHING keeps a
-- re-run from duplicating a row, refreshing last_used_at or overwriting an entry written
-- by the live API.
CREATE OR REPLACE FUNCTION pg_temp.collapse_relationship_role_label(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT btrim(
    regexp_replace(
      raw,
      '[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+',
      ' ',
      'g'
    ),
    ' '
  )
$$;

LOCK TABLE "character_relationships" IN SHARE MODE;

WITH labelled_sides AS (
  SELECT
    relationship."user_id" AS user_id,
    pg_temp.collapse_relationship_role_label(relationship."source_label") AS label,
    relationship."created_at" AS created_at,
    relationship."updated_at" AS updated_at,
    relationship."id" AS source_id,
    0 AS side_rank
  FROM "character_relationships" AS relationship
  WHERE relationship."source_label" IS NOT NULL
  UNION ALL
  SELECT
    relationship."user_id" AS user_id,
    pg_temp.collapse_relationship_role_label(relationship."target_label") AS label,
    relationship."created_at" AS created_at,
    relationship."updated_at" AS updated_at,
    relationship."id" AS source_id,
    1 AS side_rank
  FROM "character_relationships" AS relationship
  WHERE relationship."target_label" IS NOT NULL
),
valid_sides AS (
  SELECT
    labelled_sides.*,
    lower(labelled_sides.label COLLATE "und-x-icu") AS normalized_label
  FROM labelled_sides
  WHERE labelled_sides.label <> ''
    AND char_length(labelled_sides.label) <= 120
),
grouped AS (
  SELECT
    valid_sides.user_id,
    valid_sides.normalized_label,
    min(valid_sides.created_at) AS first_used_at,
    max(GREATEST(valid_sides.created_at, valid_sides.updated_at)) AS last_used_at
  FROM valid_sides
  GROUP BY valid_sides.user_id, valid_sides.normalized_label
),
display_labels AS (
  SELECT DISTINCT ON (valid_sides.user_id, valid_sides.normalized_label)
    valid_sides.user_id,
    valid_sides.normalized_label,
    valid_sides.label
  FROM valid_sides
  ORDER BY
    valid_sides.user_id,
    valid_sides.normalized_label,
    valid_sides.updated_at DESC,
    valid_sides.source_id,
    valid_sides.side_rank
)
INSERT INTO "user_relationship_role_suggestions" (
  "id",
  "user_id",
  "label",
  "normalized_label",
  "created_at",
  "updated_at",
  "last_used_at"
)
SELECT
  gen_random_uuid(),
  grouped.user_id,
  display_labels.label,
  grouped.normalized_label,
  grouped.first_used_at,
  CURRENT_TIMESTAMP,
  grouped.last_used_at
FROM grouped
JOIN display_labels
  ON display_labels.user_id = grouped.user_id
 AND display_labels.normalized_label = grouped.normalized_label
ON CONFLICT ("user_id", "normalized_label") DO NOTHING;

DO $$
DECLARE
  labelled_sides BIGINT;
  skipped_sides BIGINT;
  distinct_keys BIGINT;
  missing_keys BIGINT;
  dictionary_rows BIGINT;
BEGIN
  CREATE TEMP TABLE relationship_role_label_keys ON COMMIT DROP AS
  SELECT
    relationship."user_id" AS user_id,
    pg_temp.collapse_relationship_role_label(relationship."source_label") AS label
  FROM "character_relationships" AS relationship
  WHERE relationship."source_label" IS NOT NULL
  UNION ALL
  SELECT
    relationship."user_id" AS user_id,
    pg_temp.collapse_relationship_role_label(relationship."target_label") AS label
  FROM "character_relationships" AS relationship
  WHERE relationship."target_label" IS NOT NULL;

  SELECT count(*) INTO labelled_sides FROM relationship_role_label_keys;

  SELECT count(*) INTO skipped_sides
  FROM relationship_role_label_keys AS label_key
  WHERE label_key.label = ''
     OR char_length(label_key.label) > 120;

  SELECT count(*) INTO distinct_keys
  FROM (
    SELECT DISTINCT
      label_key.user_id,
      lower(label_key.label COLLATE "und-x-icu") AS normalized_label
    FROM relationship_role_label_keys AS label_key
    WHERE label_key.label <> ''
      AND char_length(label_key.label) <= 120
  ) AS valid_key;

  SELECT count(*) INTO missing_keys
  FROM relationship_role_label_keys AS label_key
  WHERE label_key.label <> ''
    AND char_length(label_key.label) <= 120
    AND NOT EXISTS (
      SELECT 1
      FROM "user_relationship_role_suggestions" AS dictionary
      WHERE dictionary."user_id" = label_key.user_id
        AND dictionary."normalized_label" = lower(label_key.label COLLATE "und-x-icu")
    );

  IF missing_keys > 0 THEN
    RAISE EXCEPTION 'relationship role suggestion backfill left % label(s) without a dictionary entry', missing_keys;
  END IF;

  SELECT count(*) INTO dictionary_rows FROM "user_relationship_role_suggestions";

  RAISE NOTICE 'relationship role suggestions: % labelled sides, % skipped, % distinct keys, % dictionary rows',
    labelled_sides, skipped_sides, distinct_keys, dictionary_rows;
END
$$;

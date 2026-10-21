-- CreateTable
CREATE TABLE "user_relationship_custom_types" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "directionality" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "last_used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_relationship_custom_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_relationship_custom_types_user_id_normalized_name_dire_key" ON "user_relationship_custom_types"("user_id", "normalized_name", "directionality");

-- CreateIndex
CREATE INDEX "user_relationship_custom_types_user_id_last_used_at_id_idx" ON "user_relationship_custom_types"("user_id", "last_used_at" DESC, "id");

-- AddForeignKey
ALTER TABLE "user_relationship_custom_types" ADD CONSTRAINT "user_relationship_custom_types_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill the personal custom-type dictionary from every existing custom relationship
-- edge, with or without book states. Data only: character_relationships and
-- character_relationship_book_states are read, never written. A SHARE lock on
-- character_relationships keeps the backfill and its verification on the same edges.
--
-- Normalization mirrors normalizeName() in packages/shared/src/common.ts: collapse every
-- whitespace run to one space, trim, lowercase. The whitespace class is spelled out as the
-- exact set JavaScript's \s matches, because Postgres's own \s follows the libc locale, and
-- lower() runs under the ICU root collation, which applies the same full Unicode case
-- mapping as String.prototype.toLowerCase. The helpers live in pg_temp, so they vanish
-- with the migration's session.
--
-- Rows are grouped per edge owner by (normalized name, directionality). A collapsed name
-- that is empty or longer than 60 characters is skipped, never truncated. The display name
-- is the collapsed spelling of the most recently updated edge in the group, ties broken by
-- the lowest id; created_at is the group's earliest edge creation and last_used_at its
-- latest edge activity. ON CONFLICT DO NOTHING keeps a re-run from duplicating a row,
-- refreshing last_used_at or overwriting an entry written by the live API.
CREATE OR REPLACE FUNCTION pg_temp.collapse_relationship_custom_type(raw TEXT)
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

WITH custom_edges AS (
  SELECT
    relationship."user_id" AS user_id,
    relationship."directionality" AS directionality,
    pg_temp.collapse_relationship_custom_type(relationship."custom_type") AS name,
    relationship."created_at" AS created_at,
    relationship."updated_at" AS updated_at,
    relationship."id" AS source_id
  FROM "character_relationships" AS relationship
  WHERE relationship."type" = 'custom'
    AND relationship."custom_type" IS NOT NULL
    AND relationship."directionality" IN ('directed', 'symmetric')
),
valid_edges AS (
  SELECT
    custom_edges.*,
    lower(custom_edges.name COLLATE "und-x-icu") AS normalized_name
  FROM custom_edges
  WHERE custom_edges.name <> ''
    AND char_length(custom_edges.name) <= 60
),
grouped AS (
  SELECT
    valid_edges.user_id,
    valid_edges.normalized_name,
    valid_edges.directionality,
    min(valid_edges.created_at) AS first_used_at,
    max(GREATEST(valid_edges.created_at, valid_edges.updated_at)) AS last_used_at
  FROM valid_edges
  GROUP BY valid_edges.user_id, valid_edges.normalized_name, valid_edges.directionality
),
display_names AS (
  SELECT DISTINCT ON (valid_edges.user_id, valid_edges.normalized_name, valid_edges.directionality)
    valid_edges.user_id,
    valid_edges.normalized_name,
    valid_edges.directionality,
    valid_edges.name
  FROM valid_edges
  ORDER BY
    valid_edges.user_id,
    valid_edges.normalized_name,
    valid_edges.directionality,
    valid_edges.updated_at DESC,
    valid_edges.source_id
)
INSERT INTO "user_relationship_custom_types" (
  "id",
  "user_id",
  "name",
  "normalized_name",
  "directionality",
  "created_at",
  "updated_at",
  "last_used_at"
)
SELECT
  gen_random_uuid(),
  grouped.user_id,
  display_names.name,
  grouped.normalized_name,
  grouped.directionality,
  grouped.first_used_at,
  CURRENT_TIMESTAMP,
  grouped.last_used_at
FROM grouped
JOIN display_names
  ON display_names.user_id = grouped.user_id
 AND display_names.normalized_name = grouped.normalized_name
 AND display_names.directionality = grouped.directionality
ON CONFLICT ("user_id", "normalized_name", "directionality") DO NOTHING;

DO $$
DECLARE
  custom_edges BIGINT;
  skipped_edges BIGINT;
  distinct_keys BIGINT;
  missing_keys BIGINT;
  dictionary_rows BIGINT;
BEGIN
  CREATE TEMP TABLE relationship_custom_type_keys ON COMMIT DROP AS
  SELECT
    relationship."user_id" AS user_id,
    relationship."directionality" AS directionality,
    pg_temp.collapse_relationship_custom_type(relationship."custom_type") AS name
  FROM "character_relationships" AS relationship
  WHERE relationship."type" = 'custom'
    AND relationship."custom_type" IS NOT NULL;

  SELECT count(*) INTO custom_edges FROM relationship_custom_type_keys;

  SELECT count(*) INTO skipped_edges
  FROM relationship_custom_type_keys AS edge_key
  WHERE edge_key.name = ''
     OR char_length(edge_key.name) > 60
     OR edge_key.directionality NOT IN ('directed', 'symmetric');

  SELECT count(*) INTO distinct_keys
  FROM (
    SELECT DISTINCT
      edge_key.user_id,
      lower(edge_key.name COLLATE "und-x-icu") AS normalized_name,
      edge_key.directionality
    FROM relationship_custom_type_keys AS edge_key
    WHERE edge_key.name <> ''
      AND char_length(edge_key.name) <= 60
      AND edge_key.directionality IN ('directed', 'symmetric')
  ) AS valid_key;

  SELECT count(*) INTO missing_keys
  FROM relationship_custom_type_keys AS edge_key
  WHERE edge_key.name <> ''
    AND char_length(edge_key.name) <= 60
    AND edge_key.directionality IN ('directed', 'symmetric')
    AND NOT EXISTS (
      SELECT 1
      FROM "user_relationship_custom_types" AS dictionary
      WHERE dictionary."user_id" = edge_key.user_id
        AND dictionary."normalized_name" = lower(edge_key.name COLLATE "und-x-icu")
        AND dictionary."directionality" = edge_key.directionality
    );

  IF missing_keys > 0 THEN
    RAISE EXCEPTION 'relationship custom type backfill left % edge(s) without a dictionary entry', missing_keys;
  END IF;

  SELECT count(*) INTO dictionary_rows FROM "user_relationship_custom_types";

  RAISE NOTICE 'relationship custom types: % custom edges, % skipped, % distinct keys, % dictionary rows',
    custom_edges, skipped_edges, distinct_keys, dictionary_rows;
END
$$;

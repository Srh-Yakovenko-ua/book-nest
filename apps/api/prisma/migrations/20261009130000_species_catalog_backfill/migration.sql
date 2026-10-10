-- Species catalog, step 2 of 3: backfill the species FKs from the frozen legacy text.
--
-- Data only. characters.species, book_characters.species_override and
-- book_characters.species_override_is_spoiler are read, never written (D7), and
-- updated_at is left alone because Prisma's @updatedAt is client-side and these tables
-- carry no trigger.
--
-- Normalization mirrors normalizeSpeciesName() in
-- src/modules/species/domain/species-name-normalizer.ts step for step (D4): fold the
-- apostrophe variants U+2018 U+2019 U+02BC U+0060 U+00B4 to U+0027 and the dash
-- variants U+2010..U+2014 to U+002D, NFKC, fold again (NFKC turns U+00B4 into a space
-- plus a combining accent, so the first fold has to run before it, and NFKC can produce
-- U+2010 from U+2011, so the second fold has to run after it), collapse every whitespace
-- run to one space, trim, lowercase. The whitespace class is spelled out as the exact
-- set JavaScript's \s matches, because Postgres's own \s follows the libc locale. lower()
-- runs under the ICU root collation, which applies the same full Unicode case mapping
-- as String.prototype.toLowerCase (U+0130, final sigma); the database's libc default
-- does not. The helpers live in pg_temp, so they vanish with the migration's session.
--
-- Matching is exact, never fuzzy. A normalized value equal to any species_names row
-- (every locale, label or alias, D1) maps to that system species. Every other non-blank
-- value maps to a private species of the character's owner: an override belongs to the
-- owner of its character, and only when the book has that same owner. An own species
-- with the same normalized name is reused; otherwise one is created per (owner,
-- normalized name) and shared by that owner's characters and overrides. Its name is the
-- whitespace-collapsed spelling of the most recently updated source row, ties broken by
-- the lowest id. NULL and blank values keep a NULL FK.
--
-- Every statement only touches rows whose FK is still NULL and the insert is
-- ON CONFLICT DO NOTHING, so a re-run is a no-op. The closing DO block fails the
-- migration if any non-blank legacy value is still unmapped, if an override sits on a
-- book owned by someone other than the character's owner, or if an FK points at another
-- user's private species, then reports the totals. The totals describe the resulting
-- state rather than this run's delta, so a re-run reports the same numbers.
--
-- The UPDATEs take row locks only, but one row held by an idle transaction would make
-- this migration wait forever while it keeps the rows it already touched locked. Give up
-- after ten seconds on a lock and five minutes overall, sized to a full pass over the data.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';

CREATE OR REPLACE FUNCTION pg_temp.fold_species_punctuation(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT translate(
    raw,
    E'\u2018\u2019\u02BC\u0060\u00B4\u2010\u2011\u2012\u2013\u2014',
    E'\u0027\u0027\u0027\u0027\u0027\u002D\u002D\u002D\u002D\u002D'
  )
$$;

CREATE OR REPLACE FUNCTION pg_temp.collapse_species_whitespace(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT btrim(
    regexp_replace(
      raw,
      '[\t\n\v\f\r \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+',
      ' ',
      'g'
    ),
    ' '
  )
$$;

CREATE OR REPLACE FUNCTION pg_temp.normalize_species_name(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT lower(
    pg_temp.collapse_species_whitespace(
      pg_temp.fold_species_punctuation(
        normalize(pg_temp.fold_species_punctuation(raw), NFKC)
      )
    ) COLLATE "und-x-icu"
  )
$$;

UPDATE "characters" AS character
SET "species_id" = system_species."id"
FROM "species_names" AS species_name
JOIN "species" AS system_species
  ON system_species."id" = species_name."species_id"
 AND system_species."user_id" IS NULL
WHERE character."species_id" IS NULL
  AND species_name."normalized_name" = pg_temp.normalize_species_name(character."species");

UPDATE "book_characters" AS book_character
SET "species_override_id" = system_species."id"
FROM "species_names" AS species_name
JOIN "species" AS system_species
  ON system_species."id" = species_name."species_id"
 AND system_species."user_id" IS NULL
WHERE book_character."species_override_id" IS NULL
  AND species_name."normalized_name" = pg_temp.normalize_species_name(book_character."species_override");

INSERT INTO "species" ("id", "user_id", "name", "normalized_name", "created_at", "updated_at")
SELECT gen_random_uuid(), picked.owner_id, picked.name, picked.normalized_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (pending.owner_id, pending.normalized_name)
    pending.owner_id,
    pending.normalized_name,
    pending.name
  FROM (
    SELECT
      character."user_id" AS owner_id,
      pg_temp.normalize_species_name(character."species") AS normalized_name,
      pg_temp.collapse_species_whitespace(character."species") AS name,
      character."updated_at" AS updated_at,
      character."id" AS source_id
    FROM "characters" AS character
    WHERE character."species_id" IS NULL
    UNION ALL
    SELECT
      character."user_id",
      pg_temp.normalize_species_name(book_character."species_override"),
      pg_temp.collapse_species_whitespace(book_character."species_override"),
      book_character."updated_at",
      book_character."id"
    FROM "book_characters" AS book_character
    JOIN "characters" AS character ON character."id" = book_character."character_id"
    JOIN "books" AS book ON book."id" = book_character."book_id" AND book."user_id" = character."user_id"
    WHERE book_character."species_override_id" IS NULL
  ) AS pending
  WHERE pending.normalized_name <> ''
  ORDER BY pending.owner_id, pending.normalized_name, pending.updated_at DESC, pending.source_id
) AS picked
ON CONFLICT ("user_id", "normalized_name") WHERE "user_id" IS NOT NULL DO NOTHING;

UPDATE "characters" AS character
SET "species_id" = own_species."id"
FROM "species" AS own_species
WHERE character."species_id" IS NULL
  AND own_species."user_id" = character."user_id"
  AND own_species."normalized_name" = pg_temp.normalize_species_name(character."species")
  AND own_species."normalized_name" <> '';

UPDATE "book_characters" AS book_character
SET "species_override_id" = own_species."id"
FROM "characters" AS character, "books" AS book, "species" AS own_species
WHERE book_character."species_override_id" IS NULL
  AND character."id" = book_character."character_id"
  AND book."id" = book_character."book_id"
  AND book."user_id" = character."user_id"
  AND own_species."user_id" = character."user_id"
  AND own_species."normalized_name" = pg_temp.normalize_species_name(book_character."species_override")
  AND own_species."normalized_name" <> '';

DO $$
DECLARE
  unmapped_characters BIGINT;
  unmapped_overrides BIGINT;
  cross_owner_overrides BIGINT;
  foreign_species_links BIGINT;
  characters_system BIGINT;
  characters_private BIGINT;
  characters_blank BIGINT;
  overrides_system BIGINT;
  overrides_private BIGINT;
  overrides_blank BIGINT;
  private_species BIGINT;
BEGIN
  SELECT count(*) INTO unmapped_characters
  FROM "characters"
  WHERE "species_id" IS NULL
    AND pg_temp.normalize_species_name("species") <> '';

  SELECT count(*) INTO unmapped_overrides
  FROM "book_characters"
  WHERE "species_override_id" IS NULL
    AND pg_temp.normalize_species_name("species_override") <> '';

  SELECT count(*) INTO cross_owner_overrides
  FROM "book_characters" AS book_character
  JOIN "characters" AS character ON character."id" = book_character."character_id"
  JOIN "books" AS book ON book."id" = book_character."book_id"
  WHERE book."user_id" <> character."user_id"
    AND (
      book_character."species_override_id" IS NOT NULL
      OR pg_temp.normalize_species_name(book_character."species_override") <> ''
    );

  SELECT
    (SELECT count(*)
     FROM "characters" AS character
     JOIN "species" AS species ON species."id" = character."species_id"
     WHERE species."user_id" <> character."user_id")
    +
    (SELECT count(*)
     FROM "book_characters" AS book_character
     JOIN "characters" AS character ON character."id" = book_character."character_id"
     JOIN "species" AS species ON species."id" = book_character."species_override_id"
     WHERE species."user_id" <> character."user_id")
  INTO foreign_species_links;

  IF cross_owner_overrides > 0 THEN
    RAISE EXCEPTION 'species backfill refused: % book characters with a species override belong to a book owned by someone other than the character owner',
      cross_owner_overrides;
  END IF;

  IF unmapped_characters > 0 OR unmapped_overrides > 0 THEN
    RAISE EXCEPTION 'species backfill incomplete: % characters and % book characters keep non-blank legacy species text without a species FK',
      unmapped_characters, unmapped_overrides;
  END IF;

  IF foreign_species_links > 0 THEN
    RAISE EXCEPTION 'species backfill refused: % species FKs point at another user''s private species',
      foreign_species_links;
  END IF;

  SELECT
    count(*) FILTER (WHERE legacy.normalized_name <> '' AND species."user_id" IS NULL),
    count(*) FILTER (WHERE legacy.normalized_name <> '' AND species."user_id" IS NOT NULL),
    count(*) FILTER (WHERE COALESCE(legacy.normalized_name, '') = '')
  INTO characters_system, characters_private, characters_blank
  FROM (
    SELECT "species_id", pg_temp.normalize_species_name("species") AS normalized_name
    FROM "characters"
  ) AS legacy
  LEFT JOIN "species" AS species ON species."id" = legacy."species_id";

  SELECT
    count(*) FILTER (WHERE legacy.normalized_name <> '' AND species."user_id" IS NULL),
    count(*) FILTER (WHERE legacy.normalized_name <> '' AND species."user_id" IS NOT NULL),
    count(*) FILTER (WHERE COALESCE(legacy.normalized_name, '') = '')
  INTO overrides_system, overrides_private, overrides_blank
  FROM (
    SELECT "species_override_id", pg_temp.normalize_species_name("species_override") AS normalized_name
    FROM "book_characters"
  ) AS legacy
  LEFT JOIN "species" AS species ON species."id" = legacy."species_override_id";

  SELECT count(DISTINCT linked.species_id) INTO private_species
  FROM (
    SELECT "species_id" AS species_id
    FROM "characters"
    WHERE pg_temp.normalize_species_name("species") <> ''
    UNION ALL
    SELECT "species_override_id"
    FROM "book_characters"
    WHERE pg_temp.normalize_species_name("species_override") <> ''
  ) AS linked
  JOIN "species" AS species ON species."id" = linked.species_id
  WHERE species."user_id" IS NOT NULL;

  RAISE NOTICE 'species backfill: characters systemMatched=% privateMatched=% blankSkipped=%; overrides systemMatched=% privateMatched=% blankSkipped=%; privateSpeciesBackingLegacyText=%',
    characters_system, characters_private, characters_blank,
    overrides_system, overrides_private, overrides_blank,
    private_species;
END
$$;

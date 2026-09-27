ALTER TABLE "book_timeline_events" ADD COLUMN "is_spoiler" BOOLEAN NOT NULL DEFAULT false;

UPDATE "book_timelines"
SET "color_key" = CASE "color_key"
  WHEN 'slate' THEN 'parchment'
  WHEN 'stone' THEN 'parchment'
  WHEN 'amber' THEN 'honey'
  WHEN 'orange' THEN 'terracotta'
  WHEN 'red' THEN 'terracotta'
  WHEN 'rose' THEN 'rose'
  WHEN 'fuchsia' THEN 'rose'
  WHEN 'emerald' THEN 'forest'
  WHEN 'teal' THEN 'sage'
  WHEN 'sky' THEN 'sky'
  WHEN 'blue' THEN 'sky'
  WHEN 'violet' THEN 'lavender'
  ELSE "color_key"
END
WHERE "color_key" IS NOT NULL;

UPDATE "book_timelines"
SET "color_key" = 'parchment'
WHERE "color_key" IS NOT NULL
  AND "color_key" NOT IN (
    'parchment', 'terracotta', 'honey', 'sage', 'forest', 'sky', 'lavender', 'rose'
  );

DO $$
DECLARE
  palette CONSTANT text[] :=
    ARRAY['parchment', 'terracotta', 'honey', 'sage', 'forest', 'sky', 'lavender', 'rose'];
  timeline_row RECORD;
  usage int[];
  current_book uuid := NULL;
  chosen int;
  slot int;
BEGIN
  FOR timeline_row IN
    SELECT "id", "book_id"
    FROM "book_timelines"
    WHERE "color_key" IS NULL
    ORDER BY "book_id" ASC, "position" ASC, "created_at" ASC, "id" ASC
  LOOP
    IF current_book IS DISTINCT FROM timeline_row."book_id" THEN
      current_book := timeline_row."book_id";
      SELECT array_agg(taken.used ORDER BY taken.ord)
      INTO usage
      FROM (
        SELECT
          entry.ord,
          (
            SELECT count(*)
            FROM "book_timelines" sibling
            WHERE sibling."book_id" = current_book
              AND sibling."color_key" = entry.color
          ) AS used
        FROM unnest(palette) WITH ORDINALITY AS entry(color, ord)
      ) taken;
    END IF;

    chosen := NULL;
    FOR slot IN 1..array_length(palette, 1) LOOP
      IF usage[slot] = 0 THEN
        chosen := slot;
        EXIT;
      END IF;
    END LOOP;

    IF chosen IS NULL THEN
      chosen := 1;
      FOR slot IN 2..array_length(palette, 1) LOOP
        IF usage[slot] < usage[chosen] THEN
          chosen := slot;
        END IF;
      END LOOP;
    END IF;

    UPDATE "book_timelines"
    SET "color_key" = palette[chosen]
    WHERE "id" = timeline_row."id";

    usage[chosen] := usage[chosen] + 1;
  END LOOP;
END $$;

ALTER TABLE "book_timelines" ALTER COLUMN "color_key" SET NOT NULL;

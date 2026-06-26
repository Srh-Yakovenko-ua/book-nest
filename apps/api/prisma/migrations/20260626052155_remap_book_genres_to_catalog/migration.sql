UPDATE "books" b
SET "genres" = (
  SELECT COALESCE(array_agg(new_key ORDER BY min_ord), '{}')
  FROM (
    SELECT new_key, MIN(ord) AS min_ord
    FROM (
      SELECT
        CASE g.old_key
          WHEN 'fantasy' THEN 'fentezi'
          WHEN 'science_fiction' THEN 'naukova-fantastyka'
          WHEN 'dystopia' THEN 'antyutopiia'
          WHEN 'romance' THEN 'romantyka'
          WHEN 'thriller' THEN 'tryler'
          WHEN 'mystery' THEN 'detektyv'
          WHEN 'detective' THEN 'detektyv'
          WHEN 'horror' THEN 'horor'
          WHEN 'historical_fiction' THEN 'istorychnyy-roman'
          WHEN 'literary_fiction' THEN 'suchasna-proza'
          WHEN 'contemporary' THEN 'suchasna-proza'
          WHEN 'young_adult' THEN 'young-adult'
          WHEN 'childrens' THEN 'dytiacha-literatura'
          WHEN 'classics' THEN 'klasychna-literatura'
          WHEN 'poetry' THEN 'poeziia'
          WHEN 'drama' THEN 'drama'
          WHEN 'short_stories' THEN 'inshe'
          WHEN 'nonfiction' THEN 'non-fikshn'
          WHEN 'biography' THEN 'biohrafiia'
          WHEN 'memoir' THEN 'memuary'
          WHEN 'self_help' THEN 'samorozvytok'
          WHEN 'psychology' THEN 'psykholohiia'
          WHEN 'philosophy' THEN 'filosofiia'
          WHEN 'history' THEN 'istoriia'
          WHEN 'science' THEN 'populiarna-nauka'
          WHEN 'business' THEN 'biznes'
          WHEN 'true_crime' THEN 'inshe'
          WHEN 'comics' THEN 'komiksy'
          WHEN 'other' THEN 'inshe'
          ELSE 'inshe'
        END AS new_key,
        g.ord AS ord
      FROM unnest(b."genres") WITH ORDINALITY AS g(old_key, ord)
    ) mapped
    GROUP BY new_key
  ) deduped
)
WHERE cardinality(b."genres") > 0;

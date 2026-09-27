UPDATE "tags"
SET "type" = 'custom'
WHERE "type" NOT IN ('trope', 'atmosphere', 'theme', 'character', 'format', 'custom');

import { Prisma } from "../../../generated/prisma/client.js";
import {
  buildSeriesNotesDatasetConditions,
  SERIES_NOTES_SQL,
  type SeriesNotesDataset,
} from "./series-notes-sql.js";

export function buildSeriesNoteCategoryCountsQuery(dataset: SeriesNotesDataset): Prisma.Sql {
  return Prisma.sql`
    SELECT note.category AS category, note.custom_category AS "customCategory", count(*)::int AS count
    FROM ${SERIES_NOTES_SQL.from}
    WHERE ${buildSeriesNotesDatasetConditions(dataset)}
      AND (note.category IS NOT NULL OR note.custom_category IS NOT NULL)
    GROUP BY note.category, note.custom_category
  `;
}

export function buildSeriesNoteCountsQuery(dataset: SeriesNotesDataset): Prisma.Sql {
  return Prisma.sql`
    SELECT series.id AS "entityId", series.name AS label, count(*)::int AS count
    FROM ${SERIES_NOTES_SQL.from}
    WHERE ${buildSeriesNotesDatasetConditions(dataset)}
    GROUP BY series.id, series.name
  `;
}

export function buildSeriesNoteFlagGroupsQuery(dataset: SeriesNotesDataset): Prisma.Sql {
  return Prisma.sql`
    SELECT
      note.is_favorite AS "isFavorite",
      note.is_pinned AS "isPinned",
      note.is_spoiler AS "isSpoiler",
      count(*)::int AS count
    FROM ${SERIES_NOTES_SQL.from}
    WHERE ${buildSeriesNotesDatasetConditions(dataset)}
    GROUP BY note.is_favorite, note.is_pinned, note.is_spoiler
  `;
}

export function buildSeriesNoteGenreCountsQuery(dataset: SeriesNotesDataset): Prisma.Sql {
  return Prisma.sql`
    SELECT series_genre.value AS value, count(*)::int AS count
    FROM ${SERIES_NOTES_SQL.from}
    CROSS JOIN LATERAL (SELECT DISTINCT unnest(series.genres) AS value) series_genre
    WHERE ${buildSeriesNotesDatasetConditions(dataset)}
    GROUP BY series_genre.value
  `;
}

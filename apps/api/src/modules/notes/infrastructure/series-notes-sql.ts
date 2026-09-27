import type {
  NoteCategory,
  NoteFilter,
  SeriesNoteSort,
  SeriesReadingState,
  SeriesStatus,
} from "@app/shared";

import { NoteEntityTypeSchema } from "@app/shared";
import { z } from "zod";

import { ilikeContains } from "../../../core/database/like-pattern.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  buildSeriesCanonicalAuthorMatch,
  buildSeriesCanonicalAuthorSortKey,
  buildSeriesIdsInReadingStates,
} from "../../series/index.js";
import { hasValues } from "./note-archive-filters.js";
import { NOTE_QUICK_FILTER_SQL } from "./note-quick-filter.js";

export type SeriesNotesDataset = {
  authorIds: string[] | undefined;
  categories: NoteCategory[] | undefined;
  customCategories: string[] | undefined;
  genres: string[] | undefined;
  readingStates: SeriesReadingState[] | undefined;
  search: string | undefined;
  seriesIds: string[] | undefined;
  statuses: SeriesStatus[] | undefined;
  userId: string;
};

type SeriesNotesSelection = {
  dataset: SeriesNotesDataset;
  quickFilter: NoteFilter;
};

export const SERIES_NOTES_SQL = {
  from: Prisma.sql`notes note JOIN series series ON series.id = note.series_id`,
  seriesIdColumn: Prisma.sql`series.id`,
};

const TotalRowSchema = z.object({ total: z.number().int() });

export const SERIES_NOTE_SORT_ORDER_SQL: Record<SeriesNoteSort, Prisma.Sql> = {
  author: Prisma.sql`${buildSeriesCanonicalAuthorSortKey(SERIES_NOTES_SQL.seriesIdColumn)} ASC NULLS LAST, series.name ASC, note.id ASC`,
  newest: Prisma.sql`note.created_at DESC, note.id ASC`,
  oldest: Prisma.sql`note.created_at ASC, note.id ASC`,
  pinned_first: Prisma.sql`note.is_pinned DESC, note.created_at DESC, note.id ASC`,
  recently_updated: Prisma.sql`note.updated_at DESC, note.created_at DESC, note.id ASC`,
  title: Prisma.sql`series.name ASC, note.created_at DESC, note.id ASC`,
};

export function buildSeriesNotesCountQuery(selection: SeriesNotesSelection): Prisma.Sql {
  return Prisma.sql`
    SELECT count(*)::int AS total
    FROM ${SERIES_NOTES_SQL.from}
    WHERE ${buildSeriesNotesWhere(selection)}
  `;
}

export function buildSeriesNotesDatasetConditions({
  authorIds,
  categories,
  customCategories,
  genres,
  readingStates,
  search,
  seriesIds,
  statuses,
  userId,
}: SeriesNotesDataset): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`note.user_id = ${userId}::uuid`,
    Prisma.sql`note.deleted_at IS NULL`,
    Prisma.sql`note.entity_type = ${NoteEntityTypeSchema.enum.series}`,
    Prisma.sql`series.deleted_at IS NULL`,
  ];

  if (hasValues(seriesIds)) {
    conditions.push(Prisma.sql`note.series_id = ANY(${seriesIds}::uuid[])`);
  }
  if (hasValues(authorIds)) {
    conditions.push(
      buildSeriesCanonicalAuthorMatch({
        matchesAuthor: (author) => Prisma.sql`${author}.id = ANY(${authorIds}::uuid[])`,
        seriesId: SERIES_NOTES_SQL.seriesIdColumn,
      }),
    );
  }
  if (hasValues(genres)) {
    conditions.push(Prisma.sql`series.genres && ${genres}::text[]`);
  }

  const categoryDimension = buildNoteCategoryDimensionSql({ categories, customCategories });
  if (categoryDimension !== undefined) {
    conditions.push(categoryDimension);
  }

  if (hasValues(statuses)) {
    conditions.push(Prisma.sql`series.status = ANY(${statuses}::text[])`);
  }
  if (hasValues(readingStates)) {
    conditions.push(
      Prisma.sql`series.id IN ${buildSeriesIdsInReadingStates({ readingStates, userId })}`,
    );
  }

  if (search !== undefined) {
    conditions.push(buildSeriesNotesSearchCondition(search));
  }

  return Prisma.join(conditions, " AND ");
}

export function buildSeriesNotesPageQuery({
  skip,
  sort,
  take,
  ...selection
}: SeriesNotesSelection & { skip: number; sort: SeriesNoteSort; take: number }): Prisma.Sql {
  return Prisma.sql`
    SELECT note.id
    FROM ${SERIES_NOTES_SQL.from}
    WHERE ${buildSeriesNotesWhere(selection)}
    ORDER BY ${SERIES_NOTE_SORT_ORDER_SQL[sort]}
    OFFSET ${skip}
    LIMIT ${take}
  `;
}

export function buildSeriesNotesSearchCondition(search: string): Prisma.Sql {
  const authorNameMatches = buildSeriesCanonicalAuthorMatch({
    matchesAuthor: (author) => ilikeContains({ column: Prisma.sql`${author}.name`, search }),
    seriesId: SERIES_NOTES_SQL.seriesIdColumn,
  });

  return Prisma.sql`(
    ${ilikeContains({ column: Prisma.sql`note.text`, search })}
    OR ${ilikeContains({ column: Prisma.sql`series.name`, search })}
    OR ${authorNameMatches}
    OR ${ilikeContains({ column: Prisma.sql`note.custom_category`, search })}
  )`;
}

export function parseSeriesNotesTotal(rows: unknown): number {
  const [row] = z.array(TotalRowSchema).parse(rows);
  return row?.total ?? 0;
}

function buildNoteCategoryDimensionSql({
  categories,
  customCategories,
}: {
  categories: NoteCategory[] | undefined;
  customCategories: string[] | undefined;
}): Prisma.Sql | undefined {
  const alternatives: Prisma.Sql[] = [];
  if (hasValues(categories)) {
    alternatives.push(Prisma.sql`note.category = ANY(${categories}::text[])`);
  }
  if (hasValues(customCategories)) {
    alternatives.push(Prisma.sql`note.custom_category = ANY(${customCategories}::text[])`);
  }
  return alternatives.length === 0 ? undefined : Prisma.sql`(${Prisma.join(alternatives, " OR ")})`;
}

function buildSeriesNotesWhere({ dataset, quickFilter }: SeriesNotesSelection): Prisma.Sql {
  return Prisma.sql`${buildSeriesNotesDatasetConditions(dataset)} AND ${NOTE_QUICK_FILTER_SQL[quickFilter]}`;
}

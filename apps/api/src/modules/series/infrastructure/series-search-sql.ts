import type { SeriesAttentionFilter, SeriesCompleteness, SeriesSearchQuery } from "@app/shared";

import { ilikeContains } from "../../../core/database/like-pattern.js";
import { Prisma } from "../../../generated/prisma/client.js";

const FINISHED_READING_STATUS = "finished";

const IN_PROGRESS_READING_STATUSES = ["reading", "rereading"];

const NEXT_BOOK_UNAVAILABLE_OWNERSHIP = ["in_transit", "lent_to_someone", "want_to_buy"];

const SERIES_ORDER_SQL: Record<SeriesSearchQuery["sort"], Prisma.Sql> = {
  activity_desc: Prisma.sql`facts.last_activity DESC`,
  books_desc: Prisma.sql`facts.books_count DESC`,
  name_asc: Prisma.sql`facts.name ASC`,
  name_desc: Prisma.sql`facts.name DESC`,
  progress_asc: Prisma.sql`facts.progress_percent ASC`,
  progress_desc: Prisma.sql`facts.progress_percent DESC`,
};

const COMPLETENESS_SQL: Record<SeriesCompleteness, Prisma.Sql> = {
  complete: Prisma.sql`(facts.total_books IS NOT NULL AND facts.books_count >= facts.total_books)`,
  incomplete: Prisma.sql`(facts.total_books IS NOT NULL AND facts.books_count < facts.total_books)`,
  no_plan: Prisma.sql`facts.total_books IS NULL`,
};

const ATTENTION_SQL: Record<Exclude<SeriesAttentionFilter, "any">, Prisma.Sql> = {
  empty: Prisma.sql`facts.books_count = 0`,
  incomplete_data: Prisma.sql`(
    CASE WHEN facts.books_count > 0 THEN facts.authored_books = 0 ELSE NOT facts.has_series_author END
    OR cardinality(facts.genres) = 0
  )`,
  incomplete_set: Prisma.sql`(
    facts.status = 'completed' AND facts.total_books IS NOT NULL AND facts.books_count < facts.total_books
  )`,
  missing_parts: Prisma.sql`(facts.max_part IS NOT NULL AND facts.max_part > facts.distinct_parts)`,
  next_unavailable: Prisma.sql`facts.next_ownership = ANY(${NEXT_BOOK_UNAVAILABLE_OWNERSHIP}::text[])`,
  unknown_status: Prisma.sql`facts.status = 'unknown'`,
};

const READING_STATE_SQL: Record<NonNullable<SeriesSearchQuery["reading"]>, Prisma.Sql> = {
  completed: Prisma.sql`facts.fully_read`,
  empty: Prisma.sql`facts.books_count = 0`,
  in_progress: Prisma.sql`(facts.books_count > 0 AND NOT facts.fully_read AND facts.is_started)`,
  not_started: Prisma.sql`(facts.books_count > 0 AND NOT facts.fully_read AND NOT facts.is_started)`,
};

type SeriesFactsInput = {
  query: SeriesSearchQuery;
  userId: string;
};

export function buildSeriesCountQuery(input: SeriesFactsInput): Prisma.Sql {
  return Prisma.sql`
    ${seriesFactsCte(input)}
    SELECT count(*)::int AS total
    FROM facts
    WHERE ${buildSeriesFilters(input.query)}
  `;
}

export function buildSeriesPageQuery({
  query,
  skip,
  take,
  userId,
}: SeriesFactsInput & { skip: number; take: number }): Prisma.Sql {
  return Prisma.sql`
    ${seriesFactsCte({ query, userId })}
    SELECT facts.id
    FROM facts
    WHERE ${buildSeriesFilters(query)}
    ORDER BY ${SERIES_ORDER_SQL[query.sort]}, facts.name ASC, facts.id ASC
    OFFSET ${skip}
    LIMIT ${take}
  `;
}

function buildAttentionFilter(attention: SeriesAttentionFilter): Prisma.Sql {
  if (attention !== "any") {
    return ATTENTION_SQL[attention];
  }
  return joinWithOr(Object.values(ATTENTION_SQL));
}

function buildAuthorFilter(authorIds: string[]): Prisma.Sql {
  return Prisma.sql`(
    EXISTS (
      SELECT 1
      FROM books book
      JOIN book_authors book_author ON book_author.book_id = book.id
      WHERE book.series_id = facts.id
        AND book.deleted_at IS NULL
        AND book_author.author_id = ANY(${authorIds}::uuid[])
    )
    OR (
      facts.books_count = 0
      AND EXISTS (
        SELECT 1
        FROM series_authors series_author
        WHERE series_author.series_id = facts.id
          AND series_author.author_id = ANY(${authorIds}::uuid[])
      )
    )
  )`;
}

function buildSearchFilter(search: string): Prisma.Sql {
  const seriesNameMatches = ilikeContains({ column: Prisma.sql`facts.name`, search });
  const authorNameMatches = ilikeContains({ column: Prisma.sql`author.name`, search });

  return Prisma.sql`(
    ${seriesNameMatches}
    OR EXISTS (
      SELECT 1
      FROM series_authors series_author
      JOIN authors author ON author.id = series_author.author_id
      WHERE series_author.series_id = facts.id AND ${authorNameMatches}
    )
    OR EXISTS (
      SELECT 1
      FROM books book
      JOIN book_authors book_author ON book_author.book_id = book.id
      JOIN authors author ON author.id = book_author.author_id
      WHERE book.series_id = facts.id
        AND book.deleted_at IS NULL
        AND ${authorNameMatches}
    )
  )`;
}

function buildSeriesFilters(query: SeriesSearchQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];

  if (query.tab === "unfinished") {
    conditions.push(
      Prisma.sql`(
        (facts.books_count > 1 OR COALESCE(facts.total_books, 0) > 1)
        AND facts.is_started
        AND NOT facts.fully_read
      )`,
    );
  }

  if (query.status !== undefined) {
    conditions.push(Prisma.sql`facts.status = ${query.status}`);
  }

  if (query.reading !== undefined) {
    conditions.push(READING_STATE_SQL[query.reading]);
  }

  if (query.attention !== undefined) {
    conditions.push(buildAttentionFilter(query.attention));
  }

  const completeness = query.completeness ?? [];
  if (completeness.length > 0) {
    conditions.push(joinWithOr(completeness.map((value) => COMPLETENESS_SQL[value])));
  }

  const genres = query.genres ?? [];
  if (genres.length > 0) {
    conditions.push(Prisma.sql`facts.genres && ${genres}::text[]`);
  }

  const authorIds = query.authorIds ?? [];
  if (authorIds.length > 0) {
    conditions.push(buildAuthorFilter(authorIds));
  }

  if (query.progressMin !== undefined) {
    conditions.push(Prisma.sql`facts.progress_percent >= ${query.progressMin}`);
  }
  if (query.progressMax !== undefined) {
    conditions.push(Prisma.sql`facts.progress_percent <= ${query.progressMax}`);
  }

  if (query.booksMin !== undefined) {
    conditions.push(Prisma.sql`facts.books_count >= ${query.booksMin}`);
  }
  if (query.booksMax !== undefined) {
    conditions.push(Prisma.sql`facts.books_count <= ${query.booksMax}`);
  }

  const search = query.search?.trim() ?? "";
  if (search !== "") {
    conditions.push(buildSearchFilter(search));
  }

  return Prisma.join(conditions, " AND ");
}

function joinWithOr(conditions: Prisma.Sql[]): Prisma.Sql {
  return Prisma.sql`(${Prisma.join(conditions, " OR ")})`;
}

function seriesFactsCte({ userId }: SeriesFactsInput): Prisma.Sql {
  return Prisma.sql`
    WITH base AS (
      SELECT
        series.id,
        series.name,
        series.status,
        series.total_books,
        series.genres,
        series.updated_at,
        aggregate.books_count,
        aggregate.finished_count,
        aggregate.reading_count,
        aggregate.authored_books,
        aggregate.max_part,
        aggregate.distinct_parts,
        aggregate.last_book_activity,
        next_book.ownership_status AS next_ownership,
        EXISTS (
          SELECT 1 FROM series_authors series_author WHERE series_author.series_id = series.id
        ) AS has_series_author
      FROM series
      LEFT JOIN LATERAL (
        SELECT
          count(*)::int AS books_count,
          count(*) FILTER (
            WHERE book.reading_status = ${FINISHED_READING_STATUS}
          )::int AS finished_count,
          count(*) FILTER (
            WHERE book.reading_status = ANY(${IN_PROGRESS_READING_STATUSES}::text[])
          )::int AS reading_count,
          count(*) FILTER (
            WHERE EXISTS (
              SELECT 1 FROM book_authors book_author WHERE book_author.book_id = book.id
            )
          )::int AS authored_books,
          max(book.part_number)::int AS max_part,
          count(DISTINCT book.part_number)::int AS distinct_parts,
          max(book.updated_at) AS last_book_activity
        FROM books book
        WHERE book.series_id = series.id AND book.deleted_at IS NULL
      ) aggregate ON true
      LEFT JOIN LATERAL (
        SELECT book.ownership_status
        FROM books book
        WHERE book.series_id = series.id
          AND book.deleted_at IS NULL
          AND book.reading_status <> ${FINISHED_READING_STATUS}
        ORDER BY
          (book.reading_status = ANY(${IN_PROGRESS_READING_STATUSES}::text[])) DESC,
          book.part_number ASC NULLS LAST,
          book.created_at ASC
        LIMIT 1
      ) next_book ON true
      WHERE series.user_id = ${userId}::uuid AND series.deleted_at IS NULL
    ),
    facts AS (
      SELECT
        base.*,
        (
          base.books_count > 0
          AND base.finished_count = base.books_count
          AND (base.total_books IS NULL OR base.finished_count >= base.total_books)
        ) AS fully_read,
        (base.finished_count > 0 OR base.reading_count > 0) AS is_started,
        CASE
          WHEN base.books_count > 0 AND COALESCE(base.total_books, base.books_count) > 0
          THEN LEAST(
            100,
            round(base.finished_count::numeric * 100 / COALESCE(base.total_books, base.books_count))
          )
          ELSE 0
        END AS progress_percent,
        GREATEST(base.updated_at, COALESCE(base.last_book_activity, base.updated_at)) AS last_activity
      FROM base
    )
  `;
}

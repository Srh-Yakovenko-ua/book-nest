import type { Nullable, ReadingStatisticsSubsetFilter } from "@app/shared";

import { BookLanguageSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { assertNever } from "../../../core/assert-never.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { parseIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  FIRST_COMPLETION_RELIABILITY,
  READING_COMPLETION_SNAPSHOT_VERSION,
  READING_CYCLE_METADATA_PROVENANCE,
  READING_CYCLE_STATE,
  type ReadingCompletionSnapshot,
} from "../../books/index.js";

const completedReadArgs = {
  select: {
    book: {
      select: {
        coverMedia: true,
        deletedAt: true,
        title: true,
      },
    },
    bookId: true,
    completionMetadata: true,
    finishedAt: true,
    firstCompletionReliability: true,
    id: true,
    rating: true,
    startedAt: true,
  },
} satisfies Prisma.BookReadingCycleDefaultArgs;

const CompletedReadsSubsetCountRowSchema = z.object({ count: z.number().int().nonnegative() });

const CompletedReadsSubsetIdRowSchema = z.object({ id: z.string() });

const CompletionTotalsRowSchema = z.object({
  completedReads: z.number().int().nonnegative(),
  ratedReads: z.number().int().nonnegative(),
  ratingSum: z.number().nullable(),
  uniqueBooks: z.number().int().nonnegative(),
});

const PriorExposureRowSchema = z.object({
  authorIds: z.array(z.string()),
  genreKeys: z.array(z.string()),
  publisherIds: z.array(z.string()),
});

const ReturningAuthorRowSchema = z.object({
  authorId: z.string(),
  completedReadCount: z.number().int().nonnegative(),
  distinctReadingYears: z.number().int().nonnegative(),
  latestFinishedAt: z.date(),
  name: z.string(),
});

const SeriesFirstCompletionRowSchema = z.object({
  distinctBooks: z.number().int().nonnegative(),
  seriesId: z.string(),
});

const ZOD_UUID_PATTERN = z.regexes.uuid().source;

export type CompletedReadRow = Prisma.BookReadingCycleGetPayload<typeof completedReadArgs>;

export type CompletedReadsSubsetScope = PeriodScope & { filter: ReadingStatisticsSubsetFilter };

export type CompletionTotals = z.infer<typeof CompletionTotalsRowSchema>;

export type PeriodScope = { from: Nullable<string>; to: string; userId: string };

export type ReturningAuthor = {
  authorId: string;
  completedReadCount: number;
  distinctReadingYears: number;
  latestFinishedAt: string;
  name: string;
};

type CompletedReadsCursor = { finishedAt: string; id: string };

type JsonCondition = (value: Prisma.Sql) => Prisma.Sql;

type JsonShapeOf<TValue> = Record<keyof TValue, JsonCondition>;

@Injectable()
export class StatisticsCompletionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countCompletedReadsSubset(scope: CompletedReadsSubsetScope): Promise<number> {
    const rows = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM book_reading_cycles cycle
      WHERE ${buildCompletedReadsSubsetCondition(scope)}
    `;

    const [row] = z.array(CompletedReadsSubsetCountRowSchema).parse(rows);
    return row?.count ?? 0;
  }

  async countPriorExposure({
    before,
    userId,
  }: {
    before: Nullable<string>;
    userId: string;
  }): Promise<z.infer<typeof PriorExposureRowSchema>> {
    if (before === null) {
      return { authorIds: [], genreKeys: [], publisherIds: [] };
    }

    const rows = await this.prisma.$queryRaw`
      WITH eligible AS (
        SELECT cycle.completion_metadata AS snapshot
        FROM book_reading_cycles cycle
        WHERE cycle.user_id = ${userId}::uuid
          AND cycle.state = ${READING_CYCLE_STATE.finished}
          AND cycle.first_completion_reliability = ${FIRST_COMPLETION_RELIABILITY.provenFirst}
          AND cycle.finished_at < ${before}::date
      )
      SELECT
        COALESCE(
          (
            SELECT array_agg(DISTINCT author ->> 'authorId')
            FROM eligible, jsonb_array_elements(eligible.snapshot -> 'authors') AS author
          ),
          '{}'
        ) AS "authorIds",
        COALESCE(
          (
            SELECT array_agg(DISTINCT genre)
            FROM eligible, jsonb_array_elements_text(eligible.snapshot -> 'book' -> 'genres') AS genre
            WHERE genre IS NOT NULL
          ),
          '{}'
        ) AS "genreKeys",
        COALESCE(
          (
            SELECT array_agg(DISTINCT eligible.snapshot -> 'publisher' ->> 'publisherId')
            FROM eligible
            WHERE eligible.snapshot -> 'publisher' ->> 'publisherId' IS NOT NULL
          ),
          '{}'
        ) AS "publisherIds"
    `;

    const [row] = z.array(PriorExposureRowSchema).parse(rows);
    return row ?? { authorIds: [], genreKeys: [], publisherIds: [] };
  }

  async countSeriesFirstCompletionsBefore({
    before,
    userId,
  }: {
    before: Nullable<string>;
    userId: string;
  }): Promise<Map<string, number>> {
    if (before === null) {
      return new Map();
    }

    const rows = await this.prisma.$queryRaw`
      SELECT
        cycle.completion_metadata -> 'series' ->> 'seriesId' AS "seriesId",
        COUNT(DISTINCT cycle.book_id)::int AS "distinctBooks"
      FROM book_reading_cycles cycle
      WHERE cycle.user_id = ${userId}::uuid
        AND cycle.state = ${READING_CYCLE_STATE.finished}
        AND cycle.first_completion_reliability = ${FIRST_COMPLETION_RELIABILITY.provenFirst}
        AND cycle.finished_at < ${before}::date
        AND cycle.completion_metadata -> 'series' ->> 'seriesId' IS NOT NULL
      GROUP BY 1
    `;

    return new Map(
      z
        .array(SeriesFirstCompletionRowSchema)
        .parse(rows)
        .map((row) => [row.seriesId, row.distinctBooks]),
    );
  }

  async countTotals({ from, to, userId }: PeriodScope): Promise<CompletionTotals> {
    const rows = await this.prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS "completedReads",
        COUNT(DISTINCT cycle.book_id)::int AS "uniqueBooks",
        COUNT(cycle.rating)::int AS "ratedReads",
        SUM(cycle.rating)::float8 AS "ratingSum"
      FROM book_reading_cycles cycle
      WHERE cycle.user_id = ${userId}::uuid
        AND cycle.state = ${READING_CYCLE_STATE.finished}
        AND cycle.finished_at IS NOT NULL
        AND (${from}::date IS NULL OR cycle.finished_at >= ${from}::date)
        AND cycle.finished_at <= ${to}::date
    `;

    const [row] = z.array(CompletionTotalsRowSchema).parse(rows);
    return row ?? { completedReads: 0, ratedReads: 0, ratingSum: null, uniqueBooks: 0 };
  }

  findCompletedReads({ from, to, userId }: PeriodScope): Promise<CompletedReadRow[]> {
    return this.prisma.bookReadingCycle.findMany({
      orderBy: [{ finishedAt: "desc" }, { id: "asc" }],
      where: {
        finishedAt: {
          gte: from === null ? undefined : parseIsoDate(from),
          lte: parseIsoDate(to),
          not: null,
        },
        state: READING_CYCLE_STATE.finished,
        userId,
      },
      ...completedReadArgs,
    });
  }

  findCompletedReadsPage({
    after,
    from,
    limit,
    to,
    userId,
  }: {
    after: Nullable<CompletedReadsCursor>;
    from: string;
    limit: number;
    to: string;
    userId: string;
  }): Promise<CompletedReadRow[]> {
    return this.prisma.bookReadingCycle.findMany({
      orderBy: [{ finishedAt: "desc" }, { id: "asc" }],
      take: limit,
      where: {
        finishedAt: { gte: parseIsoDate(from), lte: parseIsoDate(to), not: null },
        state: READING_CYCLE_STATE.finished,
        userId,
        ...(after === null
          ? {}
          : {
              OR: [
                { finishedAt: { lt: parseIsoDate(after.finishedAt) } },
                { finishedAt: parseIsoDate(after.finishedAt), id: { gt: after.id } },
              ],
            }),
      },
      ...completedReadArgs,
    });
  }

  async findCompletedReadsSubsetPage({
    after,
    limit,
    ...scope
  }: CompletedReadsSubsetScope & {
    after: Nullable<CompletedReadsCursor>;
    limit: number;
  }): Promise<CompletedReadRow[]> {
    const afterCursor =
      after === null
        ? Prisma.empty
        : Prisma.sql`
            AND (
              cycle.finished_at < ${after.finishedAt}::date
              OR (cycle.finished_at = ${after.finishedAt}::date AND cycle.id > ${after.id}::uuid)
            )
          `;
    const rows = await this.prisma.$queryRaw`
      SELECT cycle.id::text AS "id"
      FROM book_reading_cycles cycle
      WHERE ${buildCompletedReadsSubsetCondition(scope)}
        ${afterCursor}
      ORDER BY cycle.finished_at DESC, cycle.id ASC
      LIMIT ${limit}
    `;

    const ids = z
      .array(CompletedReadsSubsetIdRowSchema)
      .parse(rows)
      .map((row) => row.id);
    if (ids.length === 0) {
      return [];
    }

    return this.prisma.bookReadingCycle.findMany({
      orderBy: [{ finishedAt: "desc" }, { id: "asc" }],
      where: { id: { in: ids }, userId: scope.userId },
      ...completedReadArgs,
    });
  }

  async findEarliestFinishedAt(userId: string): Promise<Nullable<Date>> {
    const earliest = await this.prisma.bookReadingCycle.aggregate({
      _min: { finishedAt: true },
      where: { state: READING_CYCLE_STATE.finished, userId },
    });
    return earliest._min.finishedAt;
  }

  async findReturningAuthors({
    limit,
    userId,
  }: {
    limit: number;
    userId: string;
  }): Promise<ReturningAuthor[]> {
    const rows = await this.prisma.$queryRaw`
      SELECT
        author ->> 'authorId' AS "authorId",
        (array_agg(author ->> 'name' ORDER BY cycle.finished_at DESC))[1] AS "name",
        COUNT(*)::int AS "completedReadCount",
        COUNT(DISTINCT date_part('year', cycle.finished_at))::int AS "distinctReadingYears",
        MAX(cycle.finished_at) AS "latestFinishedAt"
      FROM book_reading_cycles cycle
      JOIN LATERAL jsonb_array_elements(cycle.completion_metadata -> 'authors') AS author ON TRUE
      WHERE cycle.user_id = ${userId}::uuid
        AND cycle.state = ${READING_CYCLE_STATE.finished}
        AND cycle.finished_at IS NOT NULL
      GROUP BY 1
      HAVING COUNT(DISTINCT date_part('year', cycle.finished_at)) >= 2
      ORDER BY 4 DESC, 3 DESC, 5 DESC, 1 ASC
      LIMIT ${limit}
    `;

    return z
      .array(ReturningAuthorRowSchema)
      .parse(rows)
      .map((row) => ({ ...row, latestFinishedAt: toIsoDate(row.latestFinishedAt) }));
  }
}

function buildCompletedReadsSubsetCondition({
  filter,
  from,
  to,
  userId,
}: CompletedReadsSubsetScope): Prisma.Sql {
  return Prisma.sql`
    cycle.user_id = ${userId}::uuid
    AND cycle.state = ${READING_CYCLE_STATE.finished}
    AND cycle.finished_at IS NOT NULL
    AND (${from}::date IS NULL OR cycle.finished_at >= ${from}::date)
    AND cycle.finished_at <= ${to}::date
    AND ${parseableSnapshotCondition()}
    AND ${toSnapshotAttributeCondition(filter)}
  `;
}

function jsonArrayOf(element: JsonCondition): JsonCondition {
  return (value) => Prisma.sql`(
    jsonb_typeof(${value}) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(${value}) = 'array' THEN ${value} ELSE '[]'::jsonb END
      ) AS item(value)
      WHERE ${element(Prisma.sql`item.value`)} IS NOT TRUE
    )
  )`;
}

function jsonNonNegativeSafeInteger(value: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(${jsonSafeInteger(value)} AND ${value} >= '0'::jsonb)`;
}

function jsonNullable(condition: JsonCondition): JsonCondition {
  return (value) => Prisma.sql`(jsonb_typeof(${value}) = 'null' OR ${condition(value)})`;
}

function jsonNumberLiteral(literal: number): JsonCondition {
  return (value) => Prisma.sql`(${value} = to_jsonb(${literal}::numeric))`;
}

function jsonObject(shape: Record<string, JsonCondition>): JsonCondition {
  return (value) => {
    const fieldConditions = Object.entries(shape).map(([key, condition]) =>
      condition(Prisma.sql`(${value} -> ${key}::text)`),
    );
    return Prisma.sql`(
      jsonb_typeof(${value}) = 'object'
      AND ${Prisma.join(fieldConditions, " AND ")}
    )`;
  };
}

function jsonSafeInteger(value: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(
    CASE
      WHEN jsonb_typeof(${value}) = 'number'
        THEN ${value}::numeric = trunc(${value}::numeric)
          AND abs(${value}::numeric) <= ${Number.MAX_SAFE_INTEGER}::numeric
      ELSE false
    END
  )`;
}

function jsonString(value: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(jsonb_typeof(${value}) = 'string')`;
}

function jsonStringOneOf(options: readonly string[]): JsonCondition {
  return (value) =>
    Prisma.sql`(${jsonString(value)} AND (${value} #>> '{}') = ANY(${options}::text[]))`;
}

function jsonZodUuid(value: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(${jsonString(value)} AND (${value} #>> '{}') ~ ${ZOD_UUID_PATTERN}::text)`;
}

function parseableSnapshotCondition(): Prisma.Sql {
  return jsonObject({
    authors: jsonArrayOf(
      jsonObject({
        authorId: jsonZodUuid,
        name: jsonString,
      } satisfies JsonShapeOf<ReadingCompletionSnapshot["authors"][number]>),
    ),
    book: jsonObject({
      genres: jsonArrayOf(jsonString),
      language: jsonNullable(jsonStringOneOf(BookLanguageSchema.options)),
      pagesCount: jsonNullable(jsonNonNegativeSafeInteger),
      title: jsonString,
    } satisfies JsonShapeOf<ReadingCompletionSnapshot["book"]>),
    provenance: jsonStringOneOf(Object.values(READING_CYCLE_METADATA_PROVENANCE)),
    publisher: jsonNullable(
      jsonObject({
        name: jsonString,
        publisherId: jsonZodUuid,
      } satisfies JsonShapeOf<NonNullable<ReadingCompletionSnapshot["publisher"]>>),
    ),
    series: jsonNullable(
      jsonObject({
        knownBooksCount: jsonNonNegativeSafeInteger,
        name: jsonString,
        partNumber: jsonNullable(jsonSafeInteger),
        seriesId: jsonZodUuid,
        status: jsonString,
        totalBooks: jsonNullable(jsonSafeInteger),
      } satisfies JsonShapeOf<NonNullable<ReadingCompletionSnapshot["series"]>>),
    ),
    version: jsonNumberLiteral(READING_COMPLETION_SNAPSHOT_VERSION),
  } satisfies JsonShapeOf<ReadingCompletionSnapshot>)(Prisma.sql`cycle.completion_metadata`);
}

function toSnapshotAttributeCondition(filter: ReadingStatisticsSubsetFilter): Prisma.Sql {
  switch (filter.field) {
    case "authorId":
      return Prisma.sql`
        (cycle.completion_metadata -> 'authors')
          @> jsonb_build_array(jsonb_build_object('authorId', ${filter.value}::text))
      `;
    case "genre":
      return Prisma.sql`
        (cycle.completion_metadata #> '{book,genres}') @> jsonb_build_array(${filter.value}::text)
      `;
    case "language":
      return Prisma.sql`cycle.completion_metadata #>> '{book,language}' = ${filter.value}`;
    case "publisherId":
      return Prisma.sql`cycle.completion_metadata #>> '{publisher,publisherId}' = ${filter.value}`;
    default:
      return assertNever(filter);
  }
}

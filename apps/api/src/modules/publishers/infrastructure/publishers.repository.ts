import type {
  CatalogLocale,
  LibraryPublishersGeography,
  LibraryPublishersOrder,
  LibraryPublishersSort,
  LibraryPublishersSource,
  Nullable,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { PublisherModel } from "../../../generated/prisma/models.js";
import type {
  LibraryStatsRow,
  PriceTotalRow,
  SummaryCountsRow,
} from "../domain/publisher-library.mapper.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createLogger } from "../../../core/logger.js";
import { Prisma } from "../../../generated/prisma/client.js";

const READING_STATUS_FINISHED = "finished";
const READING_STATUS_READING = "reading";
const READING_STATUS_WANT_TO_READ = "want_to_read";
const OWNERSHIP_STATUS_WANT_TO_BUY = "want_to_buy";
const COUNTRY_CODE_UA = "UA";
const SLOW_LIBRARY_QUERY_MS = 200;

const logger = createLogger("publishers.repository");

const EMPTY_SUMMARY_COUNTS: SummaryCountsRow = {
  averageBookRating: null,
  booksWithoutPublisherCount: 0,
  booksWithPublisherCount: 0,
  publishersCount: 0,
  ratedBooksCount: 0,
  wantToBuyBooksCount: 0,
};

const primaryNamesArgs = {
  include: { names: { where: { isPrimary: true } } },
} satisfies Prisma.PublisherDefaultArgs;

export type CreateGlobalPublisherData = {
  countryCode: Nullable<string>;
  foundedYear: Nullable<number>;
  logoAttribution: Nullable<string>;
  logoLicense: Nullable<string>;
  logoLicenseUrl: Nullable<string>;
  logoUrl: Nullable<string>;
  name: string;
  normalizedName: string;
  searchText: string;
  websiteUrl: Nullable<string>;
  wikidataId: Nullable<string>;
};

export type PublisherNameSeed = {
  isPrimary: boolean;
  locale: string;
  name: string;
  normalizedName: string;
};

export type PublisherWithPrimaryNames = Prisma.PublisherGetPayload<typeof primaryNamesArgs>;

type AggregateLibraryInput = LibraryFilters &
  LibraryHavingFlags & {
    locale: CatalogLocale;
    order: LibraryPublishersOrder;
    skip: number;
    sort: LibraryPublishersSort;
    take: number;
  };

type CountLibraryInput = LibraryFilters & LibraryHavingFlags;

type LibraryDetailInput = {
  locale: CatalogLocale;
  publisherId: string;
  userId: string;
};

type LibraryFilters = {
  geography: LibraryPublishersGeography;
  publisherId?: string;
  search?: string;
  source: LibraryPublishersSource;
  userId: string;
};

type LibraryHavingFlags = {
  hasBooksToBuy: boolean;
  hasRatedBooks: boolean;
  hasSeries: boolean;
};

type RecentPublishersInput = {
  limit: number;
  userId: string;
};

type RunLibraryAggregateInput = {
  having: Prisma.Sql;
  limit: number;
  locale: CatalogLocale;
  offset: number;
  orderBy: Prisma.Sql;
  where: Prisma.Sql;
};

type RunLibraryCountInput = {
  having: Prisma.Sql;
  where: Prisma.Sql;
};

type SearchPublishersInput = {
  query: string | undefined;
  skip: number;
  take: number;
  userId: string;
};

type UpdateCustomPublisherFields = {
  countryCode?: Nullable<string>;
  foundedYear?: Nullable<number>;
  id: string;
  rename?: { name: string; normalizedName: string };
  websiteUrl?: Nullable<string>;
};

type UpsertCustomPublisherInput = {
  locale: string;
  name: string;
  normalizedName: string;
  userId: string;
};

type VisibleByIdsInput = {
  ids: string[];
  userId: string;
};

const LIBRARY_SORT_COLUMN: Record<LibraryPublishersSort, Prisma.Sql> = {
  averageRating: Prisma.sql`"averageRating"`,
  booksCount: Prisma.sql`"booksCount"`,
  lastBookAddedAt: Prisma.sql`"lastBookAddedAt"`,
  name: Prisma.sql`"name"`,
  readCount: Prisma.sql`"readCount"`,
  wantToBuyCount: Prisma.sql`"wantToBuyCount"`,
};

@Injectable()
export class PublishersRepository {
  constructor(private readonly prisma: PrismaService) {}

  aggregateLibrary(input: AggregateLibraryInput): Promise<LibraryStatsRow[]> {
    return timeQuery("aggregateLibrary", () =>
      runLibraryAggregate(this.prisma, {
        having: buildLibraryHaving(input),
        limit: input.take,
        locale: input.locale,
        offset: input.skip,
        orderBy: buildLibraryOrderBy(input.sort, input.order),
        where: buildLibraryWhere(input),
      }),
    );
  }

  async aggregateLibraryDetail({
    locale,
    publisherId,
    userId,
  }: LibraryDetailInput): Promise<Nullable<LibraryStatsRow>> {
    const rows = await timeQuery("aggregateLibraryDetail", () =>
      runLibraryAggregate(this.prisma, {
        having: Prisma.empty,
        limit: 1,
        locale,
        offset: 0,
        orderBy: Prisma.sql`p.id ASC`,
        where: buildLibraryWhere({ geography: "all", publisherId, source: "all", userId }),
      }),
    );
    return rows[0] ?? null;
  }

  countBooks(publisherId: string, client: Prisma.TransactionClient = this.prisma): Promise<number> {
    return client.book.count({ where: { publisherId } });
  }

  countLibrary(input: CountLibraryInput): Promise<number> {
    return timeQuery("countLibrary", () =>
      runLibraryCount(this.prisma, {
        having: buildLibraryHaving(input),
        where: buildLibraryWhere(input),
      }),
    );
  }

  countVisible(userId: string, query: string | undefined): Promise<number> {
    return this.prisma.publisher.count({ where: buildVisibleWhere(userId, query) });
  }

  createGlobal(
    data: CreateGlobalPublisherData,
    names: PublisherNameSeed[],
  ): Promise<PublisherModel> {
    return this.prisma.publisher.create({
      data: { ...data, names: { create: names }, userId: null },
    });
  }

  async deleteWithNames(
    publisherId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.publisherName.deleteMany({ where: { publisherId } });
    await client.publisher.delete({ where: { id: publisherId } });
  }

  findById(id: string): Promise<Nullable<PublisherModel>> {
    return this.prisma.publisher.findUnique({ where: { id } });
  }

  findByNormalized(
    userId: string,
    normalizedName: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<PublisherModel>> {
    return client.publisher.findFirst({
      where: { normalizedName, OR: [{ userId: null }, { userId }] },
    });
  }

  findVisibleById(
    userId: string,
    id: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<PublisherModel>> {
    return client.publisher.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
    });
  }

  findVisibleByIds({ ids, userId }: VisibleByIdsInput): Promise<PublisherWithPrimaryNames[]> {
    return this.prisma.publisher.findMany({
      where: { id: { in: ids }, OR: [{ userId: null }, { userId }] },
      ...primaryNamesArgs,
    });
  }

  async recentPublisherIds({ limit, userId }: RecentPublishersInput): Promise<string[]> {
    const grouped = await this.prisma.book.groupBy({
      _max: { createdAt: true },
      by: ["publisherId"],
      orderBy: { _max: { createdAt: "desc" } },
      take: limit,
      where: { publisherId: { not: null }, userId },
    });

    return grouped.flatMap((row) => (row.publisherId === null ? [] : [row.publisherId]));
  }

  searchVisible({
    query,
    skip,
    take,
    userId,
  }: SearchPublishersInput): Promise<PublisherWithPrimaryNames[]> {
    return this.prisma.publisher.findMany({
      orderBy: [{ userId: { nulls: "last", sort: "desc" } }, { name: "asc" }],
      skip,
      take,
      where: buildVisibleWhere(userId, query),
      ...primaryNamesArgs,
    });
  }

  async summaryCounts(userId: string): Promise<SummaryCountsRow> {
    const rows = await timeQuery("summaryCounts", () =>
      this.prisma.$queryRaw<SummaryCountsRow[]>(Prisma.sql`
        SELECT
          (count(DISTINCT b.publisher_id))::int AS "publishersCount",
          (count(*) FILTER (WHERE b.publisher_id IS NOT NULL))::int AS "booksWithPublisherCount",
          (count(*) FILTER (WHERE b.publisher_id IS NULL))::int AS "booksWithoutPublisherCount",
          (count(bp.rating))::int AS "ratedBooksCount",
          avg(bp.rating) AS "averageBookRating",
          (count(*) FILTER (WHERE b.ownership_status = ${OWNERSHIP_STATUS_WANT_TO_BUY}))::int AS "wantToBuyBooksCount"
        FROM books b
        LEFT JOIN book_reading_progress bp ON bp.book_id = b.id
        WHERE b.user_id = ${userId}::uuid
      `),
    );
    return rows[0] ?? EMPTY_SUMMARY_COUNTS;
  }

  summaryPriceTotals(userId: string): Promise<PriceTotalRow[]> {
    return timeQuery("summaryPriceTotals", () =>
      this.prisma.$queryRaw<PriceTotalRow[]>(Prisma.sql`
        SELECT
          pi.currency AS "currency",
          (round(sum(pi.expected_price), 2))::text AS "amount",
          (count(*))::int AS "pricedBooksCount"
        FROM book_purchase_info pi
        JOIN books b ON b.id = pi.book_id
        WHERE b.user_id = ${userId}::uuid
          AND pi.expected_price IS NOT NULL
          AND pi.currency IS NOT NULL
        GROUP BY pi.currency
        ORDER BY pi.currency ASC
      `),
    );
  }

  updateCustom(
    { countryCode, foundedYear, id, rename, websiteUrl }: UpdateCustomPublisherFields,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<PublisherModel> {
    const data: Prisma.PublisherUpdateInput = {
      ...(rename === undefined
        ? {}
        : {
            name: rename.name,
            normalizedName: rename.normalizedName,
            searchText: rename.normalizedName,
          }),
      ...(countryCode === undefined ? {} : { countryCode }),
      ...(foundedYear === undefined ? {} : { foundedYear }),
      ...(websiteUrl === undefined ? {} : { websiteUrl }),
    };
    return client.publisher.update({ data, where: { id } });
  }

  async updatePrimaryName(
    {
      name,
      normalizedName,
      publisherId,
    }: { name: string; normalizedName: string; publisherId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.publisherName.updateMany({
      data: { name, normalizedName },
      where: { isPrimary: true, publisherId },
    });
  }

  async upsertByNormalized(
    { locale, name, normalizedName, userId }: UpsertCustomPublisherInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<PublisherModel> {
    const publisher = await client.publisher.upsert({
      create: { name, normalizedName, searchText: normalizedName, userId },
      update: { normalizedName },
      where: { userId_normalizedName: { normalizedName, userId } },
    });
    await client.publisherName.upsert({
      create: { isPrimary: true, locale, name, normalizedName, publisherId: publisher.id },
      update: { normalizedName },
      where: {
        publisherId_locale_normalizedName: { locale, normalizedName, publisherId: publisher.id },
      },
    });
    return publisher;
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

function buildLibraryHaving({
  hasBooksToBuy,
  hasRatedBooks,
  hasSeries,
}: LibraryHavingFlags): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (hasBooksToBuy) {
    conditions.push(
      Prisma.sql`count(*) FILTER (WHERE b.ownership_status = ${OWNERSHIP_STATUS_WANT_TO_BUY}) > 0`,
    );
  }
  if (hasSeries) {
    conditions.push(Prisma.sql`count(DISTINCT b.series_id) > 0`);
  }
  if (hasRatedBooks) {
    conditions.push(Prisma.sql`count(bp.rating) > 0`);
  }
  return conditions.length === 0
    ? Prisma.empty
    : Prisma.sql`HAVING ${Prisma.join(conditions, " AND ")}`;
}

function buildLibraryOrderBy(
  sort: LibraryPublishersSort,
  order: LibraryPublishersOrder,
): Prisma.Sql {
  const direction = order === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const column = LIBRARY_SORT_COLUMN[sort];
  if (sort === "name") {
    return Prisma.sql`${column} ${direction}, p.id ASC`;
  }
  return Prisma.sql`${column} ${direction} NULLS LAST, "name" ASC, p.id ASC`;
}

function buildLibraryWhere(filters: LibraryFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`b.user_id = ${filters.userId}::uuid`,
    Prisma.sql`b.publisher_id IS NOT NULL`,
    Prisma.sql`(p.user_id IS NULL OR p.user_id = ${filters.userId}::uuid)`,
  ];
  if (filters.publisherId !== undefined) {
    conditions.push(Prisma.sql`b.publisher_id = ${filters.publisherId}::uuid`);
  }
  if (filters.search !== undefined && filters.search.length > 0) {
    conditions.push(Prisma.sql`p.search_text ILIKE ${`%${filters.search}%`}`);
  }
  const geography = geographyCondition(filters.geography);
  if (geography !== null) {
    conditions.push(geography);
  }
  const source = sourceCondition(filters.source, filters.userId);
  if (source !== null) {
    conditions.push(source);
  }
  return Prisma.join(conditions, " AND ");
}

function buildVisibleWhere(userId: string, query: string | undefined): Prisma.PublisherWhereInput {
  const searchFilter: Prisma.PublisherWhereInput =
    query === undefined || query.length === 0
      ? {}
      : { searchText: { contains: query, mode: "insensitive" } };

  return { ...searchFilter, OR: [{ userId: null }, { userId }] };
}

function geographyCondition(geography: LibraryPublishersGeography): Nullable<Prisma.Sql> {
  switch (geography) {
    case "all":
      return null;
    case "foreign":
      return Prisma.sql`(p.country_code IS NOT NULL AND p.country_code <> ${COUNTRY_CODE_UA})`;
    case "ua":
      return Prisma.sql`p.country_code = ${COUNTRY_CODE_UA}`;
    case "unknown":
      return Prisma.sql`p.country_code IS NULL`;
    default:
      return assertNever(geography);
  }
}

function runLibraryAggregate(
  prisma: PrismaService,
  { having, limit, locale, offset, orderBy, where }: RunLibraryAggregateInput,
): Promise<LibraryStatsRow[]> {
  return prisma.$queryRaw<LibraryStatsRow[]>(Prisma.sql`
    SELECT
      p.id AS "id",
      COALESCE(
        (
          SELECT pn.name
          FROM publisher_names pn
          WHERE pn.publisher_id = p.id AND pn.locale = ${locale} AND pn.is_primary = true
          LIMIT 1
        ),
        p.name
      ) AS "name",
      p.country_code AS "countryCode",
      p.website_url AS "websiteUrl",
      p.founded_year AS "foundedYear",
      (p.user_id IS NOT NULL) AS "isCustom",
      (count(*))::int AS "booksCount",
      (count(*) FILTER (WHERE b.reading_status = ${READING_STATUS_FINISHED}))::int AS "readCount",
      (count(*) FILTER (WHERE b.reading_status = ${READING_STATUS_READING}))::int AS "readingCount",
      (count(*) FILTER (WHERE b.reading_status = ${READING_STATUS_WANT_TO_READ}))::int AS "wantToReadCount",
      (count(*) FILTER (WHERE b.ownership_status = ${OWNERSHIP_STATUS_WANT_TO_BUY}))::int AS "wantToBuyCount",
      (count(*) FILTER (WHERE b.queue_position IS NOT NULL))::int AS "queueCount",
      (count(DISTINCT b.series_id))::int AS "seriesCount",
      avg(bp.rating) AS "averageRating",
      (count(bp.rating))::int AS "ratedBooksCount",
      to_char((MAX(b.created_at) AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "lastBookAddedAt",
      to_char(MAX(bp.finished_at), 'YYYY-MM-DD"T00:00:00.000Z"') AS "lastBookReadAt"
    FROM books b
    JOIN publishers p ON p.id = b.publisher_id
    LEFT JOIN book_reading_progress bp ON bp.book_id = b.id
    WHERE ${where}
    GROUP BY p.id
    ${having}
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `);
}

async function runLibraryCount(
  prisma: PrismaService,
  { having, where }: RunLibraryCountInput,
): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    SELECT (count(*))::int AS "count"
    FROM (
      SELECT b.publisher_id
      FROM books b
      JOIN publishers p ON p.id = b.publisher_id
      LEFT JOIN book_reading_progress bp ON bp.book_id = b.id
      WHERE ${where}
      GROUP BY b.publisher_id
      ${having}
    ) grouped
  `);
  return rows[0]?.count ?? 0;
}

function sourceCondition(source: LibraryPublishersSource, userId: string): Nullable<Prisma.Sql> {
  switch (source) {
    case "all":
      return null;
    case "custom":
      return Prisma.sql`p.user_id = ${userId}::uuid`;
    case "global":
      return Prisma.sql`p.user_id IS NULL`;
    default:
      return assertNever(source);
  }
}

async function timeQuery<T>(label: string, run: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  const result = await run();
  const durationMs = Math.round(performance.now() - startedAt);
  if (durationMs >= SLOW_LIBRARY_QUERY_MS) {
    logger.warn({ durationMs, query: label }, "Slow publisher library query");
  }
  return result;
}

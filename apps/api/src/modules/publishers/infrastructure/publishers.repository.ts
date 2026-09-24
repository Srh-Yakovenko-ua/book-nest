import type {
  CatalogLocale,
  LibraryPublishersGeography,
  LibraryPublishersOrder,
  LibraryPublishersQuickFilter,
  LibraryPublishersSort,
  LibraryPublishersSource,
  Nullable,
} from "@app/shared";

import { LIBRARY_PUBLISHERS_INSIGHT_LIMITS, LibraryPublishersQuickFilterSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { PublisherModel } from "../../../generated/prisma/models.js";
import type { LibraryQuickCountTotals } from "../domain/publisher-library-quick-counts.js";
import type {
  LibraryDetailStatsRow,
  LibraryStatsRow,
  PriceTotalRow,
  SummaryCountsRow,
  SummaryInsightsRow,
} from "../domain/publisher-library.mapper.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { visibleToUser } from "../../../core/database/two-tier-visibility.js";
import { createLogger } from "../../../core/logger.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { PUBLISHER_BOOK_STATUSES } from "../domain/publisher-book-statuses.js";

const PUBLISHER_STAT_SQL = {
  activeSeriesCount: Prisma.sql`count(DISTINCT s.id) FILTER (WHERE s.deleted_at IS NULL)`,
  queueCount: Prisma.sql`count(b.id) FILTER (WHERE b.queue_position IS NOT NULL)`,
  ratedBooksCount: Prisma.sql`count(bp.rating)`,
  readCount: Prisma.sql`count(b.id) FILTER (WHERE b.reading_status IN (${Prisma.join(PUBLISHER_BOOK_STATUSES.read)}))`,
  readingCount: Prisma.sql`count(b.id) FILTER (WHERE b.reading_status IN (${Prisma.join(PUBLISHER_BOOK_STATUSES.reading)}))`,
  wantToBuyCount: Prisma.sql`count(b.id) FILTER (WHERE b.ownership_status = ${PUBLISHER_BOOK_STATUSES.wantToBuy})`,
  wantToReadCount: Prisma.sql`count(b.id) FILTER (WHERE b.reading_status = ${PUBLISHER_BOOK_STATUSES.wantToRead})`,
};

const LIBRARY_BOOKS_SOURCE_SQL = Prisma.sql`
  FROM books b
  JOIN publishers p ON p.id = b.publisher_id
  LEFT JOIN book_reading_progress bp ON bp.book_id = b.id
  LEFT JOIN series s ON s.id = b.series_id
`;

const SUMMARY_INSIGHT_LIMITS = {
  bestRatedMinRatedBooks: 3,
  topCoveragePublishers: 5,
};

const COUNTRY_CODE_UA = "UA";
const SLOW_LIBRARY_QUERY_MS = 200;

const logger = createLogger("publishers.repository");

const LibraryStatsRowSchema = z.object({
  averageRating: z.number().nullable(),
  booksCount: z.number(),
  countryCode: z.string().nullable(),
  foundedYear: z.number().nullable(),
  id: z.string(),
  isCustom: z.boolean(),
  lastBookAddedAt: z.string().nullable(),
  lastBookReadAt: z.string().nullable(),
  name: z.string(),
  queueCount: z.number(),
  ratedBooksCount: z.number(),
  readCount: z.number(),
  readingCount: z.number(),
  seriesCount: z.number(),
  wantToBuyCount: z.number(),
  wantToReadCount: z.number(),
  websiteUrl: z.string().nullable(),
});

const LibraryDetailStatsRowSchema = LibraryStatsRowSchema.extend({
  wishlistWithoutPriceCount: z.number(),
});

const PriceTotalRowSchema = z.object({
  amount: z.string(),
  currency: z.string(),
  pricedBooksCount: z.number(),
});

const SummaryCountsRowSchema = z.object({
  averageBookRating: z.number().nullable(),
  booksWithoutPublisherCount: z.number(),
  booksWithPublisherCount: z.number(),
  publishersCount: z.number(),
  ratedBooksCount: z.number(),
  wantToBuyBooksCount: z.number(),
});

const LibraryCountRowSchema = z.object({ count: z.number() });

const LibraryQuickCountsRowSchema = z.object({
  all: z.number(),
  read: z.number(),
  reading: z.number(),
  series: z.number(),
  to_buy: z.number(),
} satisfies Record<LibraryPublishersQuickFilter, z.ZodNumber>);

const InsightPublisherSchema = z.object({ id: z.string(), name: z.string() });

const SummaryInsightsRowSchema = z.object({
  attributedBooksCount: z.number(),
  bestRatedPublishers: z.array(
    InsightPublisherSchema.extend({ averageRating: z.number(), ratedBooksCount: z.number() }),
  ),
  booksToBuyWithPublisherCount: z.number(),
  mostReadPublisher: InsightPublisherSchema.extend({ readCount: z.number() }).nullable(),
  mostRepresentedPublisher: InsightPublisherSchema.extend({ booksCount: z.number() }).nullable(),
  publishersInPlansCount: z.number(),
  topFiveBooksCount: z.number(),
  unreadPublishers: z.array(InsightPublisherSchema.extend({ unreadCount: z.number() })),
});

const EMPTY_SUMMARY_COUNTS: SummaryCountsRow = {
  averageBookRating: null,
  booksWithoutPublisherCount: 0,
  booksWithPublisherCount: 0,
  publishersCount: 0,
  ratedBooksCount: 0,
  wantToBuyBooksCount: 0,
};

const EMPTY_SUMMARY_INSIGHTS: SummaryInsightsRow = {
  attributedBooksCount: 0,
  bestRatedPublishers: [],
  booksToBuyWithPublisherCount: 0,
  mostReadPublisher: null,
  mostRepresentedPublisher: null,
  publishersInPlansCount: 0,
  topFiveBooksCount: 0,
  unreadPublishers: [],
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

type CountLibraryQuickFiltersInput = LibraryFilters & Omit<LibraryHavingFlags, "filter">;

type LibraryDetailInput = {
  locale: CatalogLocale;
  publisherId: string;
  userId: string;
};

type LibraryFilters = {
  geography: LibraryPublishersGeography;
  search?: string;
  source: LibraryPublishersSource;
  userId: string;
};

type LibraryHavingFlags = {
  filter: LibraryPublishersQuickFilter;
  hasBooksToBuy: boolean;
  hasQueue: boolean;
  hasRatedBooks: boolean;
  hasSeries: boolean;
  hasWantToRead: boolean;
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

type SummaryInsightsInput = {
  locale: CatalogLocale;
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

const LIBRARY_QUICK_COUNT_COLUMN: Record<LibraryPublishersQuickFilter, Prisma.Sql> = {
  all: Prisma.sql`"all"`,
  read: Prisma.sql`"read"`,
  reading: Prisma.sql`"reading"`,
  series: Prisma.sql`"series"`,
  to_buy: Prisma.sql`"to_buy"`,
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
  }: LibraryDetailInput): Promise<Nullable<LibraryDetailStatsRow>> {
    const rows = await timeQuery("aggregateLibraryDetail", () =>
      this.prisma.$queryRaw(Prisma.sql`
        SELECT
          ${libraryStatsColumns(locale)},
          (count(b.id) FILTER (
            WHERE b.ownership_status = ${PUBLISHER_BOOK_STATUSES.wantToBuy}
              AND NOT EXISTS (
                SELECT 1
                FROM book_store_links sl
                WHERE sl.book_id = b.id AND sl.price IS NOT NULL
              )
          ))::int AS "wishlistWithoutPriceCount"
        FROM publishers p
        LEFT JOIN books b
          ON b.publisher_id = p.id
          AND b.user_id = ${userId}::uuid
          AND b.deleted_at IS NULL
        LEFT JOIN book_reading_progress bp ON bp.book_id = b.id
        LEFT JOIN series s ON s.id = b.series_id
        WHERE p.id = ${publisherId}::uuid
          AND (p.user_id IS NULL OR p.user_id = ${userId}::uuid)
        GROUP BY p.id
      `),
    );
    return z.array(LibraryDetailStatsRowSchema).parse(rows)[0] ?? null;
  }

  countBooks(publisherId: string, client: Prisma.TransactionClient = this.prisma): Promise<number> {
    return client.book.count({ where: { ...SOFT_DELETE_SCOPE.active, publisherId } });
  }

  countLibrary(input: CountLibraryInput): Promise<number> {
    return timeQuery("countLibrary", () =>
      runLibraryCount(this.prisma, {
        having: buildLibraryHaving(input),
        where: buildLibraryWhere(input),
      }),
    );
  }

  async countLibraryQuickFilters(
    input: CountLibraryQuickFiltersInput,
  ): Promise<LibraryQuickCountTotals> {
    const keys = LibraryPublishersQuickFilterSchema.options;
    const rows = await timeQuery("countLibraryQuickFilters", () =>
      this.prisma.$queryRaw(Prisma.sql`
        SELECT ${Prisma.join(
          keys.map(
            (key) =>
              Prisma.sql`(count(*) FILTER (WHERE grouped.${LIBRARY_QUICK_COUNT_COLUMN[key]}))::int AS ${LIBRARY_QUICK_COUNT_COLUMN[key]}`,
          ),
        )}
        FROM (
          SELECT ${Prisma.join(
            keys.map(
              (key) =>
                Prisma.sql`(${quickFilterCondition(key) ?? Prisma.sql`true`}) AS ${LIBRARY_QUICK_COUNT_COLUMN[key]}`,
            ),
          )}
          ${LIBRARY_BOOKS_SOURCE_SQL}
          WHERE ${buildLibraryWhere(input)}
          GROUP BY b.publisher_id
          ${buildLibraryHaving({ ...input, filter: "all" })}
        ) grouped
      `),
    );
    return z.tuple([LibraryQuickCountsRowSchema]).parse(rows)[0];
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
  ): Promise<number> {
    await client.publisherName.deleteMany({ where: { publisherId } });
    const deleted = await client.publisher.deleteMany({ where: { id: publisherId } });
    return deleted.count;
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
      where: { normalizedName, ...visibleToUser(userId) },
    });
  }

  findVisibleById(
    userId: string,
    id: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<PublisherModel>> {
    return client.publisher.findFirst({
      where: { id, ...visibleToUser(userId) },
    });
  }

  findVisibleByIds({ ids, userId }: VisibleByIdsInput): Promise<PublisherWithPrimaryNames[]> {
    return this.prisma.publisher.findMany({
      where: { id: { in: ids }, ...visibleToUser(userId) },
      ...primaryNamesArgs,
    });
  }

  async recentPublisherIds({ limit, userId }: RecentPublishersInput): Promise<string[]> {
    const grouped = await this.prisma.book.groupBy({
      _max: { createdAt: true },
      by: ["publisherId"],
      orderBy: { _max: { createdAt: "desc" } },
      take: limit,
      where: { ...SOFT_DELETE_SCOPE.active, publisherId: { not: null }, userId },
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
      this.prisma.$queryRaw(Prisma.sql`
        SELECT
          (count(DISTINCT b.publisher_id))::int AS "publishersCount",
          (count(*) FILTER (WHERE b.publisher_id IS NOT NULL))::int AS "booksWithPublisherCount",
          (count(*) FILTER (WHERE b.publisher_id IS NULL))::int AS "booksWithoutPublisherCount",
          (count(bp.rating))::int AS "ratedBooksCount",
          avg(bp.rating) AS "averageBookRating",
          (${PUBLISHER_STAT_SQL.wantToBuyCount})::int AS "wantToBuyBooksCount"
        FROM books b
        LEFT JOIN book_reading_progress bp ON bp.book_id = b.id
        WHERE b.user_id = ${userId}::uuid
          AND b.deleted_at IS NULL
      `),
    );
    return z.array(SummaryCountsRowSchema).parse(rows)[0] ?? EMPTY_SUMMARY_COUNTS;
  }

  async summaryInsights({ locale, userId }: SummaryInsightsInput): Promise<SummaryInsightsRow> {
    const rows = await timeQuery("summaryInsights", () =>
      this.prisma.$queryRaw(Prisma.sql`
        WITH stats AS (
          SELECT
            p.id AS id,
            ${localizedPublisherName(locale)} AS name,
            (count(b.id))::int AS books_count,
            (${PUBLISHER_STAT_SQL.readCount})::int AS read_count,
            (${PUBLISHER_STAT_SQL.wantToBuyCount})::int AS want_to_buy_count,
            (${PUBLISHER_STAT_SQL.ratedBooksCount})::int AS rated_books_count,
            avg(bp.rating) AS average_rating
          FROM books b
          JOIN publishers p ON p.id = b.publisher_id
          LEFT JOIN book_reading_progress bp ON bp.book_id = b.id
          WHERE ${buildLibraryWhere({ geography: "all", source: "all", userId })}
          GROUP BY p.id
        )
        SELECT
          (SELECT COALESCE(sum(books_count), 0) FROM stats)::int AS "attributedBooksCount",
          (
            SELECT COALESCE(sum(top_publishers.books_count), 0)
            FROM (
              SELECT books_count
              FROM stats
              ORDER BY books_count DESC, name ASC, id ASC
              LIMIT ${SUMMARY_INSIGHT_LIMITS.topCoveragePublishers}
            ) top_publishers
          )::int AS "topFiveBooksCount",
          (
            SELECT json_build_object('id', id, 'name', name, 'booksCount', books_count)
            FROM stats
            ORDER BY books_count DESC, name ASC, id ASC
            LIMIT 1
          ) AS "mostRepresentedPublisher",
          (SELECT count(*) FROM stats WHERE want_to_buy_count > 0)::int AS "publishersInPlansCount",
          (SELECT COALESCE(sum(want_to_buy_count), 0) FROM stats)::int AS "booksToBuyWithPublisherCount",
          (
            SELECT json_build_object('id', id, 'name', name, 'readCount', read_count)
            FROM stats
            WHERE read_count > 0
            ORDER BY read_count DESC, name ASC, id ASC
            LIMIT 1
          ) AS "mostReadPublisher",
          (
            SELECT COALESCE(
              json_agg(
                json_build_object('id', id, 'name', name, 'unreadCount', unread_count)
                ORDER BY unread_count DESC, name ASC, id ASC
              ),
              '[]'::json
            )
            FROM (
              SELECT id, name, books_count - read_count AS unread_count
              FROM stats
              WHERE books_count - read_count > 0
              ORDER BY unread_count DESC, name ASC, id ASC
              LIMIT ${LIBRARY_PUBLISHERS_INSIGHT_LIMITS.listSize}
            ) unread_publishers
          ) AS "unreadPublishers",
          (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'id', id,
                  'name', name,
                  'averageRating', average_rating,
                  'ratedBooksCount', rated_books_count
                )
                ORDER BY average_rating DESC, rated_books_count DESC, name ASC, id ASC
              ),
              '[]'::json
            )
            FROM (
              SELECT id, name, average_rating, rated_books_count
              FROM stats
              WHERE rated_books_count >= ${SUMMARY_INSIGHT_LIMITS.bestRatedMinRatedBooks}
              ORDER BY average_rating DESC, rated_books_count DESC, name ASC, id ASC
              LIMIT ${LIBRARY_PUBLISHERS_INSIGHT_LIMITS.listSize}
            ) best_rated_publishers
          ) AS "bestRatedPublishers"
      `),
    );
    return z.array(SummaryInsightsRowSchema).parse(rows)[0] ?? EMPTY_SUMMARY_INSIGHTS;
  }

  async summaryPriceTotals(userId: string): Promise<PriceTotalRow[]> {
    const rows = await timeQuery("summaryPriceTotals", () =>
      this.prisma.$queryRaw(Prisma.sql`
        SELECT
          pi.currency AS "currency",
          (round(sum(pi.expected_price), 2))::text AS "amount",
          (count(*))::int AS "pricedBooksCount"
        FROM book_purchase_info pi
        JOIN books b ON b.id = pi.book_id
        WHERE b.user_id = ${userId}::uuid
          AND b.deleted_at IS NULL
          AND pi.expected_price IS NOT NULL
          AND pi.currency IS NOT NULL
        GROUP BY pi.currency
        ORDER BY pi.currency ASC
      `),
    );
    return z.array(PriceTotalRowSchema).parse(rows);
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
  filter,
  hasBooksToBuy,
  hasQueue,
  hasRatedBooks,
  hasSeries,
  hasWantToRead,
}: LibraryHavingFlags): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  const quickFilter = quickFilterCondition(filter);
  if (quickFilter !== null) {
    conditions.push(quickFilter);
  }
  if (hasBooksToBuy) {
    conditions.push(Prisma.sql`${PUBLISHER_STAT_SQL.wantToBuyCount} > 0`);
  }
  if (hasSeries) {
    conditions.push(Prisma.sql`${PUBLISHER_STAT_SQL.activeSeriesCount} > 0`);
  }
  if (hasRatedBooks) {
    conditions.push(Prisma.sql`${PUBLISHER_STAT_SQL.ratedBooksCount} > 0`);
  }
  if (hasWantToRead) {
    conditions.push(Prisma.sql`${PUBLISHER_STAT_SQL.wantToReadCount} > 0`);
  }
  if (hasQueue) {
    conditions.push(Prisma.sql`${PUBLISHER_STAT_SQL.queueCount} > 0`);
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
    Prisma.sql`b.deleted_at IS NULL`,
    Prisma.sql`b.publisher_id IS NOT NULL`,
    Prisma.sql`(p.user_id IS NULL OR p.user_id = ${filters.userId}::uuid)`,
  ];
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

  return { ...searchFilter, ...visibleToUser(userId) };
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

function libraryStatsColumns(locale: CatalogLocale): Prisma.Sql {
  return Prisma.sql`
    p.id AS "id",
    ${localizedPublisherName(locale)} AS "name",
    p.country_code AS "countryCode",
    p.website_url AS "websiteUrl",
    p.founded_year AS "foundedYear",
    (p.user_id IS NOT NULL) AS "isCustom",
    (count(b.id))::int AS "booksCount",
    (${PUBLISHER_STAT_SQL.readCount})::int AS "readCount",
    (${PUBLISHER_STAT_SQL.readingCount})::int AS "readingCount",
    (${PUBLISHER_STAT_SQL.wantToReadCount})::int AS "wantToReadCount",
    (${PUBLISHER_STAT_SQL.wantToBuyCount})::int AS "wantToBuyCount",
    (${PUBLISHER_STAT_SQL.queueCount})::int AS "queueCount",
    (${PUBLISHER_STAT_SQL.activeSeriesCount})::int AS "seriesCount",
    avg(bp.rating) AS "averageRating",
    (${PUBLISHER_STAT_SQL.ratedBooksCount})::int AS "ratedBooksCount",
    to_char((MAX(b.created_at) AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "lastBookAddedAt",
    to_char(MAX(bp.finished_at), 'YYYY-MM-DD"T00:00:00.000Z"') AS "lastBookReadAt"
  `;
}

function localizedPublisherName(locale: CatalogLocale): Prisma.Sql {
  return Prisma.sql`COALESCE(
    (
      SELECT pn.name
      FROM publisher_names pn
      WHERE pn.publisher_id = p.id AND pn.locale = ${locale} AND pn.is_primary = true
      LIMIT 1
    ),
    p.name
  )`;
}

function quickFilterCondition(filter: LibraryPublishersQuickFilter): Nullable<Prisma.Sql> {
  switch (filter) {
    case "all":
      return null;
    case "read":
      return Prisma.sql`${PUBLISHER_STAT_SQL.readCount} > 0`;
    case "reading":
      return Prisma.sql`${PUBLISHER_STAT_SQL.readingCount} > 0`;
    case "series":
      return Prisma.sql`${PUBLISHER_STAT_SQL.activeSeriesCount} > 0`;
    case "to_buy":
      return Prisma.sql`${PUBLISHER_STAT_SQL.wantToBuyCount} > 0`;
    default:
      return assertNever(filter);
  }
}

async function runLibraryAggregate(
  prisma: PrismaService,
  { having, limit, locale, offset, orderBy, where }: RunLibraryAggregateInput,
): Promise<LibraryStatsRow[]> {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT ${libraryStatsColumns(locale)}
    ${LIBRARY_BOOKS_SOURCE_SQL}
    WHERE ${where}
    GROUP BY p.id
    ${having}
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `);
  return z.array(LibraryStatsRowSchema).parse(rows);
}

async function runLibraryCount(
  prisma: PrismaService,
  { having, where }: RunLibraryCountInput,
): Promise<number> {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT (count(*))::int AS "count"
    FROM (
      SELECT b.publisher_id
      ${LIBRARY_BOOKS_SOURCE_SQL}
      WHERE ${where}
      GROUP BY b.publisher_id
      ${having}
    ) grouped
  `);
  return z.array(LibraryCountRowSchema).parse(rows)[0]?.count ?? 0;
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

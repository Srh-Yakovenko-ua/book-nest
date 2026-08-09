import type { LibrarySort, Nullable, OwnershipStatus, ReadingStatus } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { buildLibraryWhere, type LibraryFilter } from "./book-where.js";
import {
  ACTIVE_BOOK_SQL,
  type BookWithRelations,
  GenreCountRowSchema,
  LIBRARY_ORDER_BY,
  withRelations,
} from "./books.repository.js";

const CountRowSchema = z.object({ count: z.number() });

const FavoriteGenreCountRowSchema = z.object({ count: z.bigint(), genre: z.string() });

const FavoriteTagCountRowSchema = z.object({ count: z.bigint(), tag: z.string() });

const StoreNameRowSchema = z.object({ storeName: z.string() });

const FavoritesSummaryCountsRowSchema = z.object({
  finished: z.number(),
  reading: z.number(),
  series: z.number(),
  solo: z.number(),
  total: z.number(),
  unrated: z.number(),
  wantToRead: z.number(),
});

const EMPTY_FAVORITES_COUNTS: z.infer<typeof FavoritesSummaryCountsRowSchema> = {
  finished: 0,
  reading: 0,
  series: 0,
  solo: 0,
  total: 0,
  unrated: 0,
  wantToRead: 0,
};

const FAVORITE_TOP_LIMIT = 3;

export type ActiveReadingRow = {
  currentPage: Nullable<number>;
  id: string;
  pagesCount: Nullable<number>;
  title: string;
};

type FavoritesSummaryQuery = {
  finishedStatuses: ReadingStatus[];
  readingStatuses: ReadingStatus[];
  userId: string;
  wantToReadStatuses: ReadingStatus[];
};

type FavoritesSummaryResult = {
  averageRating: Nullable<number>;
  finished: number;
  reading: number;
  series: number;
  solo: number;
  topGenres: { count: number; genre: string }[];
  topTags: { count: number; tag: string }[];
  total: number;
  unrated: number;
  wantToRead: number;
};

type ListForLibraryInput = {
  filter: LibraryFilter;
  skip: number;
  sort: LibrarySort;
  take: number;
};

@Injectable()
export class BookLibraryReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  countByReadingStatuses({
    isFavorite,
    ownershipStatuses,
    statuses,
    userId,
  }: {
    isFavorite?: boolean;
    ownershipStatuses?: OwnershipStatus[];
    statuses: ReadingStatus[];
    userId: string;
  }): Promise<number> {
    return this.prisma.book.count({
      where: buildLibraryWhere({
        isFavorite,
        ownershipStatuses,
        readingStatuses: statuses,
        userId,
      }),
    });
  }

  countByUser({
    ownershipStatuses,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<number> {
    return this.prisma.book.count({ where: buildLibraryWhere({ ownershipStatuses, userId }) });
  }

  async countDistinctAuthors({
    ownershipStatuses,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<number> {
    const ownershipFilter =
      ownershipStatuses === undefined
        ? Prisma.empty
        : Prisma.sql`AND book.ownership_status IN (${Prisma.join(ownershipStatuses)})`;
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT (count(DISTINCT book_author.author_id))::int AS "count"
      FROM book_authors book_author
      JOIN books book ON book.id = book_author.book_id
      WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
        ${ownershipFilter}
    `);
    return z.array(CountRowSchema).parse(rows)[0]?.count ?? 0;
  }

  async countDistinctSeries({
    ownershipStatuses,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<number> {
    const ownershipFilter =
      ownershipStatuses === undefined
        ? Prisma.empty
        : Prisma.sql`AND book.ownership_status IN (${Prisma.join(ownershipStatuses)})`;
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT (count(DISTINCT book.series_id))::int AS "count"
      FROM books book
      WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
        AND book.series_id IS NOT NULL
        ${ownershipFilter}
    `);
    return z.array(CountRowSchema).parse(rows)[0]?.count ?? 0;
  }

  countFavorites({
    ownershipStatuses,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<number> {
    return this.prisma.book.count({
      where: buildLibraryWhere({ isFavorite: true, ownershipStatuses, userId }),
    });
  }

  countForLibrary({ filter }: { filter: LibraryFilter }): Promise<number> {
    return this.prisma.book.count({ where: buildLibraryWhere(filter) });
  }

  async favoritesSummary({
    finishedStatuses,
    readingStatuses,
    userId,
    wantToReadStatuses,
  }: FavoritesSummaryQuery): Promise<FavoritesSummaryResult> {
    const [countsRows, ratingAggregate, topGenreRows, topTagRows] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        SELECT
          (count(*))::int AS "total",
          (count(*) FILTER (WHERE book.reading_status IN (${Prisma.join(readingStatuses)})))::int AS "reading",
          (count(*) FILTER (WHERE book.reading_status IN (${Prisma.join(finishedStatuses)})))::int AS "finished",
          (count(*) FILTER (WHERE book.reading_status IN (${Prisma.join(wantToReadStatuses)})))::int AS "wantToRead",
          (count(*) FILTER (WHERE book.series_id IS NOT NULL))::int AS "series",
          (count(*) FILTER (WHERE book.series_id IS NULL))::int AS "solo",
          (count(*) FILTER (
            WHERE book.reading_status IN (${Prisma.join(finishedStatuses)})
              AND progress.rating IS NULL
          ))::int AS "unrated"
        FROM books book
        LEFT JOIN book_reading_progress progress ON progress.book_id = book.id
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND book.is_favorite = true
      `),
      this.prisma.bookReadingProgress.aggregate({
        _avg: { rating: true },
        where: {
          book: { ...SOFT_DELETE_SCOPE.active, isFavorite: true, userId },
          rating: { not: null },
        },
      }),
      this.prisma.$queryRaw`
        SELECT g AS genre, count(*) AS count
        FROM books book, unnest(book.genres) AS g
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND book.is_favorite = true
        GROUP BY g
        ORDER BY count DESC, genre ASC
        LIMIT ${FAVORITE_TOP_LIMIT}
      `,
      this.prisma.$queryRaw`
        SELECT tag.name AS tag, count(*) AS count
        FROM book_tags book_tag
        JOIN tags tag ON tag.id = book_tag.tag_id
        JOIN books book ON book.id = book_tag.book_id
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND tag.user_id = ${userId}::uuid
          AND book.is_favorite = true
        GROUP BY tag.name
        ORDER BY count DESC, tag ASC
        LIMIT ${FAVORITE_TOP_LIMIT}
      `,
    ]);

    const counts =
      z.array(FavoritesSummaryCountsRowSchema).parse(countsRows)[0] ?? EMPTY_FAVORITES_COUNTS;
    const topGenres = z.array(FavoriteGenreCountRowSchema).parse(topGenreRows);
    const topTags = z.array(FavoriteTagCountRowSchema).parse(topTagRows);

    return {
      averageRating: ratingAggregate._avg.rating,
      finished: counts.finished,
      reading: counts.reading,
      series: counts.series,
      solo: counts.solo,
      topGenres: topGenres.map((row) => ({ count: Number(row.count), genre: row.genre })),
      topTags: topTags.map((row) => ({ count: Number(row.count), tag: row.tag })),
      total: counts.total,
      unrated: counts.unrated,
      wantToRead: counts.wantToRead,
    };
  }

  async listActiveReading({
    ownershipStatuses,
    statuses,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    statuses: ReadingStatus[];
    userId: string;
  }): Promise<ActiveReadingRow[]> {
    const rows = await this.prisma.book.findMany({
      select: {
        id: true,
        pagesCount: true,
        readingProgress: { select: { currentPage: true } },
        title: true,
      },
      where: buildLibraryWhere({ ownershipStatuses, readingStatuses: statuses, userId }),
    });
    return rows.map((row) => ({
      currentPage: row.readingProgress?.currentPage ?? null,
      id: row.id,
      pagesCount: row.pagesCount,
      title: row.title,
    }));
  }

  listForLibrary({ filter, skip, sort, take }: ListForLibraryInput): Promise<BookWithRelations[]> {
    return this.prisma.book.findMany({
      include: withRelations,
      orderBy: LIBRARY_ORDER_BY[sort],
      skip,
      take,
      where: buildLibraryWhere(filter),
    });
  }

  listRecentlyAdded({
    ownershipStatuses,
    take,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    take: number;
    userId: string;
  }): Promise<BookWithRelations[]> {
    return this.prisma.book.findMany({
      include: withRelations,
      orderBy: { createdAt: "desc" },
      take,
      where: buildLibraryWhere({ ownershipStatuses, userId }),
    });
  }

  async recentPurchaseStores({
    limit,
    userId,
  }: {
    limit: number;
    userId: string;
  }): Promise<string[]> {
    const rows = await this.prisma.$queryRaw`
      WITH entered_store_name AS (
        SELECT btrim(purchase.store_name) AS store_name, purchase.created_at AS entered_at
        FROM book_purchase_info purchase
        JOIN books book ON book.id = purchase.book_id
        WHERE book.user_id = ${userId}::uuid
            ${ACTIVE_BOOK_SQL}
          AND purchase.store_name IS NOT NULL
          AND btrim(purchase.store_name) <> ''
        UNION ALL
        SELECT btrim(store_link.store_name) AS store_name, store_link.created_at AS entered_at
        FROM book_store_links store_link
        JOIN books book ON book.id = store_link.book_id
        WHERE book.user_id = ${userId}::uuid
            ${ACTIVE_BOOK_SQL}
          AND btrim(store_link.store_name) <> ''
      ),
      latest_store_name AS (
        SELECT DISTINCT ON (lower(store_name)) store_name, entered_at
        FROM entered_store_name
        ORDER BY lower(store_name), entered_at DESC, store_name ASC
      )
      SELECT store_name AS "storeName"
      FROM latest_store_name
      ORDER BY entered_at DESC, store_name ASC
      LIMIT ${limit}
    `;
    return z
      .array(StoreNameRowSchema)
      .parse(rows)
      .map((row) => row.storeName);
  }

  async topGenreKeys({
    limit,
    ownershipStatuses,
    userId,
  }: {
    limit: number;
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<{ count: number; key: string }[]> {
    const ownershipFilter =
      ownershipStatuses === undefined
        ? Prisma.empty
        : Prisma.sql`AND ownership_status IN (${Prisma.join(ownershipStatuses)})`;
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT unnest(genres) AS key, count(*) AS count
      FROM books
      WHERE user_id = ${userId}::uuid
        AND deleted_at IS NULL
        ${ownershipFilter}
      GROUP BY key
      ORDER BY count DESC, key ASC
      LIMIT ${limit}
    `);
    return z
      .array(GenreCountRowSchema)
      .parse(rows)
      .map((row) => ({ count: Number(row.count), key: row.key }));
  }

  async topTags({
    limit,
    ownershipStatuses,
    userId,
  }: {
    limit: number;
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<{ count: number; id: string; name: string }[]> {
    const grouped = await this.prisma.bookTag.groupBy({
      _count: { tagId: true },
      by: ["tagId"],
      orderBy: { _count: { tagId: "desc" } },
      take: limit,
      where: { book: buildLibraryWhere({ ownershipStatuses, userId }) },
    });
    if (grouped.length === 0) {
      return [];
    }
    const tags = await this.prisma.tag.findMany({
      select: { id: true, name: true },
      where: { id: { in: grouped.map((entry) => entry.tagId) } },
    });
    const nameById = new Map(tags.map((tag) => [tag.id, tag.name]));
    return grouped.flatMap((entry) => {
      const name = nameById.get(entry.tagId);
      return name === undefined ? [] : [{ count: entry._count.tagId, id: entry.tagId, name }];
    });
  }
}

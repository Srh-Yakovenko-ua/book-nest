import type { Nullable } from "@app/shared";

import { PUBLISHER_OVERVIEW_LIMITS } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type {
  OverviewLatestBookRow,
  OverviewReadingBookRow,
  OverviewSeriesRow,
  OverviewWishlistBookRow,
} from "../domain/publisher-overview.mapper.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { PUBLISHER_BOOK_STATUSES } from "../domain/publisher-book-statuses.js";

const compactBookSelect = {
  authors: {
    orderBy: { position: "asc" },
    select: { author: { select: { id: true, name: true } } },
  },
  coverMedia: true,
  id: true,
  title: true,
} satisfies Prisma.BookSelect;

const latestBookSelect = {
  ...compactBookSelect,
  createdAt: true,
  formats: true,
  ownershipStatus: true,
  partNumber: true,
  readingStatus: true,
  series: { select: { deletedAt: true, id: true, name: true, totalBooks: true } },
} satisfies Prisma.BookSelect;

const readingBookSelect = {
  ...compactBookSelect,
  pagesCount: true,
  readingProgress: { select: { currentPage: true } },
  readingStatus: true,
} satisfies Prisma.BookSelect;

const wishlistBookSelect = {
  ...compactBookSelect,
  storeLinks: true,
} satisfies Prisma.BookSelect;

const BookIdRowSchema = z.object({ id: z.string() });

const OverviewSeriesRowSchema = z.object({
  booksCount: z.number(),
  id: z.string(),
  name: z.string(),
  readCount: z.number(),
  status: z.string(),
});

type PublisherScope = {
  publisherId: string;
  userId: string;
};

@Injectable()
export class PublisherOverviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async activeReading({ publisherId, userId }: PublisherScope): Promise<OverviewReadingBookRow[]> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT b.id AS "id"
      FROM books b
      LEFT JOIN book_reading_progress bp ON bp.book_id = b.id
      WHERE ${activePublisherBooks({ publisherId, userId })}
        AND b.reading_status IN (${Prisma.join(PUBLISHER_BOOK_STATUSES.reading)})
      ORDER BY bp.updated_at DESC NULLS LAST, b.created_at DESC, b.id ASC
      LIMIT ${PUBLISHER_OVERVIEW_LIMITS.activeReading}
    `);
    const ids = parseBookIds(rows);
    if (ids.length === 0) {
      return [];
    }
    const books = await this.prisma.book.findMany({
      select: readingBookSelect,
      where: { id: { in: ids }, userId },
    });
    return orderByIds({ ids, rows: books });
  }

  latestBook({ publisherId, userId }: PublisherScope): Promise<Nullable<OverviewLatestBookRow>> {
    return this.prisma.book.findFirst({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: latestBookSelect,
      where: { ...SOFT_DELETE_SCOPE.active, publisherId, userId },
    });
  }

  async series({ publisherId, userId }: PublisherScope): Promise<OverviewSeriesRow[]> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        s.id AS "id",
        s.name AS "name",
        s.status AS "status",
        (count(b.id))::int AS "booksCount",
        (count(b.id) FILTER (
          WHERE b.reading_status IN (${Prisma.join(PUBLISHER_BOOK_STATUSES.read)})
        ))::int AS "readCount"
      FROM books b
      JOIN series s ON s.id = b.series_id
      WHERE ${activePublisherBooks({ publisherId, userId })}
        AND s.deleted_at IS NULL
        AND s.user_id = ${userId}::uuid
      GROUP BY s.id
      ORDER BY "booksCount" DESC, s.name ASC, s.id ASC
      LIMIT ${PUBLISHER_OVERVIEW_LIMITS.series}
    `);
    return z.array(OverviewSeriesRowSchema).parse(rows);
  }

  async wishlist({ publisherId, userId }: PublisherScope): Promise<OverviewWishlistBookRow[]> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT b.id AS "id"
      FROM books b
      WHERE ${activePublisherBooks({ publisherId, userId })}
        AND b.ownership_status = ${PUBLISHER_BOOK_STATUSES.wantToBuy}
      ORDER BY COALESCE(b.wishlist_added_at, b.created_at) DESC, b.created_at DESC, b.id ASC
      LIMIT ${PUBLISHER_OVERVIEW_LIMITS.wishlist}
    `);
    const ids = parseBookIds(rows);
    if (ids.length === 0) {
      return [];
    }
    const books = await this.prisma.book.findMany({
      select: wishlistBookSelect,
      where: { id: { in: ids }, userId },
    });
    return orderByIds({ ids, rows: books });
  }
}

function activePublisherBooks({ publisherId, userId }: PublisherScope): Prisma.Sql {
  return Prisma.sql`b.user_id = ${userId}::uuid
    AND b.deleted_at IS NULL
    AND b.publisher_id = ${publisherId}::uuid`;
}

function orderByIds<T extends { id: string }>({ ids, rows }: { ids: string[]; rows: T[] }): T[] {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = rowById.get(id);
    return row === undefined ? [] : [row];
  });
}

function parseBookIds(rows: unknown): string[] {
  return z
    .array(BookIdRowSchema)
    .parse(rows)
    .map((row) => row.id);
}

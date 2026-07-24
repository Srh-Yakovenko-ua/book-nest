import type { OwnershipStatus, ReadingStatus } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { GenreModel, MediaAssetModel } from "../../../generated/prisma/models.js";
import type { GenreStatsAggregateRow } from "../domain/genre-stats.mapper.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { runInClient } from "../../../core/database/run-in-client.js";
import { visibleToUser } from "../../../core/database/two-tier-visibility.js";
import { Prisma } from "../../../generated/prisma/client.js";

export type GenreCoverRow = {
  coverMedia: MediaAssetModel;
  genres: string[];
};

const READ_STATUS: ReadingStatus = "finished";
const WANT_TO_BUY_STATUS: OwnershipStatus = "want_to_buy";

const GenreStatsAggregateRowSchema = z.object({
  averageRating: z.number().nullable(),
  booksCount: z.number(),
  key: z.string(),
  readCount: z.number(),
  readingQueueCount: z.number(),
  wantToBuyCount: z.number(),
});

const GenreKeyRowSchema = z.object({ key: z.string() });

@Injectable()
export class GenresRepository {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateGenreStats(userId: string): Promise<GenreStatsAggregateRow[]> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        genre_key AS "key",
        count(*)::int AS "booksCount",
        (count(*) FILTER (WHERE book.reading_status = ${READ_STATUS}))::int AS "readCount",
        (count(*) FILTER (WHERE book.queue_position IS NOT NULL))::int AS "readingQueueCount",
        (count(*) FILTER (WHERE book.ownership_status = ${WANT_TO_BUY_STATUS}))::int AS "wantToBuyCount",
        avg(progress.rating) AS "averageRating"
      FROM books book
      CROSS JOIN unnest(book.genres) AS genre_key
      LEFT JOIN book_reading_progress progress ON progress.book_id = book.id
      WHERE book.user_id = ${userId}::uuid
      GROUP BY genre_key
      ORDER BY count(*) DESC, genre_key ASC
    `);
    return z.array(GenreStatsAggregateRowSchema).parse(rows);
  }

  createCustom(
    userId: string,
    data: {
      groupKey: string;
      groupName: string;
      key: string;
      name: string;
      normalizedName: string;
    },
  ): Promise<GenreModel> {
    return this.prisma.genre.create({
      data: { ...data, isDefault: false, sortOrder: 0, userId },
    });
  }

  deleteOwnedWithBookCleanup(
    userId: string,
    id: string,
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const genre = await tx.genre.findFirst({ select: { key: true }, where: { id, userId } });
      if (genre === null) return 0;
      await tx.$executeRaw`UPDATE "books" SET "genres" = array_remove("genres", ${genre.key}) WHERE "user_id" = ${userId}::uuid AND ${genre.key} = ANY("genres")`;
      const deleted = await tx.genre.deleteMany({ where: { id, userId } });
      return deleted.count;
    });
  }

  async existsSelectableName(userId: string, normalizedName: string): Promise<boolean> {
    const found = await this.prisma.genre.findFirst({
      select: { id: true },
      where: { normalizedName, ...visibleToUser(userId) },
    });
    return found !== null;
  }

  async findKeysByName({ query, userId }: { query: string; userId: string }): Promise<string[]> {
    const rows = await this.prisma.genre.findMany({
      select: { key: true },
      where: {
        AND: [
          visibleToUser(userId),
          {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { normalizedName: { contains: query, mode: "insensitive" } },
            ],
          },
        ],
      },
    });
    return [...new Set(rows.map((row) => row.key))];
  }

  findNamesByKeys({
    keys,
    userId,
  }: {
    keys: string[];
    userId: string;
  }): Promise<{ key: string; name: string }[]> {
    if (keys.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.genre.findMany({
      orderBy: { userId: { nulls: "first", sort: "asc" } },
      select: { key: true, name: true },
      where: { key: { in: keys }, ...visibleToUser(userId) },
    });
  }

  async findSelectableKeys(userId: string, keys: string[]): Promise<string[]> {
    const rows = await this.prisma.genre.findMany({
      select: { key: true },
      where: { key: { in: keys }, ...visibleToUser(userId) },
    });
    return rows.map((row) => row.key);
  }

  findVisibleByKeys(userId: string, keys: string[]): Promise<GenreModel[]> {
    if (keys.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.genre.findMany({
      where: { key: { in: keys }, ...visibleToUser(userId) },
    });
  }

  listAvailable(userId: string): Promise<GenreModel[]> {
    return this.prisma.genre.findMany({
      orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      where: visibleToUser(userId),
    });
  }

  async listGenreCovers({
    scanLimit,
    userId,
  }: {
    scanLimit: number;
    userId: string;
  }): Promise<GenreCoverRow[]> {
    const rows = await this.prisma.book.findMany({
      orderBy: { createdAt: "desc" },
      select: { coverMedia: true, genres: true },
      take: scanLimit,
      where: { coverMediaId: { not: null }, genres: { isEmpty: false }, userId },
    });
    return rows.flatMap((row) =>
      row.coverMedia === null ? [] : [{ coverMedia: row.coverMedia, genres: row.genres }],
    );
  }

  async recentGenreKeys({ limit, userId }: { limit: number; userId: string }): Promise<string[]> {
    const rows = await this.prisma.$queryRaw`
      SELECT genre_key AS "key"
      FROM books book, unnest(book.genres) AS genre_key
      WHERE book.user_id = ${userId}::uuid
      GROUP BY genre_key
      ORDER BY max(book.created_at) DESC
      LIMIT ${limit}
    `;
    return z
      .array(GenreKeyRowSchema)
      .parse(rows)
      .map((row) => row.key);
  }
}

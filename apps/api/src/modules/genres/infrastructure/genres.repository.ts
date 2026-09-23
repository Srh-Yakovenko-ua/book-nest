import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { GenreModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

const SYSTEM_GENRE_SCOPE = { userId: null };

const GenreKeyRowSchema = z.object({ key: z.string() });

@Injectable()
export class GenresRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSystemByKeys(keys: string[]): Promise<GenreModel[]> {
    if (keys.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.genre.findMany({
      where: { key: { in: keys }, ...SYSTEM_GENRE_SCOPE },
    });
  }

  async findSystemKeys(keys: string[]): Promise<string[]> {
    const rows = await this.prisma.genre.findMany({
      select: { key: true },
      where: { key: { in: keys }, ...SYSTEM_GENRE_SCOPE },
    });
    return rows.map((row) => row.key);
  }

  async findSystemKeysByName(query: string): Promise<string[]> {
    const rows = await this.prisma.genre.findMany({
      select: { key: true },
      where: {
        ...SYSTEM_GENRE_SCOPE,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { normalizedName: { contains: query, mode: "insensitive" } },
        ],
      },
    });
    return [...new Set(rows.map((row) => row.key))];
  }

  findSystemNamesByKeys(keys: string[]): Promise<{ key: string; name: string }[]> {
    if (keys.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.genre.findMany({
      select: { key: true, name: true },
      where: { key: { in: keys }, ...SYSTEM_GENRE_SCOPE },
    });
  }

  listSystem(): Promise<GenreModel[]> {
    return this.prisma.genre.findMany({
      orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      where: SYSTEM_GENRE_SCOPE,
    });
  }

  async recentGenreKeys({ limit, userId }: { limit: number; userId: string }): Promise<string[]> {
    const rows = await this.prisma.$queryRaw`
      SELECT genre.key AS "key"
      FROM books book
      CROSS JOIN unnest(book.genres) AS book_genre(key)
      JOIN genres genre ON genre.key = book_genre.key AND genre.user_id IS NULL
      WHERE book.user_id = ${userId}::uuid
        AND book.deleted_at IS NULL
      GROUP BY genre.key
      ORDER BY max(book.created_at) DESC, genre.key ASC
      LIMIT ${limit}
    `;
    return z
      .array(GenreKeyRowSchema)
      .parse(rows)
      .map((row) => row.key);
  }
}

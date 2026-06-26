import { Injectable } from "@nestjs/common";

import type { GenreModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

@Injectable()
export class GenresRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  async deleteOwnedWithBookCleanup(userId: string, id: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const genre = await tx.genre.findFirst({ select: { key: true }, where: { id, userId } });
      if (genre === null) return 0;
      await tx.$executeRaw`UPDATE "books" SET "genres" = array_remove("genres", ${genre.key}) WHERE "user_id" = ${userId}::uuid AND ${genre.key} = ANY("genres")`;
      await tx.genre.delete({ where: { id } });
      return 1;
    });
  }

  async existsSelectableName(userId: string, normalizedName: string): Promise<boolean> {
    const found = await this.prisma.genre.findFirst({
      select: { id: true },
      where: { normalizedName, OR: [{ userId: null }, { userId }] },
    });
    return found !== null;
  }

  async findSelectableKeys(userId: string, keys: string[]): Promise<string[]> {
    const rows = await this.prisma.genre.findMany({
      select: { key: true },
      where: { key: { in: keys }, OR: [{ userId: null }, { userId }] },
    });
    return rows.map((row) => row.key);
  }

  listAvailable(userId: string): Promise<GenreModel[]> {
    return this.prisma.genre.findMany({
      orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      where: { OR: [{ userId: null }, { userId }] },
    });
  }
}

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { AuthorModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

type SearchAuthorsInput = {
  query: string | undefined;
  skip: number;
  take: number;
  userId: string;
};

@Injectable()
export class AuthorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countVisible(userId: string, query: string | undefined): Promise<number> {
    return this.prisma.author.count({ where: buildVisibleWhere(userId, query) });
  }

  create(userId: string, name: string, normalizedName: string): Promise<AuthorModel> {
    return this.prisma.author.create({ data: { name, normalizedName, userId } });
  }

  findByNormalized(userId: string, normalizedName: string): Promise<AuthorModel | null> {
    return this.prisma.author.findFirst({
      where: { normalizedName, OR: [{ userId: null }, { userId }] },
    });
  }

  findVisibleById(userId: string, id: string): Promise<AuthorModel | null> {
    return this.prisma.author.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
    });
  }

  searchVisible({ query, skip, take, userId }: SearchAuthorsInput): Promise<AuthorModel[]> {
    return this.prisma.author.findMany({
      orderBy: [{ userId: { nulls: "last", sort: "desc" } }, { name: "asc" }],
      skip,
      take,
      where: buildVisibleWhere(userId, query),
    });
  }
}

function buildVisibleWhere(userId: string, query: string | undefined): Prisma.AuthorWhereInput {
  const nameFilter: Prisma.AuthorWhereInput =
    query === undefined || query.length === 0
      ? {}
      : { name: { contains: query, mode: "insensitive" } };

  return { ...nameFilter, OR: [{ userId: null }, { userId }] };
}

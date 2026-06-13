import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookListModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

export type CreateBookListData = {
  description: null | string;
  name: string;
  normalizedName: string;
};

type SearchListsInput = {
  query: string | undefined;
  skip: number;
  take: number;
  userId: string;
};

@Injectable()
export class ListsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countOwned(userId: string, query: string | undefined): Promise<number> {
    return this.prisma.bookList.count({ where: buildOwnedWhere(userId, query) });
  }

  create(userId: string, data: CreateBookListData): Promise<BookListModel> {
    return this.prisma.bookList.create({ data: { ...data, userId } });
  }

  findByNormalized(userId: string, normalizedName: string): Promise<BookListModel | null> {
    return this.prisma.bookList.findFirst({ where: { normalizedName, userId } });
  }

  findOwnedByIds(userId: string, ids: string[]): Promise<BookListModel[]> {
    return this.prisma.bookList.findMany({ where: { id: { in: ids }, userId } });
  }

  searchOwned({ query, skip, take, userId }: SearchListsInput): Promise<BookListModel[]> {
    return this.prisma.bookList.findMany({
      orderBy: { name: "asc" },
      skip,
      take,
      where: buildOwnedWhere(userId, query),
    });
  }
}

function buildOwnedWhere(userId: string, query: string | undefined): Prisma.BookListWhereInput {
  if (query === undefined || query.length === 0) {
    return { userId };
  }

  return { name: { contains: query, mode: "insensitive" }, userId };
}

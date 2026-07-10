import type { ListSort } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookListModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";

const PREVIEW_COVERS_LIMIT = 4;

export type CreateBookListData = {
  description: null | string;
  name: string;
  normalizedName: string;
};

export type UpdateBookListData = {
  description: null | string;
  name: string;
  normalizedName: string;
};

const listCardArgs = {
  include: {
    _count: { select: { items: true } },
    items: {
      include: { book: { select: { coverMedia: true } } },
      orderBy: { position: "asc" },
      take: PREVIEW_COVERS_LIMIT,
      where: { book: { coverMediaId: { not: null } } },
    },
  },
} satisfies Prisma.BookListDefaultArgs;

export type BookListCard = Prisma.BookListGetPayload<typeof listCardArgs>;

type SearchListCardsInput = {
  query: string | undefined;
  skip: number;
  sort: ListSort;
  take: number;
  userId: string;
};

@Injectable()
export class ListsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countItems(listId: string): Promise<number> {
    return this.prisma.bookListItem.count({ where: { listId } });
  }

  countOwned({ query, userId }: { query: string | undefined; userId: string }): Promise<number> {
    return this.prisma.bookList.count({ where: buildOwnedWhere(userId, query) });
  }

  create(
    { data, userId }: { data: CreateBookListData; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookListCard> {
    return client.bookList.create({ data: { ...data, userId }, ...listCardArgs });
  }

  deleteOwned({ id, userId }: { id: string; userId: string }): Promise<number> {
    return this.prisma.bookList
      .deleteMany({ where: { id, userId } })
      .then((result) => result.count);
  }

  findByNormalized(
    {
      normalizedName,
      userId,
    }: {
      normalizedName: string;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookListModel | null> {
    return client.bookList.findFirst({ where: { normalizedName, userId } });
  }

  findOwnedById({ id, userId }: { id: string; userId: string }): Promise<BookListModel | null> {
    return this.prisma.bookList.findFirst({ where: { id, userId } });
  }

  findOwnedByIds(
    { ids, userId }: { ids: string[]; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookListModel[]> {
    return client.bookList.findMany({ where: { id: { in: ids }, userId } });
  }

  searchOwnedCards({
    query,
    skip,
    sort,
    take,
    userId,
  }: SearchListCardsInput): Promise<BookListCard[]> {
    return this.prisma.bookList.findMany({
      orderBy: LIST_ORDER_BY[sort],
      skip,
      take,
      where: buildOwnedWhere(userId, query),
      ...listCardArgs,
    });
  }

  async updateOwned({
    data,
    id,
    userId,
  }: {
    data: UpdateBookListData;
    id: string;
    userId: string;
  }): Promise<BookListCard> {
    const updated = await this.prisma.bookList.updateMany({ data, where: { id, userId } });
    if (updated.count === 0) {
      throw new NotFoundError("List not found");
    }
    return this.prisma.bookList.findFirstOrThrow({ where: { id, userId }, ...listCardArgs });
  }
}

const NAME_ASC: Prisma.BookListOrderByWithRelationInput = { name: "asc" };

const ID_ASC: Prisma.BookListOrderByWithRelationInput = { id: "asc" };

const LIST_ORDER_BY: Record<ListSort, Prisma.BookListOrderByWithRelationInput[]> = {
  books_count_asc: [{ items: { _count: "asc" } }, NAME_ASC, ID_ASC],
  books_count_desc: [{ items: { _count: "desc" } }, NAME_ASC, ID_ASC],
  created_asc: [{ createdAt: "asc" }, ID_ASC],
  created_desc: [{ createdAt: "desc" }, ID_ASC],
  title_asc: [{ name: "asc" }, ID_ASC],
  title_desc: [{ name: "desc" }, ID_ASC],
  updated_desc: [{ updatedAt: "desc" }, ID_ASC],
};

function buildOwnedWhere(userId: string, query: string | undefined): Prisma.BookListWhereInput {
  if (query === undefined || query.length === 0) {
    return { userId };
  }

  return {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ],
    userId,
  };
}

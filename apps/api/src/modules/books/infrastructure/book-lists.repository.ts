import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

export type BookListWithMembership = Prisma.BookListGetPayload<{
  include: {
    _count: { select: { items: true } };
    items: { select: { bookId: true } };
  };
}>;

type BookOwnershipInput = {
  bookId: string;
  userId: string;
};

type ListsWithMembershipInput = {
  bookId: string;
  userId: string;
};

type OwnedListIdsInput = {
  listIds: string[];
  userId: string;
};

@Injectable()
export class BookListsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async bookBelongsToUser({ bookId, userId }: BookOwnershipInput): Promise<boolean> {
    const book = await this.prisma.book.findFirst({
      select: { id: true },
      where: { id: bookId, userId },
    });
    return book !== null;
  }

  findListsWithMembership({
    bookId,
    userId,
  }: ListsWithMembershipInput): Promise<BookListWithMembership[]> {
    return this.prisma.bookList.findMany({
      include: {
        _count: { select: { items: true } },
        items: { select: { bookId: true }, take: 1, where: { bookId } },
      },
      orderBy: { name: "asc" },
      where: { userId },
    });
  }

  async findOwnedListIds(
    client: Prisma.TransactionClient,
    { listIds, userId }: OwnedListIdsInput,
  ): Promise<string[]> {
    const lists = await client.bookList.findMany({
      select: { id: true },
      where: { id: { in: listIds }, userId },
    });
    return lists.map((list) => list.id);
  }
}

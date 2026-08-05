import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";

export type BookListWithMembership = Prisma.BookListGetPayload<{
  include: {
    _count: { select: { items: true } };
    items: { select: { bookId: true } };
  };
}>;

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

  findListsWithMembership({
    bookId,
    userId,
  }: ListsWithMembershipInput): Promise<BookListWithMembership[]> {
    return this.prisma.bookList.findMany({
      include: {
        _count: { select: { items: { where: { book: SOFT_DELETE_SCOPE.active } } } },
        items: { select: { bookId: true }, take: 1, where: { bookId } },
      },
      orderBy: { name: "asc" },
      where: { ...SOFT_DELETE_SCOPE.active, userId },
    });
  }

  async findOwnedListIds(
    client: Prisma.TransactionClient,
    { listIds, userId }: OwnedListIdsInput,
  ): Promise<string[]> {
    const lists = await client.bookList.findMany({
      select: { id: true },
      where: { ...SOFT_DELETE_SCOPE.active, id: { in: listIds }, userId },
    });
    return lists.map((list) => list.id);
  }
}

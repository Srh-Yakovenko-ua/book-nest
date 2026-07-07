import type { MoveListBookDirection } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { appendBookToList } from "./book-list-membership.js";

export type ListMembership = {
  bookId: string;
  position: number;
};

type FindNeighborInput = {
  direction: MoveListBookDirection;
  listId: string;
  position: number;
};

type ItemsCountInput = {
  listId: string;
};

type ListBookInput = {
  bookId: string;
  listId: string;
};

type ListLockInput = {
  listId: string;
};

type MembershipListIdsInput = {
  bookId: string;
};

type OwnedBookIdsInput = {
  bookIds: string[];
  userId: string;
};

type SetPositionInput = {
  bookId: string;
  listId: string;
  position: number;
};

type ShiftUpAfterInput = {
  listId: string;
  position: number;
};

type TouchListInput = {
  listId: string;
  now: Date;
  userId: string;
};

@Injectable()
export class ListMembershipRepository {
  async acquireListLock(
    client: Prisma.TransactionClient,
    { listId }: ListLockInput,
  ): Promise<void> {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${listId}))`;
  }

  append(client: Prisma.TransactionClient, { bookId, listId }: ListBookInput): Promise<void> {
    return appendBookToList(client, { bookId, listId });
  }

  countItems(client: Prisma.TransactionClient, { listId }: ItemsCountInput): Promise<number> {
    return client.bookListItem.count({ where: { listId } });
  }

  async deleteMembership(
    client: Prisma.TransactionClient,
    { bookId, listId }: ListBookInput,
  ): Promise<void> {
    await client.bookListItem.delete({ where: { listId_bookId: { bookId, listId } } });
  }

  async findMembership(
    client: Prisma.TransactionClient,
    { bookId, listId }: ListBookInput,
  ): Promise<ListMembership | null> {
    const membership = await client.bookListItem.findUnique({
      select: { bookId: true, position: true },
      where: { listId_bookId: { bookId, listId } },
    });
    return membership;
  }

  async findMembershipListIds(
    client: Prisma.TransactionClient,
    { bookId }: MembershipListIdsInput,
  ): Promise<string[]> {
    const items = await client.bookListItem.findMany({
      select: { listId: true },
      where: { bookId },
    });
    return items.map((item) => item.listId);
  }

  findNeighbor(
    client: Prisma.TransactionClient,
    { direction, listId, position }: FindNeighborInput,
  ): Promise<ListMembership | null> {
    const where =
      direction === "up"
        ? { listId, position: { lt: position } }
        : { listId, position: { gt: position } };
    return client.bookListItem.findFirst({
      orderBy: { position: direction === "up" ? "desc" : "asc" },
      select: { bookId: true, position: true },
      where,
    });
  }

  async findOwnedBookIds(
    client: Prisma.TransactionClient,
    { bookIds, userId }: OwnedBookIdsInput,
  ): Promise<string[]> {
    const owned = await client.book.findMany({
      select: { id: true },
      where: { id: { in: bookIds }, userId },
    });
    return owned.map((book) => book.id);
  }

  async setPosition(
    client: Prisma.TransactionClient,
    { bookId, listId, position }: SetPositionInput,
  ): Promise<void> {
    await client.bookListItem.update({
      data: { position },
      where: { listId_bookId: { bookId, listId } },
    });
  }

  async shiftUpAfter(
    client: Prisma.TransactionClient,
    { listId, position }: ShiftUpAfterInput,
  ): Promise<void> {
    await client.bookListItem.updateMany({
      data: { position: { decrement: 1 } },
      where: { listId, position: { gt: position } },
    });
  }

  async touchList(
    client: Prisma.TransactionClient,
    { listId, now, userId }: TouchListInput,
  ): Promise<void> {
    await client.bookList.updateMany({ data: { updatedAt: now }, where: { id: listId, userId } });
  }
}

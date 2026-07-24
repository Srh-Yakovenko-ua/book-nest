import type { MoveListBookDirection, Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { appendBookToList } from "./book-list-membership.js";

export type ListMembership = {
  bookId: string;
  position: number;
};

type AppendManyInput = {
  bookIds: string[];
  listId: string;
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
    await acquireAdvisoryLock({ classId: ADVISORY_LOCK_CLASS.listMembership, key: listId }, client);
  }

  append(client: Prisma.TransactionClient, { bookId, listId }: ListBookInput): Promise<void> {
    return appendBookToList(client, { bookId, listId });
  }

  async appendMany(
    client: Prisma.TransactionClient,
    { bookIds, listId }: AppendManyInput,
  ): Promise<number> {
    if (bookIds.length === 0) {
      return 0;
    }

    const existing = await client.bookListItem.findMany({
      select: { bookId: true },
      where: { bookId: { in: bookIds }, listId },
    });
    const existingIds = new Set(existing.map((item) => item.bookId));
    const toAppend = bookIds.filter((bookId) => !existingIds.has(bookId));
    if (toAppend.length === 0) {
      return 0;
    }

    const aggregate = await client.bookListItem.aggregate({
      _max: { position: true },
      where: { listId },
    });
    const basePosition = aggregate._max.position ?? 0;

    await client.bookListItem.createMany({
      data: toAppend.map((bookId, index) => ({
        bookId,
        listId,
        position: basePosition + index + 1,
      })),
    });

    return toAppend.length;
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
  ): Promise<Nullable<ListMembership>> {
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
  ): Promise<Nullable<ListMembership>> {
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

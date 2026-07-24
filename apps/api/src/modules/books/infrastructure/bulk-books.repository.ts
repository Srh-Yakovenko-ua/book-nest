import type { Nullable, OwnershipStatus, QueuePriority, ReadingStatus } from "@app/shared";

import { DELIVERY_ACTIVE_STATUSES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { acquireUserQueueLock } from "../../../core/database/queue-lock.js";
import { runInClient } from "../../../core/database/run-in-client.js";
import { ListMembershipRepository } from "./list-membership.repository.js";
import { enforceQueueInvariant } from "./queue-invariant.js";

export type BulkDeleteResult = {
  affected: number;
  coverMediaIds: string[];
};

export type PagesCountSnapshot = {
  currentPage: Nullable<number>;
  id: string;
  updatedAt: Date;
};

@Injectable()
export class BulkBooksRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepository: ListMembershipRepository,
  ) {}

  addTags(
    {
      bookIds,
      tagIds,
      userId,
    }: {
      bookIds: string[];
      tagIds: string[];
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const ownedBooks = await tx.book.findMany({
        select: { id: true },
        where: { id: { in: bookIds }, userId },
      });
      if (ownedBooks.length === 0) {
        return 0;
      }
      await tx.bookTag.createMany({
        data: ownedBooks.flatMap((book) => tagIds.map((tagId) => ({ bookId: book.id, tagId }))),
        skipDuplicates: true,
      });
      return ownedBooks.length;
    });
  }

  addToLists(
    {
      bookIds,
      listIds,
      now,
      userId,
    }: {
      bookIds: string[];
      listIds: string[];
      now: Date;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const ownedBooks = await tx.book.findMany({
        select: { id: true },
        where: { id: { in: bookIds }, userId },
      });
      if (ownedBooks.length === 0) {
        return 0;
      }

      const ownedIds = new Set(ownedBooks.map((book) => book.id));
      const orderedOwnedIds = [...new Set(bookIds)].filter((bookId) => ownedIds.has(bookId));

      const sortedListIds = [...new Set(listIds)].sort();
      for (const listId of sortedListIds) {
        await this.membershipRepository.acquireListLock(tx, { listId });
      }
      for (const listId of sortedListIds) {
        const added = await this.membershipRepository.appendMany(tx, {
          bookIds: orderedOwnedIds,
          listId,
        });
        if (added > 0) {
          await this.membershipRepository.touchList(tx, { listId, now, userId });
        }
      }

      return ownedBooks.length;
    });
  }

  addToReadingQueue(
    {
      bookIds,
      queuePriority,
      userId,
    }: {
      bookIds: string[];
      queuePriority: QueuePriority;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      await acquireUserQueueLock(userId, tx);

      const ownedUnqueued = await tx.book.findMany({
        select: { id: true },
        where: { id: { in: bookIds }, queuePosition: null, userId },
      });
      if (ownedUnqueued.length === 0) {
        return 0;
      }

      const inputOrder = new Map(bookIds.map((bookId, index) => [bookId, index]));
      const ordered = [...ownedUnqueued].sort(
        (left, right) => (inputOrder.get(left.id) ?? 0) - (inputOrder.get(right.id) ?? 0),
      );

      const aggregate = await tx.book.aggregate({
        _max: { queuePosition: true },
        where: { userId },
      });
      const basePosition = aggregate._max.queuePosition ?? 0;

      let offset = 0;
      for (const book of ordered) {
        offset += 1;
        await tx.book.updateMany({
          data: { queuePosition: basePosition + offset, queuePriority },
          where: { id: book.id, userId },
        });
      }

      return ordered.length;
    });
  }

  deleteOwned(
    {
      bookIds,
      userId,
    }: {
      bookIds: string[];
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<BulkDeleteResult> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const books = await tx.book.findMany({
        select: { coverMediaId: true },
        where: { id: { in: bookIds }, userId },
      });
      if (books.length === 0) {
        return { affected: 0, coverMediaIds: [] };
      }
      const deleted = await tx.book.deleteMany({ where: { id: { in: bookIds }, userId } });
      const coverMediaIds = [
        ...new Set(
          books.flatMap((book) => (book.coverMediaId === null ? [] : [book.coverMediaId])),
        ),
      ];
      return { affected: deleted.count, coverMediaIds };
    });
  }

  async findOwnedIds({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<string[]> {
    const ownedBooks = await this.prisma.book.findMany({
      select: { id: true },
      where: { id: { in: bookIds }, userId },
    });
    const ownedIds = new Set(ownedBooks.map((book) => book.id));
    return [...new Set(bookIds)].filter((id) => ownedIds.has(id));
  }

  async findPagesCountSnapshots(
    {
      bookIds,
      userId,
    }: {
      bookIds: string[];
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<PagesCountSnapshot[]> {
    const books = await client.book.findMany({
      select: { id: true, readingProgress: { select: { currentPage: true } }, updatedAt: true },
      where: { id: { in: bookIds }, userId },
    });
    return books.map((book) => ({
      currentPage: book.readingProgress?.currentPage ?? null,
      id: book.id,
      updatedAt: book.updatedAt,
    }));
  }

  async markPagesCountUnavailable(
    {
      bookId,
      expectedUpdatedAt,
      userId,
    }: {
      bookId: string;
      expectedUpdatedAt: Date;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const updated = await client.book.updateMany({
      data: { pagesCountUnavailable: true },
      where: { id: bookId, updatedAt: expectedUpdatedAt, userId },
    });
    return updated.count;
  }

  async setFavorite({
    bookIds,
    isFavorite,
    now,
    userId,
  }: {
    bookIds: string[];
    isFavorite: boolean;
    now: Date;
    userId: string;
  }): Promise<number> {
    const updated = await this.prisma.book.updateMany({
      data: { favoriteAddedAt: isFavorite ? now : null, isFavorite },
      where: { id: { in: bookIds }, isFavorite: !isFavorite, userId },
    });
    return updated.count;
  }

  setOwnershipStatus(
    {
      bookIds,
      clearDelivery,
      clearLoan,
      clearPurchase,
      now,
      ownershipStatus,
      userId,
    }: {
      bookIds: string[];
      clearDelivery: boolean;
      clearLoan: boolean;
      clearPurchase: boolean;
      now: Date;
      ownershipStatus: OwnershipStatus;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const updated = await tx.book.updateMany({
        data: { ownershipStatus },
        where: { id: { in: bookIds }, userId },
      });
      if (updated.count === 0) {
        return 0;
      }
      if (clearDelivery) {
        await tx.bookDelivery.updateMany({
          data: { cancelledAt: now, status: "cancelled" },
          where: {
            bookId: { in: bookIds },
            status: { in: [...DELIVERY_ACTIVE_STATUSES] },
            userId,
          },
        });
      }
      if (clearLoan) {
        await tx.bookLoan.updateMany({
          data: { returnedAt: now, status: "returned" },
          where: { bookId: { in: bookIds }, status: "active", userId },
        });
      }
      if (clearPurchase) {
        await tx.bookPurchaseInfo.deleteMany({
          where: { book: { id: { in: bookIds }, userId } },
        });
      }
      return updated.count;
    });
  }

  async setPagesCount(
    {
      bookId,
      expectedUpdatedAt,
      pagesCount,
      userId,
    }: {
      bookId: string;
      expectedUpdatedAt: Date;
      pagesCount: number;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const updated = await client.book.updateMany({
      data: { pagesCount, pagesCountUnavailable: false },
      where: { id: bookId, updatedAt: expectedUpdatedAt, userId },
    });
    return updated.count;
  }

  setReadingStatus(
    {
      bookIds,
      clearProgress,
      readingStatus,
      userId,
    }: {
      bookIds: string[];
      clearProgress: boolean;
      readingStatus: ReadingStatus;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const updated = await tx.book.updateMany({
        data: { readingStatus },
        where: { id: { in: bookIds }, userId },
      });
      if (clearProgress && updated.count > 0) {
        await tx.bookReadingProgress.deleteMany({
          where: { book: { id: { in: bookIds }, userId } },
        });
      }

      await enforceQueueInvariant(tx, { readingStatus, userId });

      return updated.count;
    });
  }
}

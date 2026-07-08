import type { OwnershipStatus, QueuePriority, ReadingStatus } from "@app/shared";

import { DELIVERY_ACTIVE_STATUSES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { ListMembershipRepository } from "./list-membership.repository.js";

export type BulkDeleteResult = {
  affected: number;
  coverMediaIds: string[];
};

@Injectable()
export class BulkBooksRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepository: ListMembershipRepository,
  ) {}

  addTags({
    bookIds,
    tagIds,
    userId,
  }: {
    bookIds: string[];
    tagIds: string[];
    userId: string;
  }): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
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

  addToLists({
    bookIds,
    listIds,
    userId,
  }: {
    bookIds: string[];
    listIds: string[];
    userId: string;
  }): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const ownedBooks = await tx.book.findMany({
        select: { id: true },
        where: { id: { in: bookIds }, userId },
      });
      if (ownedBooks.length === 0) {
        return 0;
      }

      const ownedIds = new Set(ownedBooks.map((book) => book.id));
      const orderedOwnedIds = [...new Set(bookIds)].filter((bookId) => ownedIds.has(bookId));

      const now = new Date();
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

  addToReadingQueue({
    bookIds,
    queuePriority,
    userId,
  }: {
    bookIds: string[];
    queuePriority: QueuePriority;
    userId: string;
  }): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
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

  deleteOwned({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<BulkDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
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
    return ownedBooks.map((book) => book.id);
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

  setOwnershipStatus({
    bookIds,
    clearDelivery,
    clearLoan,
    clearPurchase,
    ownershipStatus,
    userId,
  }: {
    bookIds: string[];
    clearDelivery: boolean;
    clearLoan: boolean;
    clearPurchase: boolean;
    ownershipStatus: OwnershipStatus;
    userId: string;
  }): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.book.updateMany({
        data: { ownershipStatus },
        where: { id: { in: bookIds }, userId },
      });
      if (updated.count === 0) {
        return 0;
      }
      if (clearDelivery) {
        await tx.bookDelivery.updateMany({
          data: { cancelledAt: new Date(), status: "cancelled" },
          where: {
            book: { id: { in: bookIds }, userId },
            status: { in: [...DELIVERY_ACTIVE_STATUSES] },
          },
        });
      }
      if (clearLoan) {
        await tx.bookLoan.updateMany({
          data: { returnedAt: new Date(), status: "returned" },
          where: { book: { id: { in: bookIds }, userId }, status: "active" },
        });
      }
      if (clearPurchase) {
        await tx.bookPurchaseInfo.deleteMany({ where: { book: { id: { in: bookIds }, userId } } });
      }
      return updated.count;
    });
  }

  setReadingStatus({
    bookIds,
    clearProgress,
    readingStatus,
    userId,
  }: {
    bookIds: string[];
    clearProgress: boolean;
    readingStatus: ReadingStatus;
    userId: string;
  }): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.book.updateMany({
        data: { readingStatus },
        where: { id: { in: bookIds }, userId },
      });
      if (clearProgress && updated.count > 0) {
        await tx.bookReadingProgress.deleteMany({
          where: { book: { id: { in: bookIds }, userId } },
        });
      }
      return updated.count;
    });
  }
}

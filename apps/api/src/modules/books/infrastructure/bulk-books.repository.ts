import type { Nullable, OwnershipStatus, QueuePriority, ReadingStatus } from "@app/shared";

import { DELIVERY_ACTIVE_STATUSES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { ListMembershipRepository } from "./list-membership.repository.js";

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

  async addTags(
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
    if (client === undefined) {
      return this.prisma.$transaction((tx) => this.addTags({ bookIds, tagIds, userId }, tx));
    }

    const ownedBooks = await client.book.findMany({
      select: { id: true },
      where: { id: { in: bookIds }, userId },
    });
    if (ownedBooks.length === 0) {
      return 0;
    }
    await client.bookTag.createMany({
      data: ownedBooks.flatMap((book) => tagIds.map((tagId) => ({ bookId: book.id, tagId }))),
      skipDuplicates: true,
    });
    return ownedBooks.length;
  }

  async addToLists(
    {
      bookIds,
      listIds,
      userId,
    }: {
      bookIds: string[];
      listIds: string[];
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    if (client === undefined) {
      return this.prisma.$transaction((tx) => this.addToLists({ bookIds, listIds, userId }, tx));
    }

    const ownedBooks = await client.book.findMany({
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
      await this.membershipRepository.acquireListLock(client, { listId });
    }
    for (const listId of sortedListIds) {
      const added = await this.membershipRepository.appendMany(client, {
        bookIds: orderedOwnedIds,
        listId,
      });
      if (added > 0) {
        await this.membershipRepository.touchList(client, { listId, now, userId });
      }
    }

    return ownedBooks.length;
  }

  async addToReadingQueue(
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
    if (client === undefined) {
      return this.prisma.$transaction((tx) =>
        this.addToReadingQueue({ bookIds, queuePriority, userId }, tx),
      );
    }

    const ownedUnqueued = await client.book.findMany({
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

    const aggregate = await client.book.aggregate({
      _max: { queuePosition: true },
      where: { userId },
    });
    const basePosition = aggregate._max.queuePosition ?? 0;

    let offset = 0;
    for (const book of ordered) {
      offset += 1;
      await client.book.updateMany({
        data: { queuePosition: basePosition + offset, queuePriority },
        where: { id: book.id, userId },
      });
    }

    return ordered.length;
  }

  async deleteOwned(
    {
      bookIds,
      userId,
    }: {
      bookIds: string[];
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<BulkDeleteResult> {
    if (client === undefined) {
      return this.prisma.$transaction((tx) => this.deleteOwned({ bookIds, userId }, tx));
    }

    const books = await client.book.findMany({
      select: { coverMediaId: true },
      where: { id: { in: bookIds }, userId },
    });
    if (books.length === 0) {
      return { affected: 0, coverMediaIds: [] };
    }
    const deleted = await client.book.deleteMany({ where: { id: { in: bookIds }, userId } });
    const coverMediaIds = [
      ...new Set(books.flatMap((book) => (book.coverMediaId === null ? [] : [book.coverMediaId]))),
    ];
    return { affected: deleted.count, coverMediaIds };
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
      userId,
    }: {
      bookId: string;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.book.updateMany({
      data: { pagesCountUnavailable: true },
      where: { id: bookId, userId },
    });
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

  async setOwnershipStatus(
    {
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
    },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    if (client === undefined) {
      return this.prisma.$transaction((tx) =>
        this.setOwnershipStatus(
          { bookIds, clearDelivery, clearLoan, clearPurchase, ownershipStatus, userId },
          tx,
        ),
      );
    }

    const updated = await client.book.updateMany({
      data: { ownershipStatus },
      where: { id: { in: bookIds }, userId },
    });
    if (updated.count === 0) {
      return 0;
    }
    if (clearDelivery) {
      await client.bookDelivery.updateMany({
        data: { cancelledAt: new Date(), status: "cancelled" },
        where: {
          book: { id: { in: bookIds }, userId },
          status: { in: [...DELIVERY_ACTIVE_STATUSES] },
        },
      });
    }
    if (clearLoan) {
      await client.bookLoan.updateMany({
        data: { returnedAt: new Date(), status: "returned" },
        where: { book: { id: { in: bookIds }, userId }, status: "active" },
      });
    }
    if (clearPurchase) {
      await client.bookPurchaseInfo.deleteMany({
        where: { book: { id: { in: bookIds }, userId } },
      });
    }
    return updated.count;
  }

  async setPagesCount(
    {
      bookId,
      pagesCount,
      userId,
    }: {
      bookId: string;
      pagesCount: number;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.book.updateMany({
      data: { pagesCount, pagesCountUnavailable: false },
      where: { id: bookId, userId },
    });
  }

  async setReadingStatus(
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
    if (client === undefined) {
      return this.prisma.$transaction((tx) =>
        this.setReadingStatus({ bookIds, clearProgress, readingStatus, userId }, tx),
      );
    }

    const updated = await client.book.updateMany({
      data: { readingStatus },
      where: { id: { in: bookIds }, userId },
    });
    if (clearProgress && updated.count > 0) {
      await client.bookReadingProgress.deleteMany({
        where: { book: { id: { in: bookIds }, userId } },
      });
    }
    return updated.count;
  }
}

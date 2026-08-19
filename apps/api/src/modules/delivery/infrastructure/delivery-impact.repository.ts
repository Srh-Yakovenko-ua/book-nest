import type { Nullable } from "@app/shared";

import { OwnershipStatusSchema, QueuePrioritySchema, ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type {
  ImpactGoalRow,
  ImpactQueueRow,
  ImpactSeriesBook,
  ImpactSeriesRow,
} from "../domain/in-transit-impact.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";

type ArrivingItemsFilter = { orderItems: Prisma.BookOrderItemListRelationFilter };

type SeriesBookRow = {
  createdAt: Date;
  orderItems: { id: string }[];
  ownershipStatus: string;
  partNumber: Nullable<number>;
  readingStatus: string;
};

@Injectable()
export class DeliveryImpactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listGoalRows({ today, userId }: { today: Date; userId: string }): Promise<ImpactGoalRow[]> {
    const rows = await this.prisma.readingGoalBook.findMany({
      orderBy: [{ goalId: "asc" }, { bookId: "asc" }],
      select: {
        bookId: true,
        goal: {
          select: {
            _count: { select: { books: { where: { qualifiedFinishedAt: { not: null } } } } },
            targetCount: true,
          },
        },
        goalId: true,
      },
      where: {
        book: { ...arrivingBooksScope(userId), ...SOFT_DELETE_SCOPE.active, userId },
        goal: { archivedAt: null, deadline: { gte: today }, userId },
      },
    });

    return rows.flatMap((row) =>
      row.goal._count.books >= row.goal.targetCount
        ? []
        : [{ bookId: row.bookId, goalId: row.goalId }],
    );
  }

  async listQueueRows(userId: string): Promise<ImpactQueueRow[]> {
    const rows = await this.prisma.book.findMany({
      orderBy: { queuePosition: "asc" },
      select: {
        id: true,
        partNumber: true,
        queuePriority: true,
        series: {
          select: {
            books: {
              select: { partNumber: true, readingStatus: true },
              where: { ...SOFT_DELETE_SCOPE.active, userId },
            },
          },
        },
      },
      where: {
        ...arrivingBooksScope(userId),
        ...SOFT_DELETE_SCOPE.active,
        queuePosition: { not: null },
        userId,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      partNumber: row.partNumber,
      queuePriority:
        row.queuePriority === null ? null : QueuePrioritySchema.parse(row.queuePriority),
      seriesBooks: (row.series?.books ?? []).map((book) => ({
        partNumber: book.partNumber,
        readingStatus: ReadingStatusSchema.parse(book.readingStatus),
      })),
    }));
  }

  async listSeriesRows(userId: string): Promise<ImpactSeriesRow[]> {
    const rows = await this.prisma.series.findMany({
      orderBy: { id: "asc" },
      select: {
        books: {
          select: {
            createdAt: true,
            orderItems: { select: { id: true }, take: 1, where: activeOrderItems(userId) },
            ownershipStatus: true,
            partNumber: true,
            readingStatus: true,
          },
          where: { ...SOFT_DELETE_SCOPE.active, userId },
        },
        id: true,
        totalBooks: true,
      },
      where: {
        ...SOFT_DELETE_SCOPE.active,
        books: { some: { ...arrivingBooksScope(userId), ...SOFT_DELETE_SCOPE.active, userId } },
        userId,
      },
    });

    return rows.map((row) => ({
      books: row.books.map((book) => toImpactSeriesBook(book)),
      id: row.id,
      totalBooks: row.totalBooks,
    }));
  }
}

function activeOrderItems(userId: string): Prisma.BookOrderItemWhereInput {
  return { cancelledAt: null, order: { userId }, receivedAt: null };
}

function arrivingBooksScope(userId: string): ArrivingItemsFilter {
  return { orderItems: { some: activeOrderItems(userId) } };
}

function toImpactSeriesBook(book: SeriesBookRow): ImpactSeriesBook {
  return {
    createdAt: book.createdAt,
    isArriving: book.orderItems.length > 0,
    ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
    partNumber: book.partNumber,
    readingStatus: ReadingStatusSchema.parse(book.readingStatus),
  };
}

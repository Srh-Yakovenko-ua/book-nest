import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { type BookWithRelations, withRelations } from "../../books/index.js";

const summaryRowSelect = {
  id: true,
  ownershipStatus: true,
  partNumber: true,
  series: { select: { books: { select: { partNumber: true, readingStatus: true } } } },
  seriesId: true,
} satisfies Prisma.BookSelect;

export type ReadingQueueSummaryRow = Prisma.BookGetPayload<{ select: typeof summaryRowSelect }>;

@Injectable()
export class ReadingQueueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireUserQueueLock(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
  }

  async clearPosition(
    userId: string,
    bookId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.book.updateMany({
      data: {
        queuePosition: null,
        queuePriority: null,
        queuePriorityReason: null,
        queuePriorityReasonCustomText: null,
        queuePriorityTargetDate: null,
      },
      where: { id: bookId, userId },
    });
  }

  count(userId: string, client: Prisma.TransactionClient = this.prisma): Promise<number> {
    return client.book.count({ where: { queuePosition: { not: null }, userId } });
  }

  async findQueuedBookIds(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string[]> {
    const rows = await client.book.findMany({
      select: { id: true },
      where: { queuePosition: { not: null }, userId },
    });
    return rows.map((row) => row.id);
  }

  async findQueuePosition(
    userId: string,
    bookId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<number>> {
    const book = await client.book.findFirst({
      select: { queuePosition: true },
      where: { id: bookId, userId },
    });
    return book?.queuePosition ?? null;
  }

  listQueue(userId: string): Promise<BookWithRelations[]> {
    return this.prisma.book.findMany({
      include: withRelations,
      orderBy: { queuePosition: "asc" },
      where: { queuePosition: { not: null }, userId },
    });
  }

  loadSummaryRows(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingQueueSummaryRow[]> {
    return client.book.findMany({
      select: summaryRowSelect,
      where: { queuePosition: { not: null }, userId },
    });
  }

  async setPosition(
    userId: string,
    bookId: string,
    position: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.book.updateMany({
      data: { queuePosition: position },
      where: { id: bookId, userId },
    });
  }

  async shiftDownFrom(
    userId: string,
    fromPosition: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.book.updateMany({
      data: { queuePosition: { increment: 1 } },
      where: { queuePosition: { gte: fromPosition }, userId },
    });
  }

  async shiftUpAfter(
    userId: string,
    position: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.book.updateMany({
      data: { queuePosition: { decrement: 1 } },
      where: { queuePosition: { gt: position }, userId },
    });
  }
}

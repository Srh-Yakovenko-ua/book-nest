import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { acquireUserQueueLock } from "../../../core/database/queue-lock.js";
import { type BookWithRelations, withRelations } from "../../books/index.js";

const summaryRowSelect = {
  id: true,
  ownershipStatus: true,
  partNumber: true,
  series: { select: { books: { select: { partNumber: true, readingStatus: true } } } },
  seriesId: true,
} satisfies Prisma.BookSelect;

export type ReadingQueueSummaryRow = Prisma.BookGetPayload<{ select: typeof summaryRowSelect }>;

const volumeRowSelect = {
  formats: true,
  id: true,
  pagesCount: true,
  pagesCountUnavailable: true,
  readingProgress: { select: { currentPage: true } },
  readingStatus: true,
} satisfies Prisma.BookSelect;

export type ReadingQueueVolumeRow = Prisma.BookGetPayload<{ select: typeof volumeRowSelect }>;

const PaceAggregateRowSchema = z.object({
  activeDaysInPeriod: z.number().int().nonnegative(),
  firstEventDate: z.date().nullable(),
  lastEventDate: z.date().nullable(),
  pagesReadInPeriod: z.number().int().nonnegative(),
});

export type ReadingQueuePaceRow = z.infer<typeof PaceAggregateRowSchema>;

@Injectable()
export class ReadingQueueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireUserQueueLock(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await acquireUserQueueLock(client, userId);
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

  async loadPaceAggregate(
    userId: string,
    since: Date,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingQueuePaceRow> {
    const rows = await client.$queryRaw`
      SELECT
        COALESCE(SUM(e.pages_read) FILTER (WHERE e.date >= ${since}), 0)::int AS "pagesReadInPeriod",
        COUNT(DISTINCT e.date) FILTER (WHERE e.date >= ${since})::int         AS "activeDaysInPeriod",
        MIN(e.date)                                                           AS "firstEventDate",
        MAX(e.date)                                                           AS "lastEventDate"
      FROM book_reading_progress_events e
      JOIN books b ON b.id = e.book_id
      WHERE b.user_id = ${userId}::uuid
    `;
    const [row] = z.array(PaceAggregateRowSchema).parse(rows);
    return (
      row ?? {
        activeDaysInPeriod: 0,
        firstEventDate: null,
        lastEventDate: null,
        pagesReadInPeriod: 0,
      }
    );
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

  loadVolumeRows(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingQueueVolumeRow[]> {
    return client.book.findMany({
      select: volumeRowSelect,
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

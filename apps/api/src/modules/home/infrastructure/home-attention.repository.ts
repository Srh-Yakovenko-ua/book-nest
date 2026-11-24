import type { ReadingStatus } from "@app/shared";

import { LoanStatusSchema, LoanTypeSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";

const QUEUE_DEADLINE_EXCLUDED_STATUSES: ReadingStatus[] = ["finished", "reading", "rereading"];

const queueDeadlineSelect = {
  id: true,
  queuePriorityReason: true,
  queuePriorityTargetDate: true,
  title: true,
} satisfies Prisma.BookSelect;

export type QueueDeadlineRow = Prisma.BookGetPayload<{ select: typeof queueDeadlineSelect }>;

@Injectable()
export class HomeAttentionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBorrowedLoanDueBookIds({
    bookIds,
    dueBy,
    userId,
  }: {
    bookIds: string[];
    dueBy: Date;
    userId: string;
  }): Promise<string[]> {
    if (bookIds.length === 0) {
      return [];
    }
    const loans = await this.prisma.bookLoan.findMany({
      select: { bookId: true },
      where: {
        bookId: { in: bookIds },
        expectedReturnDate: { lte: dueBy },
        status: LoanStatusSchema.enum.active,
        type: LoanTypeSchema.enum.borrowed_from_someone,
        userId,
      },
    });
    return loans.map((loan) => loan.bookId);
  }

  findQueueDeadlines({
    from,
    to,
    userId,
  }: {
    from: Date;
    to: Date;
    userId: string;
  }): Promise<QueueDeadlineRow[]> {
    return this.prisma.book.findMany({
      orderBy: [{ queuePriorityTargetDate: "asc" }, { id: "asc" }],
      select: queueDeadlineSelect,
      where: {
        ...SOFT_DELETE_SCOPE.active,
        queuePosition: { not: null },
        queuePriorityTargetDate: { gte: from, lte: to },
        readingStatus: { notIn: QUEUE_DEADLINE_EXCLUDED_STATUSES },
        userId,
      },
    });
  }
}

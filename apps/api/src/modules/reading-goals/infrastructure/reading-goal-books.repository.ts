import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingGoalBookModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

const SnapshotEntryRowSchema = z.object({
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  deadline: z.date(),
  goalId: z.uuid(),
  qualifiedFinishedAt: z.date().nullable(),
  targetCount: z.number().int(),
});

export type ReadingGoalSnapshotBookInput = {
  bookId: string;
  position: number;
  qualifiedFinishedAt: Nullable<Date>;
};

const snapshotBookArgs = {
  include: {
    book: {
      select: {
        authors: {
          orderBy: { position: "asc" },
          select: { author: { select: { id: true, name: true } } },
        },
        coverMedia: true,
        ownershipStatus: true,
        pagesCount: true,
        readingProgress: { select: { currentPage: true, finishedAt: true, startedAt: true } },
        readingStatus: true,
        title: true,
      },
    },
  },
} satisfies Prisma.ReadingGoalBookDefaultArgs;

export type ReadingGoalSnapshotBookRow = Prisma.ReadingGoalBookGetPayload<typeof snapshotBookArgs>;

const SnapshotEntryWithProgressRowSchema = SnapshotEntryRowSchema.extend({
  bookId: z.uuid(),
  finishedAt: z.date().nullable(),
});

export type ReadingGoalSnapshotEntryRow = z.infer<typeof SnapshotEntryRowSchema>;

export type ReadingGoalSnapshotEntryWithProgressRow = z.infer<
  typeof SnapshotEntryWithProgressRowSchema
>;

export type ReadingGoalSnapshotProgressRow = {
  bookId: string;
  finishedAt: Nullable<Date>;
  qualifiedFinishedAt: Nullable<Date>;
};

export type ReadingGoalSnapshotQualificationRow = {
  bookId: string;
  goalId: string;
  qualifiedFinishedAt: Nullable<Date>;
};

type UpdateQualifiedFinishedAtInput = {
  bookId: string;
  goalId: string;
  previousQualifiedFinishedAt: Nullable<Date>;
  qualifiedFinishedAt: Nullable<Date>;
};

@Injectable()
export class ReadingGoalBooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  countByGoal(
    { goalId }: { goalId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.readingGoalBook.count({ where: { goalId } });
  }

  createMany(
    { goalId, rows }: { goalId: string; rows: ReadingGoalSnapshotBookInput[] },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.readingGoalBook
      .createMany({ data: rows.map((row) => ({ ...row, goalId })) })
      .then((result) => result.count);
  }

  findByGoal(
    { goalId }: { goalId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingGoalBookModel[]> {
    return client.readingGoalBook.findMany({
      orderBy: [{ qualifiedFinishedAt: { nulls: "last", sort: "asc" } }, { bookId: "asc" }],
      where: { goalId },
    });
  }

  async findSnapshotBookIdsForBook(
    { bookId, userId }: { bookId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingGoalSnapshotEntryRow[]> {
    const rows = await client.$queryRaw`
      SELECT
        goal_book.goal_id AS "goalId",
        goal_book.qualified_finished_at AS "qualifiedFinishedAt",
        goal.archived_at AS "archivedAt",
        goal.created_at AS "createdAt",
        goal.deadline AS "deadline",
        goal.target_count AS "targetCount"
      FROM reading_goal_books goal_book
      JOIN reading_goals goal ON goal.id = goal_book.goal_id
      WHERE goal_book.book_id = ${bookId}::uuid
        AND goal.user_id = ${userId}::uuid
      ORDER BY goal.created_at, goal.id
    `;
    return z.array(SnapshotEntryRowSchema).parse(rows);
  }

  findSnapshotBooks(
    { goalId }: { goalId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingGoalSnapshotBookRow[]> {
    return client.readingGoalBook.findMany({
      orderBy: [{ position: "asc" }, { bookId: "asc" }],
      where: { goalId },
      ...snapshotBookArgs,
    });
  }

  async findSnapshotEntriesForBooks(
    { bookIds, userId }: { bookIds: string[]; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingGoalSnapshotEntryWithProgressRow[]> {
    const rows = await client.$queryRaw`
      SELECT
        goal_book.book_id AS "bookId",
        goal_book.goal_id AS "goalId",
        goal_book.qualified_finished_at AS "qualifiedFinishedAt",
        goal.archived_at AS "archivedAt",
        goal.created_at AS "createdAt",
        goal.deadline AS "deadline",
        goal.target_count AS "targetCount",
        CASE WHEN book.deleted_at IS NULL THEN progress.finished_at END AS "finishedAt"
      FROM reading_goal_books goal_book
      JOIN reading_goals goal ON goal.id = goal_book.goal_id
      JOIN books book ON book.id = goal_book.book_id
      LEFT JOIN book_reading_progress progress ON progress.book_id = goal_book.book_id
      WHERE goal_book.book_id = ANY(${bookIds}::uuid[])
        AND goal.user_id = ${userId}::uuid
        AND goal.archived_at IS NULL
      ORDER BY goal.created_at, goal.id, goal_book.book_id
    `;
    return z.array(SnapshotEntryWithProgressRowSchema).parse(rows);
  }

  async findSnapshotProgress(
    { goalId }: { goalId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingGoalSnapshotProgressRow[]> {
    const rows = await client.readingGoalBook.findMany({
      orderBy: [{ position: "asc" }, { bookId: "asc" }],
      select: {
        book: { select: { deletedAt: true, readingProgress: { select: { finishedAt: true } } } },
        bookId: true,
        qualifiedFinishedAt: true,
      },
      where: { goalId },
    });
    return rows.map((row) => ({
      bookId: row.bookId,
      finishedAt:
        row.book.deletedAt === null ? (row.book.readingProgress?.finishedAt ?? null) : null,
      qualifiedFinishedAt: row.qualifiedFinishedAt,
    }));
  }

  findSnapshotQualifications(
    { goalIds }: { goalIds: string[] },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingGoalSnapshotQualificationRow[]> {
    if (goalIds.length === 0) {
      return Promise.resolve([]);
    }
    return client.readingGoalBook.findMany({
      orderBy: [{ goalId: "asc" }, { position: "asc" }, { bookId: "asc" }],
      select: { bookId: true, goalId: true, qualifiedFinishedAt: true },
      where: { goalId: { in: goalIds } },
    });
  }

  updateQualifiedFinishedAt(
    {
      bookId,
      goalId,
      previousQualifiedFinishedAt,
      qualifiedFinishedAt,
    }: UpdateQualifiedFinishedAtInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.readingGoalBook
      .updateMany({
        data: { qualifiedFinishedAt },
        where: {
          bookId,
          goalId,
          qualifiedFinishedAt: previousQualifiedFinishedAt === null ? null : { not: null },
        },
      })
      .then((result) => result.count);
  }
}

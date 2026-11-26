import type { Nullable, ReadingGoalActivityType } from "@app/shared";

import { ReadingGoalActivityTypeSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingGoalActivityModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { Prisma as PrismaNamespace } from "../../../generated/prisma/client.js";

export type ReadingGoalActivityCursor = {
  createdAt: Date;
  id: string;
};

export type ReadingGoalActivityInput = {
  bookId: Nullable<string>;
  goalId: string;
  metadata: Nullable<Prisma.InputJsonValue>;
  type: ReadingGoalActivityType;
  userId: string;
};

const BOOK_COUNTED_TYPE = ReadingGoalActivityTypeSchema.enum.book_counted;

type FindActivityPageInput = {
  cursor: Nullable<ReadingGoalActivityCursor>;
  goalId: string;
  limit: number;
  type: Nullable<ReadingGoalActivityType>;
};

@Injectable()
export class ReadingGoalActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  createMany(
    { rows }: { rows: ReadingGoalActivityInput[] },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const ids = insertionOrderedIds(rows.length);
    return client.readingGoalActivity
      .createMany({
        data: rows.map((row, index) => ({ ...toActivityCreateManyInput(row), id: ids[index] })),
      })
      .then((result) => result.count);
  }

  async existsOfType(
    { goalId, type }: { goalId: string; type: ReadingGoalActivityType },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const existing = await client.readingGoalActivity.findFirst({
      select: { id: true },
      where: { goalId, type },
    });
    return existing !== null;
  }

  findAllForGoal(
    { goalId }: { goalId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingGoalActivityModel[]> {
    return client.readingGoalActivity.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { goalId },
    });
  }

  findLatest(
    { goalId, limit }: { goalId: string; limit: number },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingGoalActivityModel[]> {
    return this.findPage({ cursor: null, goalId, limit, type: null }, client);
  }

  findPage(
    { cursor, goalId, limit, type }: FindActivityPageInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingGoalActivityModel[]> {
    return client.readingGoalActivity.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      where: {
        goalId,
        ...(type === null ? {} : { type }),
        ...(cursor === null ? {} : beforeCursor(cursor)),
      },
    });
  }

  rewriteBookCountedOrdinal(
    {
      activityId,
      completedCount,
      recordedCompletedCount,
    }: { activityId: string; completedCount: number; recordedCompletedCount: number },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.$executeRaw`
      UPDATE reading_goal_activities
      SET metadata = jsonb_set(metadata, '{completedCount}', to_jsonb(${completedCount}::int))
      WHERE id = ${activityId}::uuid
        AND type = ${BOOK_COUNTED_TYPE}
        AND metadata -> 'completedCount' = to_jsonb(${recordedCompletedCount}::int)
    `;
  }
}

function beforeCursor(cursor: ReadingGoalActivityCursor): Prisma.ReadingGoalActivityWhereInput {
  return {
    createdAt: { lte: cursor.createdAt },
    OR: [{ createdAt: { lt: cursor.createdAt } }, { id: { lt: cursor.id } }],
  };
}

function insertionOrderedIds(count: number): string[] {
  return Array.from({ length: count }, () => randomUUID()).sort();
}

function toActivityCreateManyInput({
  metadata,
  ...row
}: ReadingGoalActivityInput): Prisma.ReadingGoalActivityCreateManyInput {
  return { ...row, metadata: metadata ?? PrismaNamespace.DbNull };
}

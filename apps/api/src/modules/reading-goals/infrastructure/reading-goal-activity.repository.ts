import type { Nullable, ReadingGoalActivityType } from "@app/shared";

import { Injectable } from "@nestjs/common";

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
    return client.readingGoalActivity
      .createMany({ data: rows.map(toActivityCreateManyInput) })
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
}

function beforeCursor(cursor: ReadingGoalActivityCursor): Prisma.ReadingGoalActivityWhereInput {
  return {
    createdAt: { lte: cursor.createdAt },
    OR: [{ createdAt: { lt: cursor.createdAt } }, { id: { lt: cursor.id } }],
  };
}

function toActivityCreateManyInput({
  metadata,
  ...row
}: ReadingGoalActivityInput): Prisma.ReadingGoalActivityCreateManyInput {
  return { ...row, metadata: metadata ?? PrismaNamespace.DbNull };
}

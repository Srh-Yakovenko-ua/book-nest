import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";

const goalWithListArgs = {
  include: { list: { select: { id: true, name: true } } },
} satisfies Prisma.ReadingGoalDefaultArgs;

export type ReadingGoalWithList = Prisma.ReadingGoalGetPayload<typeof goalWithListArgs>;

const countedBookArgs = {
  select: {
    authors: {
      orderBy: { position: "asc" },
      select: { author: { select: { id: true, name: true } } },
    },
    coverMedia: true,
    id: true,
    readingProgress: { select: { finishedAt: true } },
    title: true,
  },
} satisfies Prisma.BookDefaultArgs;

export type CountedBookRow = Prisma.BookGetPayload<typeof countedBookArgs>;

type CountedBooksQuery = {
  listId: string;
  since: Date;
  userId: string;
};

@Injectable()
export class ReadingGoalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireCreateLock(listId: string, client: Prisma.TransactionClient): Promise<void> {
    await acquireAdvisoryLock(
      { classId: ADVISORY_LOCK_CLASS.readingGoals, key: `reading-goal:create:${listId}` },
      client,
    );
  }

  archive(
    { archivedAt, goalId, userId }: { archivedAt: Date; goalId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.readingGoal
      .updateMany({
        data: { archivedAt },
        where: { archivedAt: null, id: goalId, userId },
      })
      .then((result) => result.count);
  }

  create(
    {
      data,
      listId,
      userId,
    }: {
      data: { deadline: Date; name: Nullable<string>; targetCount: number };
      listId: string;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingGoalWithList> {
    return client.readingGoal.create({ data: { ...data, listId, userId }, ...goalWithListArgs });
  }

  deleteOwned({ goalId, userId }: { goalId: string; userId: string }): Promise<number> {
    return this.prisma.readingGoal
      .deleteMany({ where: { id: goalId, userId } })
      .then((result) => result.count);
  }

  findActiveByListId(
    { listId, userId }: { listId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<ReadingGoalWithList>> {
    return client.readingGoal.findFirst({
      where: { archivedAt: null, listId, userId },
      ...goalWithListArgs,
    });
  }

  findCountedBooks({
    limit,
    ...query
  }: CountedBooksQuery & { limit: number }): Promise<CountedBookRow[]> {
    return this.prisma.book.findMany({
      orderBy: [{ readingProgress: { finishedAt: "asc" } }, { id: "asc" }],
      take: limit,
      where: countedBookWhere(query),
      ...countedBookArgs,
    });
  }

  async findCountedFinishedDates(
    query: CountedBooksQuery,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Date[]> {
    const rows = await client.book.findMany({
      orderBy: [{ readingProgress: { finishedAt: "asc" } }, { id: "asc" }],
      select: { readingProgress: { select: { finishedAt: true } } },
      where: countedBookWhere(query),
    });
    return rows.flatMap((row) =>
      row.readingProgress?.finishedAt === undefined || row.readingProgress.finishedAt === null
        ? []
        : [row.readingProgress.finishedAt],
    );
  }

  findOwnedById(
    { goalId, userId }: { goalId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<ReadingGoalWithList>> {
    return client.readingGoal.findFirst({ where: { id: goalId, userId }, ...goalWithListArgs });
  }

  async update({
    data,
    goalId,
    userId,
  }: {
    data: Prisma.ReadingGoalUpdateManyMutationInput;
    goalId: string;
    userId: string;
  }): Promise<Nullable<ReadingGoalWithList>> {
    const updated = await this.prisma.readingGoal.updateMany({
      data,
      where: { id: goalId, userId },
    });
    if (updated.count === 0) {
      return null;
    }
    return this.findOwnedById({ goalId, userId });
  }
}

function countedBookWhere({ listId, since, userId }: CountedBooksQuery): Prisma.BookWhereInput {
  return {
    ...SOFT_DELETE_SCOPE.active,
    lists: { some: { listId } },
    readingProgress: { finishedAt: { gte: since, not: null } },
    userId,
  };
}

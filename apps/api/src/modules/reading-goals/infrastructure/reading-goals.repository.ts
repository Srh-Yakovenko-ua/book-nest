import type { Nullable, ReadingGoalActivityType, ReadingGoalSort } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { Prisma } from "../../../generated/prisma/client.js";

const goalWithListArgs = {
  include: { list: { select: { id: true, name: true } } },
} satisfies Prisma.ReadingGoalDefaultArgs;

export type ReadingGoalListCandidate = {
  bookId: string;
  position: number;
};

export type ReadingGoalWithList = Prisma.ReadingGoalGetPayload<typeof goalWithListArgs>;

const CountedBooksRowSchema = z.object({ count: z.number().int().nonnegative() });

const GoalWithTimezoneRowSchema = z.object({
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  deadline: z.date(),
  id: z.uuid(),
  targetCount: z.number().int(),
  timezone: z.string().nullable(),
  userId: z.uuid(),
});

const COUNTED_ACTIVITY_TYPE: ReadingGoalActivityType = "book_counted";

const SETTLED_GOAL_ACTIVITY_TYPES: readonly ReadingGoalActivityType[] = [
  "goal_completed",
  "goal_expired",
];

export type ReadingGoalCountedBackfillCandidate = z.infer<typeof GoalWithTimezoneRowSchema>;

export type ReadingGoalExpirationCandidate = z.infer<typeof GoalWithTimezoneRowSchema>;

type CatalogQuery = {
  limit: number;
  listId: Nullable<string>;
  sort: ReadingGoalSort;
  userId: string;
};

type ExpirationCandidatesQuery = {
  afterId: Nullable<string>;
  deadlineBefore: Date;
  limit: number;
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

  async countBooksQualifiedBetween({
    from,
    to,
    userId,
  }: {
    from: string;
    to: string;
    userId: string;
  }): Promise<number> {
    const rows = await this.prisma.$queryRaw`
      SELECT COUNT(DISTINCT goal_book.book_id)::int AS "count"
      FROM reading_goal_books goal_book
      JOIN reading_goals goal ON goal.id = goal_book.goal_id
      WHERE goal.user_id = ${userId}::uuid
        AND goal_book.qualified_finished_at >= ${from}::date
        AND goal_book.qualified_finished_at < ${to}::date
    `;
    const [row] = z.array(CountedBooksRowSchema).parse(rows);
    return row?.count ?? 0;
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

  async findActiveListBooks(
    { listId, userId }: { listId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadingGoalListCandidate[]> {
    const rows = await client.bookListItem.findMany({
      orderBy: [{ position: "asc" }, { bookId: "asc" }],
      select: { bookId: true, position: true },
      where: { book: { ...SOFT_DELETE_SCOPE.active, userId }, listId },
    });
    return rows.map((row) => ({ bookId: row.bookId, position: row.position }));
  }

  findCatalogPage({ limit, listId, sort, userId }: CatalogQuery): Promise<ReadingGoalWithList[]> {
    return this.prisma.readingGoal.findMany({
      orderBy: catalogOrderBy(sort),
      take: limit,
      where: { userId, ...(listId === null ? {} : { listId }) },
      ...goalWithListArgs,
    });
  }

  async findCountedBackfillCandidates({
    afterId,
    limit,
  }: {
    afterId: Nullable<string>;
    limit: number;
  }): Promise<ReadingGoalCountedBackfillCandidate[]> {
    const rows = await this.prisma.$queryRaw`
      SELECT
        goal.id AS "id",
        goal.user_id AS "userId",
        goal.target_count AS "targetCount",
        goal.deadline AS "deadline",
        goal.archived_at AS "archivedAt",
        goal.created_at AS "createdAt",
        settings.timezone AS "timezone"
      FROM reading_goals goal
      LEFT JOIN user_profile_settings settings ON settings.user_id = goal.user_id
      WHERE EXISTS (
          SELECT 1
          FROM reading_goal_activities activity
          WHERE activity.goal_id = goal.id
            AND activity.type = ${COUNTED_ACTIVITY_TYPE}
        )
        ${afterId === null ? Prisma.empty : Prisma.sql`AND goal.id > ${afterId}::uuid`}
      ORDER BY goal.id ASC
      LIMIT ${limit}
    `;
    return z.array(GoalWithTimezoneRowSchema).parse(rows);
  }

  async findExpirationCandidates({
    afterId,
    deadlineBefore,
    limit,
  }: ExpirationCandidatesQuery): Promise<ReadingGoalExpirationCandidate[]> {
    const rows = await this.prisma.$queryRaw`
      SELECT
        goal.id AS "id",
        goal.user_id AS "userId",
        goal.target_count AS "targetCount",
        goal.deadline AS "deadline",
        goal.archived_at AS "archivedAt",
        goal.created_at AS "createdAt",
        settings.timezone AS "timezone"
      FROM reading_goals goal
      LEFT JOIN user_profile_settings settings ON settings.user_id = goal.user_id
      WHERE goal.archived_at IS NULL
        AND goal.deadline < ${toIsoDate(deadlineBefore)}::date
        ${afterId === null ? Prisma.empty : Prisma.sql`AND goal.id > ${afterId}::uuid`}
        AND NOT EXISTS (
          SELECT 1
          FROM reading_goal_activities activity
          WHERE activity.goal_id = goal.id
            AND activity.type IN (${Prisma.join(SETTLED_GOAL_ACTIVITY_TYPES)})
        )
      ORDER BY goal.id ASC
      LIMIT ${limit}
    `;
    return z.array(GoalWithTimezoneRowSchema).parse(rows);
  }

  findOpenGoals({ userId }: { userId: string }): Promise<ReadingGoalWithList[]> {
    return this.prisma.readingGoal.findMany({
      orderBy: [{ deadline: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      where: { archivedAt: null, userId },
      ...goalWithListArgs,
    });
  }

  findOwnedById(
    { goalId, userId }: { goalId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<ReadingGoalWithList>> {
    return client.readingGoal.findFirst({ where: { id: goalId, userId }, ...goalWithListArgs });
  }

  findOwnedByIds({
    goalIds,
    userId,
  }: {
    goalIds: string[];
    userId: string;
  }): Promise<ReadingGoalWithList[]> {
    if (goalIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.readingGoal.findMany({
      orderBy: { id: "asc" },
      where: { id: { in: goalIds }, userId },
      ...goalWithListArgs,
    });
  }

  async update(
    {
      data,
      goalId,
      userId,
    }: {
      data: Prisma.ReadingGoalUpdateManyMutationInput;
      goalId: string;
      userId: string;
    },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<ReadingGoalWithList>> {
    const updated = await client.readingGoal.updateMany({
      data,
      where: { archivedAt: null, id: goalId, userId },
    });
    if (updated.count === 0) {
      return null;
    }
    return this.findOwnedById({ goalId, userId }, client);
  }
}

function catalogOrderBy(sort: ReadingGoalSort): Prisma.ReadingGoalOrderByWithRelationInput[] {
  switch (sort) {
    case "created_asc":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "deadline_asc":
      return [{ deadline: "asc" }, { id: "asc" }];
    case "deadline_desc":
      return [{ deadline: "desc" }, { id: "desc" }];
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

import type { INestApplication } from "@nestjs/common";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { addDaysToIsoDate, parseIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { ReadingGoalsModule } from "../reading-goals.module.js";
import { ReadingGoalExpirationReconciler } from "./reading-goal-expiration.reconciler.js";

const TODAY = toIsoDate(new Date());
const YESTERDAY = addDaysToIsoDate(TODAY, -1);
const GOAL_STARTED_ON = addDaysToIsoDate(TODAY, -30);
const BOOK_FINISHED_ON = addDaysToIsoDate(TODAY, -3);

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reconciler: ReadingGoalExpirationReconciler;
let owner: AuthenticatedUser;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, ListsModule, ReadingGoalsModule]);
  app = context.app;
  prisma = app.get(PrismaService);
  reconciler = app.get(ReadingGoalExpirationReconciler);
});

beforeEach(async () => {
  context.reset();
  owner = await context.registerVerifyAndLogin();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function activityTypes(goalId: string): Promise<string[]> {
  const rows = await prisma.readingGoalActivity.findMany({ where: { goalId } });
  return rows.map((row) => row.type);
}

async function createBook(finished: boolean): Promise<string> {
  const book = await prisma.book.create({
    data: {
      firstAuthorName: "",
      genres: [],
      readingStatus: finished ? "finished" : "not_started",
      title: `Sweep book ${String(Math.random())}`,
      userId: owner.userId,
    },
  });
  if (finished) {
    await prisma.bookReadingProgress.create({
      data: { bookId: book.id, finishedAt: parseIsoDate(BOOK_FINISHED_ON) },
    });
  }
  return book.id;
}

async function createList(): Promise<string> {
  const created = await prisma.bookList.create({
    data: { name: "Sweep list", normalizedName: "sweep list", userId: owner.userId },
  });
  return created.id;
}

async function seedGoal({
  archived = false,
  finishedCount,
  targetCount,
  totalBooks,
}: {
  archived?: boolean;
  finishedCount: number;
  targetCount: number;
  totalBooks: number;
}): Promise<string> {
  const listId = await createList();
  const bookIds: string[] = [];
  for (let index = 0; index < totalBooks; index += 1) {
    bookIds.push(await createBook(index < finishedCount));
  }

  const goal = await prisma.readingGoal.create({
    data: {
      archivedAt: archived ? new Date() : null,
      createdAt: parseIsoDate(GOAL_STARTED_ON),
      deadline: parseIsoDate(YESTERDAY),
      listId,
      name: "Sweep goal",
      targetCount,
      userId: owner.userId,
    },
  });
  await prisma.readingGoalBook.createMany({
    data: bookIds.map((bookId, position) => ({
      bookId,
      goalId: goal.id,
      position,
      qualifiedFinishedAt: position < finishedCount ? parseIsoDate(BOOK_FINISHED_ON) : null,
    })),
  });
  return goal.id;
}

describe("ReadingGoalExpirationReconciler.run", () => {
  it("records goal_expired once for a goal that missed its deadline", async () => {
    const goalId = await seedGoal({ finishedCount: 0, targetCount: 2, totalBooks: 2 });

    await reconciler.run({ now: new Date() });

    expect(await activityTypes(goalId)).toEqual(["goal_expired"]);
  });

  it("writes the deadline, the counts and the target as metadata", async () => {
    const goalId = await seedGoal({ finishedCount: 1, targetCount: 3, totalBooks: 3 });

    await reconciler.run({ now: new Date() });
    const row = await prisma.readingGoalActivity.findFirst({
      where: { goalId, type: "goal_expired" },
    });

    expect(row?.metadata).toEqual({
      completedCount: 1,
      deadline: YESTERDAY,
      remainingCount: 2,
      targetCount: 3,
    });
  });

  it("stays idempotent across two consecutive runs", async () => {
    const goalId = await seedGoal({ finishedCount: 0, targetCount: 2, totalBooks: 2 });

    await reconciler.run({ now: new Date() });
    await reconciler.run({ now: new Date() });

    expect(await activityTypes(goalId)).toEqual(["goal_expired"]);
  });

  it("leaves a goal that met its target alone", async () => {
    const goalId = await seedGoal({ finishedCount: 2, targetCount: 2, totalBooks: 2 });

    await reconciler.run({ now: new Date() });

    expect(await activityTypes(goalId)).toEqual([]);
  });

  it("leaves an archived goal alone", async () => {
    const goalId = await seedGoal({
      archived: true,
      finishedCount: 0,
      targetCount: 2,
      totalBooks: 2,
    });

    await reconciler.run({ now: new Date() });

    expect(await activityTypes(goalId)).toEqual([]);
  });

  it("records the expiry without anyone reading the goal", async () => {
    const goalId = await seedGoal({ finishedCount: 0, targetCount: 2, totalBooks: 2 });

    await reconciler.sweep();

    expect(await activityTypes(goalId)).toEqual(["goal_expired"]);
  });
});

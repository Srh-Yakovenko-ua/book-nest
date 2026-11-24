import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { ReadingGoalActivityResponseSchema } from "@app/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import {
  addDaysToIsoDate,
  parseIsoDate,
  toIsoDate,
  toNullableIsoDate,
} from "../../../core/iso-date.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import {
  insertFinishedReadingCycle,
  moveFinishedReadingCycle,
} from "../../../test/reading-cycles.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { registerReaderInTimezone } from "../../../test/user-timezone.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { ReadingGoalsModule } from "../reading-goals.module.js";
import { ReadingGoalSyncService } from "./reading-goal-sync.service.js";

const TODAY = toIsoDate(new Date());
const TOMORROW = addDaysToIsoDate(TODAY, 1);
const NEXT_WEEK = addDaysToIsoDate(TODAY, 7);
const NEXT_MONTH = addDaysToIsoDate(TODAY, 30);

const BOOK_ID = {
  alpha: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  beta: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  delta: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  gamma: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
} as const;

type HistoryEntry = {
  completedCount: unknown;
  title: Nullable<string>;
  type: string;
};

type SnapshotEntry = {
  bookId: string;
  qualifiedFinishedAt: Nullable<string>;
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let syncService: ReadingGoalSyncService;
let owner: AuthenticatedUser;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, ListsModule, ReadingGoalsModule]);
  app = context.app;
  prisma = app.get(PrismaService);
  syncService = app.get(ReadingGoalSyncService);
});

beforeEach(async () => {
  context.reset();
  owner = await registerReaderInTimezone({ context, timezone: "UTC" });
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function activityCount({ goalId, type }: { goalId: string; type: string }): Promise<number> {
  return prisma.readingGoalActivity.count({ where: { goalId, type } });
}

async function activityHistory({
  goalId,
  type,
}: {
  goalId: string;
  type?: string;
}): Promise<HistoryEntry[]> {
  const response = await request(app.getHttpServer())
    .get(`/api/goals/${goalId}/activity`)
    .query(type === undefined ? {} : { type })
    .set("Authorization", `Bearer ${owner.accessToken}`);
  if (response.status !== 200) {
    throw new Error(`activity history failed with ${String(response.status)}`);
  }
  return ReadingGoalActivityResponseSchema.parse(response.body).items.map((item) => ({
    completedCount: item.metadata?.completedCount ?? null,
    title: item.book?.title ?? null,
    type: item.type,
  }));
}

async function activityMetadata({
  goalId,
  type,
}: {
  goalId: string;
  type: string;
}): Promise<unknown> {
  const row = await prisma.readingGoalActivity.findFirst({ where: { goalId, type } });
  return row?.metadata ?? null;
}

async function activityTypes(goalId: string): Promise<string[]> {
  const rows = await prisma.readingGoalActivity.findMany({ where: { goalId } });
  return rows.map((row) => row.type).sort((left, right) => left.localeCompare(right));
}

async function addBookToList({
  finishedIsoDate,
  id,
  listId,
  position,
  title,
  userId,
}: {
  finishedIsoDate?: string;
  id?: string;
  listId: string;
  position: number;
  title: string;
  userId: string;
}): Promise<string> {
  const bookId = await createBook({ finishedIsoDate, id, title, userId });
  await prisma.bookListItem.create({ data: { bookId, listId, position } });
  return bookId;
}

async function createBook({
  finishedIsoDate,
  id,
  title,
  userId,
}: {
  finishedIsoDate?: string;
  id?: string;
  title: string;
  userId: string;
}): Promise<string> {
  const book = await prisma.book.create({
    data: {
      firstAuthorName: "",
      genres: [],
      id,
      readingStatus: finishedIsoDate === undefined ? "not_started" : "finished",
      title,
      userId,
    },
  });
  if (finishedIsoDate !== undefined) {
    await prisma.bookReadingProgress.create({
      data: { bookId: book.id, finishedAt: parseIsoDate(finishedIsoDate) },
    });
    await insertFinishedReadingCycle(prisma, { bookId: book.id, finishedIsoDate, userId });
  }
  return book.id;
}

async function createGoalOrThrow({
  accessToken,
  deadline = NEXT_MONTH,
  listId,
  targetCount,
}: {
  accessToken: string;
  deadline?: string;
  listId: string;
  targetCount: number;
}): Promise<string> {
  const response = await request(app.getHttpServer())
    .post(`/api/lists/${listId}/goal`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ deadline, name: "Autumn goal", targetCount });
  if (response.status !== 201) {
    throw new Error(`goal creation failed with ${String(response.status)}`);
  }
  const goalId: unknown = response.body.id;
  if (typeof goalId !== "string") {
    throw new Error("goal creation returned no id");
  }
  return goalId;
}

async function createList(userId: string, name = "Autumn reads"): Promise<string> {
  const created = await prisma.bookList.create({
    data: { description: null, name, normalizedName: name.trim().toLowerCase(), userId },
  });
  return created.id;
}

function getGoal({ accessToken, goalId }: { accessToken: string; goalId: string }) {
  return request(app.getHttpServer())
    .get(`/api/goals/${goalId}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function qualifiedDate({
  bookId,
  goalId,
}: {
  bookId: string;
  goalId: string;
}): Promise<Nullable<string>> {
  const row = await prisma.readingGoalBook.findUnique({
    where: { goalId_bookId: { bookId, goalId } },
  });
  if (row === null) {
    throw new Error(`snapshot row missing for book ${bookId}`);
  }
  return toNullableIsoDate(row.qualifiedFinishedAt);
}

async function restoreBook(title: string): Promise<void> {
  await prisma.book.updateMany({ data: { deletedAt: null, purgeAt: null }, where: { title } });
}

function runSync(bookIds: string[]): Promise<void> {
  return syncService.syncBooks({ bookIds, userId: owner.userId });
}

async function seedGoalWithBooks(
  books: { finishedIsoDate?: string; id: string; title: string }[],
): Promise<string> {
  const listId = await createList(owner.userId);
  for (const [position, book] of books.entries()) {
    await addBookToList({ ...book, listId, position, userId: owner.userId });
  }
  return createGoalOrThrow({ accessToken: owner.accessToken, listId, targetCount: 5 });
}

async function seedTwoBookGoal({
  alphaFinishedIsoDate,
  deadline = NEXT_MONTH,
}: {
  alphaFinishedIsoDate?: string;
  deadline?: string;
} = {}): Promise<{ alphaId: string; betaId: string; goalId: string; listId: string }> {
  const listId = await createList(owner.userId);
  const alphaId = await addBookToList({
    finishedIsoDate: alphaFinishedIsoDate,
    listId,
    position: 0,
    title: "Alpha",
    userId: owner.userId,
  });
  const betaId = await addBookToList({
    listId,
    position: 1,
    title: "Beta",
    userId: owner.userId,
  });
  const goalId = await createGoalOrThrow({
    accessToken: owner.accessToken,
    deadline,
    listId,
    targetCount: 2,
  });
  return { alphaId, betaId, goalId, listId };
}

async function setFinishedAt({
  bookId,
  isoDate,
}: {
  bookId: string;
  isoDate: Nullable<string>;
}): Promise<void> {
  const finishedAt = isoDate === null ? null : parseIsoDate(isoDate);
  await prisma.bookReadingProgress.upsert({
    create: { bookId, finishedAt },
    update: { finishedAt },
    where: { bookId },
  });
  await moveFinishedReadingCycle(prisma, {
    bookId,
    finishedIsoDate: isoDate,
    userId: owner.userId,
  });
}

async function snapshotEntries(goalId: string): Promise<SnapshotEntry[]> {
  const rows = await prisma.readingGoalBook.findMany({
    orderBy: { position: "asc" },
    where: { goalId },
  });
  return rows.map((row) => ({
    bookId: row.bookId,
    qualifiedFinishedAt: toNullableIsoDate(row.qualifiedFinishedAt),
  }));
}

async function trashBook(title: string): Promise<void> {
  await prisma.book.updateMany({ data: TRASH_RETENTION.stamp(), where: { title } });
}

describe("ReadingGoalSyncService.syncBooks", () => {
  it("counts a book that gained a finished date inside the counting window", async () => {
    const { alphaId, betaId, goalId } = await seedTwoBookGoal();

    await setFinishedAt({ bookId: alphaId, isoDate: TODAY });
    await runSync([alphaId]);

    expect(await snapshotEntries(goalId)).toEqual([
      { bookId: alphaId, qualifiedFinishedAt: TODAY },
      { bookId: betaId, qualifiedFinishedAt: null },
    ]);
    expect(await activityMetadata({ goalId, type: "book_counted" })).toEqual({
      completedCount: 1,
      finishedAt: TODAY,
      targetCount: 2,
    });
  });

  it("uncounts a book whose finished date was removed", async () => {
    const { alphaId, betaId, goalId } = await seedTwoBookGoal({ alphaFinishedIsoDate: TODAY });

    await setFinishedAt({ bookId: alphaId, isoDate: null });
    await runSync([alphaId]);

    expect(await snapshotEntries(goalId)).toEqual([
      { bookId: alphaId, qualifiedFinishedAt: null },
      { bookId: betaId, qualifiedFinishedAt: null },
    ]);
    expect(await activityMetadata({ goalId, type: "book_uncounted" })).toEqual({
      previousFinishedAt: TODAY,
      reason: "finished_date_removed",
    });
  });

  it("uncounts a book whose finished date moved past the deadline", async () => {
    const { alphaId, betaId, goalId } = await seedTwoBookGoal({
      alphaFinishedIsoDate: TODAY,
      deadline: NEXT_WEEK,
    });

    await setFinishedAt({ bookId: alphaId, isoDate: NEXT_MONTH });
    await runSync([alphaId]);

    expect(await snapshotEntries(goalId)).toEqual([
      { bookId: alphaId, qualifiedFinishedAt: null },
      { bookId: betaId, qualifiedFinishedAt: null },
    ]);
    expect(await activityMetadata({ goalId, type: "book_uncounted" })).toEqual({
      previousFinishedAt: TODAY,
      reason: "finished_date_changed",
    });
  });

  it("counts a book whose finished date moved back inside the deadline", async () => {
    const { alphaId, betaId, goalId } = await seedTwoBookGoal({
      alphaFinishedIsoDate: NEXT_MONTH,
      deadline: NEXT_WEEK,
    });

    await setFinishedAt({ bookId: alphaId, isoDate: TODAY });
    await runSync([alphaId]);

    expect(await snapshotEntries(goalId)).toEqual([
      { bookId: alphaId, qualifiedFinishedAt: TODAY },
      { bookId: betaId, qualifiedFinishedAt: null },
    ]);
    expect(await activityMetadata({ goalId, type: "book_counted" })).toEqual({
      completedCount: 1,
      finishedAt: TODAY,
      targetCount: 2,
    });
  });

  it("leaves the goal untouched when the synced book is outside its snapshot", async () => {
    const { alphaId, betaId, goalId } = await seedTwoBookGoal();
    const outsiderId = await createBook({
      finishedIsoDate: TODAY,
      title: "Outsider",
      userId: owner.userId,
    });

    await runSync([outsiderId]);

    expect(await snapshotEntries(goalId)).toEqual([
      { bookId: alphaId, qualifiedFinishedAt: null },
      { bookId: betaId, qualifiedFinishedAt: null },
    ]);
    expect(await activityTypes(goalId)).toEqual(["goal_created"]);
  });

  it("ignores a finished book added to the list after the goal was created", async () => {
    const { alphaId, betaId, goalId, listId } = await seedTwoBookGoal();
    const lateId = await addBookToList({
      finishedIsoDate: TODAY,
      listId,
      position: 2,
      title: "Gamma",
      userId: owner.userId,
    });

    await runSync([lateId]);

    expect(await snapshotEntries(goalId)).toEqual([
      { bookId: alphaId, qualifiedFinishedAt: null },
      { bookId: betaId, qualifiedFinishedAt: null },
    ]);
    expect((await getGoal({ accessToken: owner.accessToken, goalId })).body.completedCount).toBe(0);
  });

  it("keeps counting a book removed from the list after the goal was created", async () => {
    const { alphaId, betaId, goalId, listId } = await seedTwoBookGoal({
      alphaFinishedIsoDate: TODAY,
    });

    await prisma.bookListItem.deleteMany({ where: { bookId: alphaId, listId } });
    await runSync([alphaId]);

    expect(await snapshotEntries(goalId)).toEqual([
      { bookId: alphaId, qualifiedFinishedAt: TODAY },
      { bookId: betaId, qualifiedFinishedAt: null },
    ]);
    expect((await getGoal({ accessToken: owner.accessToken, goalId })).body.completedCount).toBe(1);
  });

  it("records the completion once when the same sync runs twice", async () => {
    const listId = await createList(owner.userId);
    const alphaId = await addBookToList({
      listId,
      position: 0,
      title: "Alpha",
      userId: owner.userId,
    });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 1,
    });

    await setFinishedAt({ bookId: alphaId, isoDate: TODAY });
    await runSync([alphaId]);
    await runSync([alphaId]);

    expect({
      completed: await activityCount({ goalId, type: "goal_completed" }),
      counted: await activityCount({ goalId, type: "book_counted" }),
    }).toEqual({ completed: 1, counted: 1 });
  });

  it("records neither a count nor an uncount when the date moves between qualifying days", async () => {
    const { alphaId, betaId, goalId } = await seedTwoBookGoal({ alphaFinishedIsoDate: TODAY });

    await setFinishedAt({ bookId: alphaId, isoDate: TOMORROW });
    await runSync([alphaId]);

    expect(await snapshotEntries(goalId)).toEqual([
      { bookId: alphaId, qualifiedFinishedAt: TOMORROW },
      { bookId: betaId, qualifiedFinishedAt: null },
    ]);
    expect(await activityTypes(goalId)).toEqual(["book_counted", "goal_created"]);
  });

  it("uncounts a trashed book and counts it again once it is restored", async () => {
    const { alphaId, goalId } = await seedTwoBookGoal({ alphaFinishedIsoDate: TODAY });

    await trashBook("Alpha");
    await runSync([alphaId]);
    const afterTrash = await qualifiedDate({ bookId: alphaId, goalId });
    await restoreBook("Alpha");
    await runSync([alphaId]);
    const afterRestore = await qualifiedDate({ bookId: alphaId, goalId });

    expect({ afterRestore, afterTrash }).toEqual({ afterRestore: TODAY, afterTrash: null });
  });
});

describe("ReadingGoalSyncService.syncBooks book_counted ordinals", () => {
  it("numbers two books finished on the same day in the order they were recorded", async () => {
    const goalId = await seedGoalWithBooks([
      { id: BOOK_ID.beta, title: "Beta" },
      { id: BOOK_ID.alpha, title: "Alpha" },
    ]);

    await setFinishedAt({ bookId: BOOK_ID.beta, isoDate: TODAY });
    await runSync([BOOK_ID.beta]);
    await setFinishedAt({ bookId: BOOK_ID.alpha, isoDate: TODAY });
    await runSync([BOOK_ID.alpha]);

    expect(await activityHistory({ goalId, type: "book_counted" })).toEqual([
      { completedCount: 2, title: "Alpha", type: "book_counted" },
      { completedCount: 1, title: "Beta", type: "book_counted" },
    ]);
  });

  it("gives a book finished before the already counted ones the next count, not its date position", async () => {
    const goalId = await seedGoalWithBooks([
      { id: BOOK_ID.alpha, title: "Alpha" },
      { finishedIsoDate: TOMORROW, id: BOOK_ID.beta, title: "Beta" },
      { finishedIsoDate: NEXT_WEEK, id: BOOK_ID.gamma, title: "Gamma" },
    ]);

    await setFinishedAt({ bookId: BOOK_ID.alpha, isoDate: TODAY });
    await runSync([BOOK_ID.alpha]);

    expect(await activityHistory({ goalId, type: "book_counted" })).toEqual([
      { completedCount: 3, title: "Alpha", type: "book_counted" },
      { completedCount: 2, title: "Gamma", type: "book_counted" },
      { completedCount: 1, title: "Beta", type: "book_counted" },
    ]);
  });

  it("recounts an uncounted book at the count it brings the goal back to", async () => {
    const goalId = await seedGoalWithBooks([
      { finishedIsoDate: TODAY, id: BOOK_ID.alpha, title: "Alpha" },
      { finishedIsoDate: TOMORROW, id: BOOK_ID.beta, title: "Beta" },
    ]);

    await setFinishedAt({ bookId: BOOK_ID.alpha, isoDate: null });
    await runSync([BOOK_ID.alpha]);
    await setFinishedAt({ bookId: BOOK_ID.alpha, isoDate: TODAY });
    await runSync([BOOK_ID.alpha]);

    expect(await activityHistory({ goalId })).toEqual([
      { completedCount: 2, title: "Alpha", type: "book_counted" },
      { completedCount: null, title: "Alpha", type: "book_uncounted" },
      { completedCount: 2, title: "Beta", type: "book_counted" },
      { completedCount: 1, title: "Alpha", type: "book_counted" },
      { completedCount: null, title: null, type: "goal_created" },
    ]);
  });

  it("lists books counted by one sync newest first, counting down from the goal's completed count", async () => {
    const goalId = await seedGoalWithBooks([
      { finishedIsoDate: TODAY, id: BOOK_ID.delta, title: "Delta" },
      { id: BOOK_ID.alpha, title: "Alpha" },
      { id: BOOK_ID.beta, title: "Beta" },
      { id: BOOK_ID.gamma, title: "Gamma" },
    ]);

    await setFinishedAt({ bookId: BOOK_ID.alpha, isoDate: TODAY });
    await setFinishedAt({ bookId: BOOK_ID.beta, isoDate: TODAY });
    await setFinishedAt({ bookId: BOOK_ID.gamma, isoDate: TODAY });
    await runSync([BOOK_ID.gamma, BOOK_ID.alpha, BOOK_ID.beta]);
    const goalResponse = await getGoal({ accessToken: owner.accessToken, goalId });
    const goalCount: unknown = goalResponse.body.completedCount;

    expect({
      goalCount,
      history: await activityHistory({ goalId, type: "book_counted" }),
    }).toEqual({
      goalCount: 4,
      history: [
        { completedCount: 4, title: "Gamma", type: "book_counted" },
        { completedCount: 3, title: "Beta", type: "book_counted" },
        { completedCount: 2, title: "Alpha", type: "book_counted" },
        { completedCount: 1, title: "Delta", type: "book_counted" },
      ],
    });
  });
});

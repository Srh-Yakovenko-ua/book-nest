import type { INestApplication } from "@nestjs/common";

import { subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { addDaysToIsoDate, parseIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListLifecycleService } from "../../lists/application/list-lifecycle.service.js";
import { ListsModule } from "../../lists/lists.module.js";
import { ReadingGoalsModule } from "../reading-goals.module.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const TODAY = toIsoDate(new Date());
const YESTERDAY = addDaysToIsoDate(TODAY, -1);
const NEXT_MONTH = addDaysToIsoDate(TODAY, 30);

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let lifecycle: ListLifecycleService;
let owner: AuthenticatedUser;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, ListsModule, ReadingGoalsModule]);
  app = context.app;
  prisma = app.get(PrismaService);
  lifecycle = app.get(ListLifecycleService);
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

async function addBookToList({
  deletedAt,
  finishedIsoDate,
  listId,
  position,
  title,
  userId,
}: {
  deletedAt?: Date;
  finishedIsoDate?: string;
  listId: string;
  position: number;
  title: string;
  userId: string;
}): Promise<string> {
  const bookId = await createBook({ deletedAt, finishedIsoDate, title, userId });
  await prisma.bookListItem.create({ data: { bookId, listId, position } });
  return bookId;
}

async function createBook({
  deletedAt,
  finishedIsoDate,
  title,
  userId,
}: {
  deletedAt?: Date;
  finishedIsoDate?: string;
  title: string;
  userId: string;
}): Promise<string> {
  const book = await prisma.book.create({
    data: {
      deletedAt: deletedAt ?? null,
      firstAuthorName: "",
      genres: [],
      readingStatus: finishedIsoDate === undefined ? "not_started" : "finished",
      title,
      userId,
    },
  });
  if (finishedIsoDate !== undefined) {
    await prisma.bookReadingProgress.create({
      data: { bookId: book.id, finishedAt: parseIsoDate(finishedIsoDate) },
    });
  }
  return book.id;
}

async function createGoalOrThrow({
  accessToken,
  listId,
  targetCount,
}: {
  accessToken: string;
  listId: string;
  targetCount: number;
}): Promise<string> {
  const response = await postGoal({
    accessToken,
    body: { deadline: NEXT_MONTH, name: "Autumn goal", targetCount },
    listId,
  });
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

function getListGoal({ accessToken, listId }: { accessToken: string; listId: string }) {
  return request(app.getHttpServer())
    .get(`/api/lists/${listId}/goal`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function postGoal({
  accessToken,
  body,
  listId,
}: {
  accessToken: string;
  body: Record<string, unknown>;
  listId: string;
}) {
  return request(app.getHttpServer())
    .post(`/api/lists/${listId}/goal`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function seedList({
  bookCount,
  finishedIsoDate,
  user,
}: {
  bookCount: number;
  finishedIsoDate?: string;
  user: AuthenticatedUser;
}): Promise<string> {
  const listId = await createList(user.userId);
  for (let index = 0; index < bookCount; index += 1) {
    await addBookToList({
      finishedIsoDate,
      listId,
      position: index,
      title: `Book ${String(index)}`,
      userId: user.userId,
    });
  }
  return listId;
}

describe("POST /api/lists/:listId/goal", () => {
  it("creates a goal over the list and returns the view shape", async () => {
    const listId = await seedList({ bookCount: 3, user: owner });

    const response = await postGoal({
      accessToken: owner.accessToken,
      body: { deadline: NEXT_MONTH, name: "Autumn goal", targetCount: 3 },
      listId,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      completedCount: 0,
      deadline: NEXT_MONTH,
      list: { id: listId, name: "Autumn reads" },
      name: "Autumn goal",
      remainingCount: 3,
      status: "active",
      targetCount: 3,
    });
    expect(response.body.id).toMatch(UUID_PATTERN);
  });

  it("rejects a deadline in the past with a field-scoped error on deadline", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });

    const response = await postGoal({
      accessToken: owner.accessToken,
      body: { deadline: YESTERDAY, targetCount: 1 },
      listId,
    });

    expect(response.status).toBe(400);
    expect(response.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "deadline" })]),
    );
  });

  it("conflicts when the list already has an active goal", async () => {
    const listId = await seedList({ bookCount: 3, user: owner });
    await createGoalOrThrow({ accessToken: owner.accessToken, listId, targetCount: 3 });

    const response = await postGoal({
      accessToken: owner.accessToken,
      body: { deadline: NEXT_MONTH, targetCount: 2 },
      listId,
    });

    expect(response.status).toBe(409);
  });

  it("lets exactly one of two simultaneous attempts win", async () => {
    const listId = await seedList({ bookCount: 3, user: owner });
    const body = { deadline: NEXT_MONTH, targetCount: 2 };

    const responses = await Promise.all([
      postGoal({ accessToken: owner.accessToken, body, listId }),
      postGoal({ accessToken: owner.accessToken, body, listId }),
    ]);
    const statuses = responses.map((response) => response.status).sort((a, b) => a - b);

    expect(statuses).toEqual([201, 409]);
  });

  it("leaves exactly one goal row behind after two simultaneous attempts", async () => {
    const listId = await seedList({ bookCount: 3, user: owner });
    const body = { deadline: NEXT_MONTH, targetCount: 2 };

    await Promise.all([
      postGoal({ accessToken: owner.accessToken, body, listId }),
      postGoal({ accessToken: owner.accessToken, body, listId }),
    ]);

    expect(await prisma.readingGoal.count({ where: { listId } })).toBe(1);
  });

  it("archives the previous goal when it is already completed", async () => {
    const listId = await seedList({ bookCount: 2, finishedIsoDate: TODAY, user: owner });
    const firstGoalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const second = await postGoal({
      accessToken: owner.accessToken,
      body: { deadline: NEXT_MONTH, targetCount: 1 },
      listId,
    });
    const previous = await getGoal({ accessToken: owner.accessToken, goalId: firstGoalId });

    expect(second.status).toBe(201);
    expect(previous.body.status).toBe("archived");
  });

  it("returns 404 for a list owned by another user", async () => {
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const listId = await seedList({ bookCount: 2, user: stranger });

    const response = await postGoal({
      accessToken: owner.accessToken,
      body: { deadline: NEXT_MONTH, targetCount: 1 },
      listId,
    });

    expect(response.status).toBe(404);
  });
});

describe("GET /api/lists/:listId/goal", () => {
  it("returns 204 with an empty body when the list has no open goal", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });

    const response = await getListGoal({ accessToken: owner.accessToken, listId });

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  it("returns 204 rather than the goal once the only goal is archived", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    await request(app.getHttpServer())
      .post(`/api/goals/${goalId}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const response = await getListGoal({ accessToken: owner.accessToken, listId });

    expect(response.status).toBe(204);
  });

  it("returns the open goal of the list", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await getListGoal({ accessToken: owner.accessToken, listId });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(goalId);
  });

  it("returns 404 for a list owned by another user", async () => {
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const listId = await seedList({ bookCount: 2, user: stranger });

    const response = await getListGoal({ accessToken: owner.accessToken, listId });

    expect(response.status).toBe(404);
  });

  it("returns 404 for a list that does not exist", async () => {
    const response = await getListGoal({ accessToken: owner.accessToken, listId: MISSING_UUID });

    expect(response.status).toBe(404);
  });
});

describe("reading goal progress", () => {
  it("does not count a book finished the day before the goal was created", async () => {
    const listId = await createList(owner.userId);
    await addBookToList({
      finishedIsoDate: YESTERDAY,
      listId,
      position: 0,
      title: "Finished yesterday",
      userId: owner.userId,
    });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 1,
    });

    const response = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(response.body.completedCount).toBe(0);
  });

  it("counts a book finished earlier on the same UTC day the goal was created", async () => {
    const listId = await createList(owner.userId);
    await addBookToList({
      finishedIsoDate: TODAY,
      listId,
      position: 0,
      title: "Finished this morning",
      userId: owner.userId,
    });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 1,
    });

    const response = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(response.body.completedCount).toBe(1);
  });

  it("counts a book finished after the goal was created", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    const before = await getGoal({ accessToken: owner.accessToken, goalId });

    const [item] = await prisma.bookListItem.findMany({
      orderBy: { position: "asc" },
      where: { listId },
    });
    await prisma.bookReadingProgress.create({
      data: { bookId: item?.bookId ?? MISSING_UUID, finishedAt: parseIsoDate(TODAY) },
    });
    const after = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(before.body.completedCount).toBe(0);
    expect(after.body.completedCount).toBe(1);
  });

  it("flips the status to completed once the target is met", async () => {
    const listId = await seedList({ bookCount: 2, finishedIsoDate: TODAY, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(response.body).toMatchObject({
      completedCount: 2,
      remainingCount: 0,
      status: "completed",
    });
  });

  it("does not count a book that sits in the trash", async () => {
    const listId = await createList(owner.userId);
    await addBookToList({
      finishedIsoDate: TODAY,
      listId,
      position: 0,
      title: "Counted",
      userId: owner.userId,
    });
    await addBookToList({
      finishedIsoDate: TODAY,
      listId,
      position: 1,
      title: "Trashed",
      userId: owner.userId,
    });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    await prisma.book.updateMany({
      data: TRASH_RETENTION.stamp(),
      where: { title: "Trashed" },
    });

    const response = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(response.body.completedCount).toBe(1);
  });

  it("lowers completedCount when a counted book leaves the list", async () => {
    const listId = await seedList({ bookCount: 2, finishedIsoDate: TODAY, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    const before = await getGoal({ accessToken: owner.accessToken, goalId });

    const [item] = await prisma.bookListItem.findMany({
      orderBy: { position: "asc" },
      where: { listId },
    });
    await prisma.bookListItem.deleteMany({
      where: { bookId: item?.bookId ?? MISSING_UUID, listId },
    });
    const after = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(before.body.completedCount).toBe(2);
    expect(after.body.completedCount).toBe(1);
  });
});

describe("GET /api/goals/:goalId", () => {
  it("still returns an archived goal with an archived status", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    await request(app.getHttpServer())
      .post(`/api/goals/${goalId}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const response = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("archived");
  });

  it("returns 404 for a goal owned by another user", async () => {
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const listId = await seedList({ bookCount: 2, user: stranger });
    const goalId = await createGoalOrThrow({
      accessToken: stranger.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/goals/:goalId", () => {
  it("renames the goal", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Renamed goal" });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Renamed goal");
  });

  it("rejects moving the deadline into the past with a field-scoped error on deadline", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ deadline: YESTERDAY });

    expect(response.status).toBe(400);
    expect(response.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "deadline" })]),
    );
  });

  it("returns 404 for a goal owned by another user", async () => {
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const listId = await seedList({ bookCount: 2, user: stranger });
    const goalId = await createGoalOrThrow({
      accessToken: stranger.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Hijacked" });

    expect(response.status).toBe(404);
  });
});

describe("POST /api/goals/:goalId/archive", () => {
  it("keeps the original archivedAt when archived twice", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const first = await request(app.getHttpServer())
      .post(`/api/goals/${goalId}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    const second = await request(app.getHttpServer())
      .post(`/api/goals/${goalId}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(second.status).toBe(200);
    expect(second.body.archivedAt).toBe(first.body.archivedAt);
  });

  it("returns 404 for a goal owned by another user", async () => {
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const listId = await seedList({ bookCount: 2, user: stranger });
    const goalId = await createGoalOrThrow({
      accessToken: stranger.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await request(app.getHttpServer())
      .post(`/api/goals/${goalId}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/goals/:goalId", () => {
  it("removes the goal and then reports it as gone", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });

    const deleted = await request(app.getHttpServer())
      .delete(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    const reread = await getGoal({ accessToken: owner.accessToken, goalId });

    expect(deleted.status).toBe(204);
    expect(reread.status).toBe(404);
  });

  it("returns 404 for a goal owned by another user", async () => {
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const listId = await seedList({ bookCount: 2, user: stranger });
    const goalId = await createGoalOrThrow({
      accessToken: stranger.accessToken,
      listId,
      targetCount: 2,
    });

    const response = await request(app.getHttpServer())
      .delete(`/api/goals/${goalId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(response.status).toBe(404);
  });
});

describe("list and user lifecycle", () => {
  it("keeps the goal row while its list only sits in the trash", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    await createGoalOrThrow({ accessToken: owner.accessToken, listId, targetCount: 2 });

    await lifecycle.softDelete({ listId, userId: owner.userId });

    expect(await prisma.readingGoal.count({ where: { listId } })).toBe(1);
  });

  it("serves the goal again once its list is restored from the trash", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    const goalId = await createGoalOrThrow({
      accessToken: owner.accessToken,
      listId,
      targetCount: 2,
    });
    await lifecycle.softDelete({ listId, userId: owner.userId });

    await lifecycle.restore({ listId, userId: owner.userId });
    const response = await getListGoal({ accessToken: owner.accessToken, listId });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(goalId);
  });

  it("purges the goal together with its list", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    await createGoalOrThrow({ accessToken: owner.accessToken, listId, targetCount: 2 });
    await lifecycle.softDelete({ listId, userId: owner.userId });
    await prisma.bookList.update({
      data: { purgeAt: subDays(new Date(), 1) },
      where: { id: listId },
    });

    await lifecycle.purge({ listId, userId: owner.userId });

    expect(await prisma.readingGoal.count({ where: { listId } })).toBe(0);
  });

  it("removes the goals of a deleted user", async () => {
    const listId = await seedList({ bookCount: 2, user: owner });
    await createGoalOrThrow({ accessToken: owner.accessToken, listId, targetCount: 2 });

    await prisma.user.delete({ where: { id: owner.userId } });

    expect(await prisma.readingGoal.count({ where: { userId: owner.userId } })).toBe(0);
  });
});

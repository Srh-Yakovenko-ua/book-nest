import type { INestApplication } from "@nestjs/common";

import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

type ListMembershipResult = {
  bookCount: number;
  id: string;
  isMember: boolean;
  name: string;
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule]);
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(() => {
  context.reset();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function createBook(userId: string, title?: string): Promise<string> {
  const book = await prisma.book.create({
    data: {
      firstAuthorName: "",
      readingStatus: "not_started",
      title: title ?? `Book ${randomUUID()}`,
      userId,
    },
  });
  return book.id;
}

async function createList(userId: string, name: string): Promise<string> {
  const created = await prisma.bookList.create({
    data: { name, normalizedName: name.trim().toLowerCase(), userId },
  });
  return created.id;
}

function getLists(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books/${bookId}/lists`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function positionsOf(listId: string): Promise<Array<{ bookId: string; position: number }>> {
  return prisma.bookListItem.findMany({
    orderBy: { position: "asc" },
    select: { bookId: true, position: true },
    where: { listId },
  });
}

async function seedItem(listId: string, bookId: string, position: number): Promise<void> {
  await prisma.bookListItem.create({ data: { bookId, listId, position } });
}

function setLists(accessToken: string, bookId: string, listIds: string[]): request.Test {
  return request(app.getHttpServer())
    .put(`/api/books/${bookId}/lists`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ listIds });
}

async function stampOldUpdatedAt(listId: string): Promise<Date> {
  const old = new Date("2020-01-01T00:00:00.000Z");
  await prisma.$executeRaw`UPDATE book_lists SET updated_at = ${old} WHERE id::text = ${listId}`;
  return old;
}

async function updatedAtOf(listId: string): Promise<Date> {
  const list = await prisma.bookList.findUniqueOrThrow({ where: { id: listId } });
  return list.updatedAt;
}

describe("GET /api/books/:bookId/lists", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(`/api/books/${randomUUID()}/lists`);

    expect(res.status).toBe(401);
  });

  it("returns 404 when the book does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getLists(accessToken, MISSING_UUID);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a book owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignBook = await createBook(stranger.userId);

    const res = await getLists(owner.accessToken, foreignBook);

    expect(res.status).toBe(404);
  });

  it("returns every list with membership flags and sizes ordered by name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const book = await createBook(userId, "Target");
    const other = await createBook(userId, "Other");
    const alpha = await createList(userId, "Alpha");
    const beta = await createList(userId, "Beta");
    const gamma = await createList(userId, "Gamma");
    await seedItem(alpha, book, 1);
    await seedItem(beta, other, 1);
    await seedItem(beta, book, 2);

    const res = await getLists(accessToken, book);

    expect(res.status).toBe(200);
    expect(res.body.lists).toEqual<ListMembershipResult[]>([
      { bookCount: 1, id: alpha, isMember: true, name: "Alpha" },
      { bookCount: 2, id: beta, isMember: true, name: "Beta" },
      { bookCount: 0, id: gamma, isMember: false, name: "Gamma" },
    ]);
  });

  it("does not include another user's lists", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const book = await createBook(owner.userId);
    const ownList = await createList(owner.userId, "Mine");
    await createList(stranger.userId, "Theirs");

    const res = await getLists(owner.accessToken, book);

    expect(res.status).toBe(200);
    expect(res.body.lists).toEqual<ListMembershipResult[]>([
      { bookCount: 0, id: ownList, isMember: false, name: "Mine" },
    ]);
  });
});

describe("PUT /api/books/:bookId/lists", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/books/${randomUUID()}/lists`)
      .send({ listIds: [] });

    expect(res.status).toBe(401);
  });

  it("returns 404 when the book does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await setLists(accessToken, MISSING_UUID, []);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a book owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignBook = await createBook(stranger.userId);
    const listId = await createList(owner.userId, "Mine");

    const res = await setLists(owner.accessToken, foreignBook, [listId]);

    expect(res.status).toBe(404);
  });

  it("returns 400 when listIds exceeds the maximum", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const book = await createBook(userId);
    const tooMany = Array.from({ length: 101 }, () => randomUUID());

    const res = await setLists(accessToken, book, tooMany);

    expect(res.status).toBe(400);
  });

  it("adds the book to newly selected lists appended at each list's end", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const book = await createBook(userId, "Target");
    const existingMember = await createBook(userId, "Existing");
    const alpha = await createList(userId, "Alpha");
    const beta = await createList(userId, "Beta");
    await seedItem(alpha, existingMember, 1);

    const res = await setLists(accessToken, book, [alpha, beta]);

    expect(res.status).toBe(200);
    expect(res.body.lists).toEqual<ListMembershipResult[]>([
      { bookCount: 2, id: alpha, isMember: true, name: "Alpha" },
      { bookCount: 1, id: beta, isMember: true, name: "Beta" },
    ]);
    expect(await positionsOf(alpha)).toEqual([
      { bookId: existingMember, position: 1 },
      { bookId: book, position: 2 },
    ]);
    expect(await positionsOf(beta)).toEqual([{ bookId: book, position: 1 }]);
  });

  it("removes the book from deselected lists and re-sequences them gaplessly", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const book = await createBook(userId, "Target");
    const before = await createBook(userId, "Before");
    const after = await createBook(userId, "After");
    const listId = await createList(userId, "List");
    await seedItem(listId, before, 1);
    await seedItem(listId, book, 2);
    await seedItem(listId, after, 3);

    const res = await setLists(accessToken, book, []);

    expect(res.status).toBe(200);
    expect(res.body.lists).toEqual<ListMembershipResult[]>([
      { bookCount: 2, id: listId, isMember: false, name: "List" },
    ]);
    expect(await positionsOf(listId)).toEqual([
      { bookId: before, position: 1 },
      { bookId: after, position: 2 },
    ]);
  });

  it("applies additions and removals together", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const book = await createBook(userId, "Target");
    const keep = await createList(userId, "Keep");
    const drop = await createList(userId, "Drop");
    const add = await createList(userId, "Add");
    await seedItem(keep, book, 1);
    await seedItem(drop, book, 1);

    const res = await setLists(accessToken, book, [keep, add]);

    expect(res.status).toBe(200);
    expect(res.body.lists).toEqual<ListMembershipResult[]>([
      { bookCount: 1, id: add, isMember: true, name: "Add" },
      { bookCount: 0, id: drop, isMember: false, name: "Drop" },
      { bookCount: 1, id: keep, isMember: true, name: "Keep" },
    ]);
    expect(await positionsOf(add)).toEqual([{ bookId: book, position: 1 }]);
    expect(await positionsOf(drop)).toEqual([]);
    expect(await positionsOf(keep)).toEqual([{ bookId: book, position: 1 }]);
  });

  it("is a no-op when the desired set matches the current set", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const book = await createBook(userId);
    const listId = await createList(userId, "List");
    await seedItem(listId, book, 1);
    const before = await stampOldUpdatedAt(listId);

    const res = await setLists(accessToken, book, [listId]);

    expect(res.status).toBe(200);
    expect(await positionsOf(listId)).toEqual([{ bookId: book, position: 1 }]);
    expect((await updatedAtOf(listId)).getTime()).toBe(before.getTime());
  });

  it("silently ignores list ids owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const book = await createBook(owner.userId);
    const ownList = await createList(owner.userId, "Mine");
    const foreignList = await createList(stranger.userId, "Theirs");

    const res = await setLists(owner.accessToken, book, [ownList, foreignList]);

    expect(res.status).toBe(200);
    expect(res.body.lists).toEqual<ListMembershipResult[]>([
      { bookCount: 1, id: ownList, isMember: true, name: "Mine" },
    ]);
    expect(await positionsOf(foreignList)).toEqual([]);
  });

  it("leaves other books' memberships in affected lists untouched", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const book = await createBook(userId, "Target");
    const neighbor = await createBook(userId, "Neighbor");
    const listId = await createList(userId, "List");
    await seedItem(listId, neighbor, 1);

    await setLists(accessToken, book, [listId]).expect(200);

    expect(await positionsOf(listId)).toEqual([
      { bookId: neighbor, position: 1 },
      { bookId: book, position: 2 },
    ]);
  });

  it("advances updatedAt only on affected lists", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const book = await createBook(userId);
    const affected = await createList(userId, "Affected");
    const untouched = await createList(userId, "Untouched");
    const affectedBefore = await stampOldUpdatedAt(affected);
    const untouchedBefore = await stampOldUpdatedAt(untouched);

    await setLists(accessToken, book, [affected]).expect(200);

    expect((await updatedAtOf(affected)).getTime()).toBeGreaterThan(affectedBefore.getTime());
    expect((await updatedAtOf(untouched)).getTime()).toBe(untouchedBefore.getTime());
  });
});

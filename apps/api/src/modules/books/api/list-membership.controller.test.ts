import type { AddBooksToListInput } from "@app/shared";
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

type ListOfFive = {
  books: { a: string; b: string; c: string; d: string; e: string };
  listId: string;
};

type RankedBook = { id: string; position: number };

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

function addBooks(accessToken: string, listId: string, bookIds: string[]): request.Test {
  return request(app.getHttpServer())
    .post(`/api/lists/${listId}/books`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ bookIds });
}

function addBooksWith(
  accessToken: string,
  listId: string,
  body: AddBooksToListInput,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/lists/${listId}/books`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

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

async function createList(userId: string, name = "My list"): Promise<string> {
  const created = await prisma.bookList.create({
    data: { name, normalizedName: name.trim().toLowerCase(), userId },
  });
  return created.id;
}

function moveBook(
  accessToken: string,
  listId: string,
  bookId: string,
  direction: "down" | "up",
): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/lists/${listId}/books/${bookId}/position`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ direction, kind: "step" });
}

async function orderedBookIds(listId: string): Promise<string[]> {
  const items = await positionsOf(listId);
  return items.map((item) => item.bookId);
}

async function positionsOf(listId: string): Promise<Array<{ bookId: string; position: number }>> {
  const items = await prisma.bookListItem.findMany({
    orderBy: { position: "asc" },
    select: { bookId: true, position: true },
    where: { listId },
  });
  return items;
}

async function rankedBooksOf(accessToken: string, listId: string): Promise<RankedBook[]> {
  const res = await request(app.getHttpServer())
    .get(`/api/lists/${listId}`)
    .query({ sort: "position" })
    .set("Authorization", `Bearer ${accessToken}`)
    .expect(200);
  const items: RankedBook[] = res.body.books.items;
  return items.map(({ id, position }) => ({ id, position }));
}

function removeBook(accessToken: string, listId: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .delete(`/api/lists/${listId}/books/${bookId}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function seedItem(listId: string, bookId: string, position: number): Promise<void> {
  await prisma.bookListItem.create({ data: { bookId, listId, position } });
}

async function seedListOfFive(userId: string): Promise<ListOfFive> {
  const listId = await createList(userId);
  const books = {
    a: await createBook(userId, "A"),
    b: await createBook(userId, "B"),
    c: await createBook(userId, "C"),
    d: await createBook(userId, "D"),
    e: await createBook(userId, "E"),
  };
  await seedItem(listId, books.a, 1);
  await seedItem(listId, books.b, 2);
  await seedItem(listId, books.c, 3);
  await seedItem(listId, books.d, 4);
  await seedItem(listId, books.e, 5);
  return { books, listId };
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

describe("POST /api/lists/:listId/books", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/lists/${randomUUID()}/books`)
      .send({ bookIds: [randomUUID()] });

    expect(res.status).toBe(401);
  });

  it("returns 404 when the list does not exist", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bookId = await createBook(userId);

    const res = await addBooks(accessToken, MISSING_UUID, [bookId]);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a list owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignListId = await createList(stranger.userId, "Secret");
    const bookId = await createBook(owner.userId);

    const res = await addBooks(owner.accessToken, foreignListId, [bookId]);

    expect(res.status).toBe(404);
  });

  it("returns 400 when bookIds is empty", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);

    const res = await addBooks(accessToken, listId, []);

    expect(res.status).toBe(400);
  });

  it("returns 400 when bookIds exceeds the maximum", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const tooMany = Array.from({ length: 101 }, () => randomUUID());

    const res = await addBooks(accessToken, listId, tooMany);

    expect(res.status).toBe(400);
  });

  it("appends owned books at the end preserving the selection order", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const first = await createBook(userId, "First");
    const second = await createBook(userId, "Second");
    const third = await createBook(userId, "Third");

    const res = await addBooks(accessToken, listId, [third, first, second]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ added: 3, bookCount: 3 });
    expect(await orderedBookIds(listId)).toEqual([third, first, second]);
    expect((await positionsOf(listId)).map((item) => item.position)).toEqual([1, 2, 3]);
  });

  it("appends after existing members without disturbing them", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const existing = await createBook(userId, "Existing");
    await seedItem(listId, existing, 1);
    const next = await createBook(userId, "Next");

    const res = await addBooks(accessToken, listId, [next]);

    expect(res.body).toEqual({ added: 1, bookCount: 2 });
    expect(await positionsOf(listId)).toEqual([
      { bookId: existing, position: 1 },
      { bookId: next, position: 2 },
    ]);
  });

  it("is idempotent for books that are already members", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const member = await createBook(userId, "Member");
    await seedItem(listId, member, 1);
    const fresh = await createBook(userId, "Fresh");

    const res = await addBooks(accessToken, listId, [member, fresh]);

    expect(res.body).toEqual({ added: 1, bookCount: 2 });
    expect(await positionsOf(listId)).toEqual([
      { bookId: member, position: 1 },
      { bookId: fresh, position: 2 },
    ]);
  });

  it("silently ignores book ids owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const listId = await createList(owner.userId);
    const ownedBook = await createBook(owner.userId, "Owned");
    const foreignBook = await createBook(stranger.userId, "Foreign");

    const res = await addBooks(owner.accessToken, listId, [ownedBook, foreignBook]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ added: 1, bookCount: 1 });
    expect(await orderedBookIds(listId)).toEqual([ownedBook]);
  });

  it("silently ignores non-existent book ids", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const ownedBook = await createBook(userId);

    const res = await addBooks(accessToken, listId, [ownedBook, randomUUID()]);

    expect(res.body).toEqual({ added: 1, bookCount: 1 });
    expect(await orderedBookIds(listId)).toEqual([ownedBook]);
  });

  it("advances the list updatedAt after an add", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const bookId = await createBook(userId);
    const before = await stampOldUpdatedAt(listId);

    await addBooks(accessToken, listId, [bookId]).expect(200);

    const after = await updatedAtOf(listId);
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it("leaves the list updatedAt untouched when every book is already a member", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const member = await createBook(userId, "Member");
    await seedItem(listId, member, 1);
    const before = await stampOldUpdatedAt(listId);

    const res = await addBooks(accessToken, listId, [member]);

    expect(res.body).toEqual({ added: 0, bookCount: 1 });
    const after = await updatedAtOf(listId);
    expect(after.getTime()).toBe(before.getTime());
  });
});

describe("DELETE /api/lists/:listId/books/:bookId", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).delete(
      `/api/lists/${randomUUID()}/books/${randomUUID()}`,
    );

    expect(res.status).toBe(401);
  });

  it("returns 404 for a list owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignListId = await createList(stranger.userId, "Secret");
    const foreignBook = await createBook(stranger.userId);
    await seedItem(foreignListId, foreignBook, 1);

    const res = await removeBook(owner.accessToken, foreignListId, foreignBook);

    expect(res.status).toBe(404);
  });

  it("returns 404 when the book is not a member of the list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const bookId = await createBook(userId);

    const res = await removeBook(accessToken, listId, bookId);

    expect(res.status).toBe(404);
  });

  it("removes the book and re-sequences remaining positions gaplessly", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const a = await createBook(userId, "A");
    const b = await createBook(userId, "B");
    const c = await createBook(userId, "C");
    const d = await createBook(userId, "D");
    await seedItem(listId, a, 1);
    await seedItem(listId, b, 2);
    await seedItem(listId, c, 3);
    await seedItem(listId, d, 4);

    const res = await removeBook(accessToken, listId, b);

    expect(res.status).toBe(204);
    expect(await positionsOf(listId)).toEqual([
      { bookId: a, position: 1 },
      { bookId: c, position: 2 },
      { bookId: d, position: 3 },
    ]);
  });

  it("leaves the book and its membership in other lists untouched", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listA = await createList(userId, "List A");
    const listB = await createList(userId, "List B");
    const bookId = await createBook(userId);
    await seedItem(listA, bookId, 1);
    await seedItem(listB, bookId, 1);

    await removeBook(accessToken, listA, bookId).expect(204);

    expect(await orderedBookIds(listA)).toEqual([]);
    expect(await orderedBookIds(listB)).toEqual([bookId]);
    expect(await prisma.book.findUnique({ where: { id: bookId } })).not.toBeNull();
  });

  it("advances the list updatedAt after a removal", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const bookId = await createBook(userId);
    await seedItem(listId, bookId, 1);
    const before = await stampOldUpdatedAt(listId);

    await removeBook(accessToken, listId, bookId).expect(204);

    const after = await updatedAtOf(listId);
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });
});

describe("PATCH /api/lists/:listId/books/:bookId/position", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/lists/${randomUUID()}/books/${randomUUID()}/position`)
      .send({ direction: "up", kind: "step" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid direction", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const bookId = await createBook(userId);
    await seedItem(listId, bookId, 1);

    const res = await request(app.getHttpServer())
      .patch(`/api/lists/${listId}/books/${bookId}/position`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ direction: "sideways", kind: "step" });

    expect(res.status).toBe(400);
  });

  it("returns 404 for a list owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignListId = await createList(stranger.userId, "Secret");
    const foreignBook = await createBook(stranger.userId);
    await seedItem(foreignListId, foreignBook, 1);

    const res = await moveBook(owner.accessToken, foreignListId, foreignBook, "up");

    expect(res.status).toBe(404);
  });

  it("returns 404 when the book is not a member of the list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const bookId = await createBook(userId);

    const res = await moveBook(accessToken, listId, bookId, "up");

    expect(res.status).toBe(404);
  });

  it("moves a book up by swapping it with its predecessor", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const a = await createBook(userId, "A");
    const b = await createBook(userId, "B");
    const c = await createBook(userId, "C");
    await seedItem(listId, a, 1);
    await seedItem(listId, b, 2);
    await seedItem(listId, c, 3);

    const res = await moveBook(accessToken, listId, b, "up");

    expect(res.status).toBe(204);
    expect(await positionsOf(listId)).toEqual([
      { bookId: b, position: 1 },
      { bookId: a, position: 2 },
      { bookId: c, position: 3 },
    ]);
  });

  it("moves a book down by swapping it with its successor", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const a = await createBook(userId, "A");
    const b = await createBook(userId, "B");
    const c = await createBook(userId, "C");
    await seedItem(listId, a, 1);
    await seedItem(listId, b, 2);
    await seedItem(listId, c, 3);

    const res = await moveBook(accessToken, listId, b, "down");

    expect(res.status).toBe(204);
    expect(await positionsOf(listId)).toEqual([
      { bookId: a, position: 1 },
      { bookId: c, position: 2 },
      { bookId: b, position: 3 },
    ]);
  });

  it("returns 400 when moving the first book up", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const a = await createBook(userId, "A");
    const b = await createBook(userId, "B");
    await seedItem(listId, a, 1);
    await seedItem(listId, b, 2);

    const res = await moveBook(accessToken, listId, a, "up");

    expect(res.status).toBe(400);
    expect(await positionsOf(listId)).toEqual([
      { bookId: a, position: 1 },
      { bookId: b, position: 2 },
    ]);
  });

  it("returns 400 when moving the last book down", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const a = await createBook(userId, "A");
    const b = await createBook(userId, "B");
    await seedItem(listId, a, 1);
    await seedItem(listId, b, 2);

    const res = await moveBook(accessToken, listId, b, "down");

    expect(res.status).toBe(400);
    expect(await positionsOf(listId)).toEqual([
      { bookId: a, position: 1 },
      { bookId: b, position: 2 },
    ]);
  });

  it("advances the list updatedAt after a move", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const a = await createBook(userId, "A");
    const b = await createBook(userId, "B");
    await seedItem(listId, a, 1);
    await seedItem(listId, b, 2);
    const before = await stampOldUpdatedAt(listId);

    await moveBook(accessToken, listId, b, "up").expect(204);

    const after = await updatedAtOf(listId);
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });
});

describe("POST /api/lists/:listId/books restoring positions", () => {
  it("puts a removed book back at its old position when re-added with that position", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { books, listId } = await seedListOfFive(userId);
    await removeBook(accessToken, listId, books.b).expect(204);

    const res = await addBooksWith(accessToken, listId, {
      bookIds: [books.b],
      positions: [{ bookId: books.b, position: 2 }],
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ added: 1, bookCount: 5 });
    expect(await rankedBooksOf(accessToken, listId)).toEqual<RankedBook[]>([
      { id: books.a, position: 1 },
      { id: books.b, position: 2 },
      { id: books.c, position: 3 },
      { id: books.d, position: 4 },
      { id: books.e, position: 5 },
    ]);
  });

  it("stores gapless positions 1..n after restoring a book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { books, listId } = await seedListOfFive(userId);
    await removeBook(accessToken, listId, books.b).expect(204);

    await addBooksWith(accessToken, listId, {
      bookIds: [books.b],
      positions: [{ bookId: books.b, position: 2 }],
    }).expect(200);

    expect(await positionsOf(listId)).toEqual([
      { bookId: books.a, position: 1 },
      { bookId: books.b, position: 2 },
      { bookId: books.c, position: 3 },
      { bookId: books.d, position: 4 },
      { bookId: books.e, position: 5 },
    ]);
  });

  it("appends a re-added book at the end when no positions are sent", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { books, listId } = await seedListOfFive(userId);
    await removeBook(accessToken, listId, books.b).expect(204);

    const res = await addBooksWith(accessToken, listId, { bookIds: [books.b] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ added: 1, bookCount: 5 });
    expect(await rankedBooksOf(accessToken, listId)).toEqual<RankedBook[]>([
      { id: books.a, position: 1 },
      { id: books.c, position: 2 },
      { id: books.d, position: 3 },
      { id: books.e, position: 4 },
      { id: books.b, position: 5 },
    ]);
  });

  it("returns 400 when a positions entry names a book that is not in bookIds", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const added = await createBook(userId, "Added");
    const stray = await createBook(userId, "Stray");

    const res = await addBooksWith(accessToken, listId, {
      bookIds: [added],
      positions: [{ bookId: stray, position: 1 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "positions.0.bookId" })]),
    );
  });

  it("returns 400 when two positions entries name the same book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId);
    const added = await createBook(userId, "Added");

    const res = await addBooksWith(accessToken, listId, {
      bookIds: [added],
      positions: [
        { bookId: added, position: 1 },
        { bookId: added, position: 2 },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "positions.1.bookId" })]),
    );
  });
});

import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookListItemModel } from "../../../generated/prisma/models.js";
import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { OpenLibraryAuthorDetail } from "../../authors/infrastructure/open-library.client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { OpenLibraryClient } from "../../authors/infrastructure/open-library.client.js";
import { WikidataClient } from "../../authors/infrastructure/wikidata.client.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

const getAuthorByKey = vi.fn<(olid: string) => Promise<Nullable<OpenLibraryAuthorDetail>>>();
const getAuthorFactsByQid = vi.fn().mockResolvedValue(null);

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext(
    [AuthModule, BooksModule, ListsModule],
    [
      { provide: OpenLibraryClient, useValue: { getAuthorByKey } },
      { provide: WikidataClient, useValue: { getAuthorFactsByQid } },
    ],
  );
  app = context.app;
  prisma = app.get(PrismaService);
});

beforeEach(() => {
  context.reset();
  getAuthorByKey.mockReset();
  getAuthorByKey.mockResolvedValue(null);
  getAuthorFactsByQid.mockReset();
  getAuthorFactsByQid.mockResolvedValue(null);
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function createBooksInList<const Titles extends readonly string[]>(
  accessToken: string,
  listId: string,
  titles: Titles,
): Promise<{ [Index in keyof Titles]: string }> {
  const ids: string[] = [];
  for (const title of titles) {
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [listId],
      title,
    });
    ids.push(created.body.id);
  }
  return ids as { [Index in keyof Titles]: string };
}

function createList(userId: string, name: string): Promise<{ id: string }> {
  return prisma.bookList.create({
    data: { name, normalizedName: name.toLowerCase(), userId },
    select: { id: true },
  });
}

function detailOf(accessToken: string, listId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/lists/${listId}?sort=position`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function displayedBooks(
  accessToken: string,
  listId: string,
): Promise<Array<{ id: string; position: number }>> {
  const res = await detailOf(accessToken, listId);
  expect(res.status).toBe(200);
  return res.body.books.items.map((item: { id: string; position: number }) => ({
    id: item.id,
    position: item.position,
  }));
}

function membership(bookId: string, listId: string): Promise<Nullable<BookListItemModel>> {
  return prisma.bookListItem.findUnique({ where: { listId_bookId: { bookId, listId } } });
}

function moveBook(
  accessToken: string,
  listId: string,
  bookId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/lists/${listId}/books/${bookId}/position`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function positionsOf(listId: string): Promise<Array<{ bookId: string; position: number }>> {
  return prisma.bookListItem.findMany({
    orderBy: { position: "asc" },
    select: { bookId: true, position: true },
    where: { listId },
  });
}

async function stampOldUpdatedAt(listId: string): Promise<Date> {
  const old = new Date("2020-01-01T00:00:00.000Z");
  await prisma.$executeRaw`UPDATE book_lists SET updated_at = ${old} WHERE id::text = ${listId}`;
  return old;
}

function trashBook(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .delete(`/api/books/${bookId}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function updateBook(accessToken: string, id: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/books/${id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function updatedAtOf(listId: string): Promise<Date> {
  const list = await prisma.bookList.findUniqueOrThrow({ where: { id: listId } });
  return list.updatedAt;
}

describe("book_list_items ordering on create", () => {
  it("assigns the first membership of a list position 1 and appends the next at the end", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const list = await createList(userId, "Gifts");

    const first = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [list.id],
      title: "Dune",
    });
    const second = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [list.id],
      title: "Dune Messiah",
    });

    expect((await membership(first.body.id, list.id))?.position).toBe(1);
    expect((await membership(second.body.id, list.id))?.position).toBe(2);
  });

  it("scopes position independently per list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const autumn = await createList(userId, "Autumn");

    await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [gifts.id],
      title: "Dune",
    });
    const second = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [autumn.id, gifts.id],
      title: "Dune Messiah",
    });

    expect((await membership(second.body.id, gifts.id))?.position).toBe(2);
    expect((await membership(second.body.id, autumn.id))?.position).toBe(1);
  });
});

describe("book_list_items ordering on update", () => {
  it("keeps the position and addedAt of an unchanged membership and appends only new lists", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const autumn = await createList(userId, "Autumn");

    await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [gifts.id],
      title: "Filler",
    });
    const tracked = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [gifts.id],
      title: "Dune",
    });
    const before = await membership(tracked.body.id, gifts.id);
    expect(before?.position).toBe(2);

    const res = await updateBook(accessToken, tracked.body.id, {
      listIds: [autumn.id, gifts.id],
    });

    expect(res.status).toBe(200);
    const keptGifts = await membership(tracked.body.id, gifts.id);
    const newAutumn = await membership(tracked.body.id, autumn.id);
    expect(keptGifts?.position).toBe(2);
    expect(keptGifts?.addedAt.getTime()).toBe(before?.addedAt.getTime());
    expect(newAutumn?.position).toBe(1);
  });

  it("removes delisted memberships while leaving the kept membership untouched", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const autumn = await createList(userId, "Autumn");
    const tracked = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [gifts.id, autumn.id],
      title: "Dune",
    });
    const beforeAutumn = await membership(tracked.body.id, autumn.id);

    const res = await updateBook(accessToken, tracked.body.id, { listIds: [autumn.id] });

    expect(res.status).toBe(200);
    expect(await membership(tracked.body.id, gifts.id)).toBeNull();
    const keptAutumn = await membership(tracked.body.id, autumn.id);
    expect(keptAutumn?.position).toBe(beforeAutumn?.position);
    expect(keptAutumn?.addedAt.getTime()).toBe(beforeAutumn?.addedAt.getTime());
  });

  it("does not renumber or duplicate a membership that is already present", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const tracked = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [gifts.id],
      title: "Dune",
    });
    const before = await membership(tracked.body.id, gifts.id);

    const res = await updateBook(accessToken, tracked.body.id, { listIds: [gifts.id] });

    expect(res.status).toBe(200);
    const after = await membership(tracked.body.id, gifts.id);
    expect(after?.position).toBe(before?.position);
    expect(after?.addedAt.getTime()).toBe(before?.addedAt.getTime());
    const items = await prisma.bookListItem.findMany({ where: { bookId: tracked.body.id } });
    expect(items).toHaveLength(1);
  });

  it("re-sequences remaining positions gaplessly when a middle book is delisted", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const first = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [gifts.id],
      title: "First",
    });
    const middle = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [gifts.id],
      title: "Middle",
    });
    const last = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [gifts.id],
      title: "Last",
    });

    const res = await updateBook(accessToken, middle.body.id, { listIds: [] });

    expect(res.status).toBe(200);
    expect(await membership(middle.body.id, gifts.id)).toBeNull();
    expect(await positionsOf(gifts.id)).toEqual([
      { bookId: first.body.id, position: 1 },
      { bookId: last.body.id, position: 2 },
    ]);
  });
});

describe("book_lists updatedAt on membership writes via the book form", () => {
  it("advances the list updatedAt when a book is added on create", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const before = await stampOldUpdatedAt(gifts.id);

    await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [gifts.id],
      title: "Dune",
    });

    const after = await updatedAtOf(gifts.id);
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it("advances the list updatedAt when a book is added on update", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const book = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const before = await stampOldUpdatedAt(gifts.id);

    await updateBook(accessToken, book.body.id, { listIds: [gifts.id] }).expect(200);

    const after = await updatedAtOf(gifts.id);
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it("advances the list updatedAt when a book is removed on update", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const book = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [gifts.id],
      title: "Dune",
    });
    const before = await stampOldUpdatedAt(gifts.id);

    await updateBook(accessToken, book.body.id, { listIds: [] }).expect(200);

    const after = await updatedAtOf(gifts.id);
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });
});

describe("GET /api/lists/:listId display numbering after a book is trashed", () => {
  it("numbers the surviving books without a gap while the stored positions keep the hole", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [first, second, third, fourth] = await createBooksInList(accessToken, gifts.id, [
      "Dune",
      "Dune Messiah",
      "Children of Dune",
      "God Emperor of Dune",
    ]);

    await trashBook(accessToken, second).expect(200);

    const stored = await positionsOf(gifts.id);
    expect(stored).toEqual([
      { bookId: first, position: 1 },
      { bookId: second, position: 2 },
      { bookId: third, position: 3 },
      { bookId: fourth, position: 4 },
    ]);
    expect(stored.filter((item) => item.bookId !== second).map((item) => item.position)).toEqual([
      1, 3, 4,
    ]);
    expect(await displayedBooks(accessToken, gifts.id)).toEqual([
      { id: first, position: 1 },
      { id: third, position: 2 },
      { id: fourth, position: 3 },
    ]);
  });

  it("numbers the surviving books from 1 when the trashed book was the first one", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [first, second, third] = await createBooksInList(accessToken, gifts.id, [
      "Dune",
      "Dune Messiah",
      "Children of Dune",
    ]);

    await trashBook(accessToken, first).expect(200);

    expect(await displayedBooks(accessToken, gifts.id)).toEqual([
      { id: second, position: 1 },
      { id: third, position: 2 },
    ]);
  });

  it("restores the trashed book to its stored slot in the display numbering", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [first, second, third] = await createBooksInList(accessToken, gifts.id, [
      "Dune",
      "Dune Messiah",
      "Children of Dune",
    ]);
    await trashBook(accessToken, second).expect(200);

    await request(app.getHttpServer())
      .post(`/api/books/${second}/restore`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    expect(await displayedBooks(accessToken, gifts.id)).toEqual([
      { id: first, position: 1 },
      { id: second, position: 2 },
      { id: third, position: 3 },
    ]);
  });
});

describe("PATCH /api/lists/:listId/books/:bookId/position to an explicit index", () => {
  it("moves the first book to the last slot and leaves the stored positions dense", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [first, second, third] = await createBooksInList(accessToken, gifts.id, [
      "Dune",
      "Dune Messiah",
      "Children of Dune",
    ]);

    const res = await moveBook(accessToken, gifts.id, first, { kind: "index", position: 3 });

    expect(res.status).toBe(204);
    expect(await positionsOf(gifts.id)).toEqual([
      { bookId: second, position: 1 },
      { bookId: third, position: 2 },
      { bookId: first, position: 3 },
    ]);
  });

  it("moves the last book to the first slot", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [first, second, third] = await createBooksInList(accessToken, gifts.id, [
      "Dune",
      "Dune Messiah",
      "Children of Dune",
    ]);

    await moveBook(accessToken, gifts.id, third, { kind: "index", position: 1 }).expect(204);

    expect(await displayedBooks(accessToken, gifts.id)).toEqual([
      { id: third, position: 1 },
      { id: first, position: 2 },
      { id: second, position: 3 },
    ]);
  });

  it("clips a position beyond the list length to the last slot", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [first, second, third] = await createBooksInList(accessToken, gifts.id, [
      "Dune",
      "Dune Messiah",
      "Children of Dune",
    ]);

    const res = await moveBook(accessToken, gifts.id, first, { kind: "index", position: 500 });

    expect(res.status).toBe(204);
    expect(await displayedBooks(accessToken, gifts.id)).toEqual([
      { id: second, position: 1 },
      { id: third, position: 2 },
      { id: first, position: 3 },
    ]);
  });

  it("closes the hole left by a trashed book when a surviving book is moved", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [first, second, third, fourth] = await createBooksInList(accessToken, gifts.id, [
      "Dune",
      "Dune Messiah",
      "Children of Dune",
      "God Emperor of Dune",
    ]);
    await trashBook(accessToken, second).expect(200);

    await moveBook(accessToken, gifts.id, fourth, { kind: "index", position: 1 }).expect(204);

    const stored = await positionsOf(gifts.id);
    expect(stored.filter((item) => item.bookId !== second)).toEqual([
      { bookId: fourth, position: 1 },
      { bookId: first, position: 2 },
      { bookId: third, position: 3 },
    ]);
  });

  it("returns 404 when the book is not in the list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    await createBooksInList(accessToken, gifts.id, ["Dune"]);
    const outsider = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Hyperion",
    });

    const res = await moveBook(accessToken, gifts.id, outsider.body.id, {
      kind: "index",
      position: 1,
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 for a list owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignList = await createList(stranger.userId, "Secret");
    const [foreignBook] = await createBooksInList(stranger.accessToken, foreignList.id, ["Dune"]);

    const res = await moveBook(owner.accessToken, foreignList.id, foreignBook, {
      kind: "index",
      position: 1,
    });

    expect(res.status).toBe(404);
  });

  it("leaves another user's list untouched when the move is rejected", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignList = await createList(stranger.userId, "Secret");
    const [foreignFirst, foreignSecond] = await createBooksInList(
      stranger.accessToken,
      foreignList.id,
      ["Dune", "Dune Messiah"],
    );

    await moveBook(owner.accessToken, foreignList.id, foreignSecond, {
      kind: "index",
      position: 1,
    });

    expect(await positionsOf(foreignList.id)).toEqual([
      { bookId: foreignFirst, position: 1 },
      { bookId: foreignSecond, position: 2 },
    ]);
  });

  it("returns 401 when no Authorization header is present", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [book] = await createBooksInList(accessToken, gifts.id, ["Dune"]);

    const res = await request(app.getHttpServer())
      .patch(`/api/lists/${gifts.id}/books/${book}/position`)
      .send({ kind: "index", position: 1 });

    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/lists/:listId/books/:bookId/position one step", () => {
  it("swaps the book with the one above it", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [first, second, third] = await createBooksInList(accessToken, gifts.id, [
      "Dune",
      "Dune Messiah",
      "Children of Dune",
    ]);

    const res = await moveBook(accessToken, gifts.id, second, { direction: "up", kind: "step" });

    expect(res.status).toBe(204);
    expect(await positionsOf(gifts.id)).toEqual([
      { bookId: second, position: 1 },
      { bookId: first, position: 2 },
      { bookId: third, position: 3 },
    ]);
  });

  it("swaps the book with the one below it", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [first, second] = await createBooksInList(accessToken, gifts.id, [
      "Dune",
      "Dune Messiah",
    ]);

    await moveBook(accessToken, gifts.id, first, { direction: "down", kind: "step" }).expect(204);

    expect(await positionsOf(gifts.id)).toEqual([
      { bookId: second, position: 1 },
      { bookId: first, position: 2 },
    ]);
  });

  it("returns 400 when the book is already at the top", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [first] = await createBooksInList(accessToken, gifts.id, ["Dune", "Dune Messiah"]);

    const res = await moveBook(accessToken, gifts.id, first, { direction: "up", kind: "step" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when the book is already at the bottom", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [, second] = await createBooksInList(accessToken, gifts.id, ["Dune", "Dune Messiah"]);

    const res = await moveBook(accessToken, gifts.id, second, { direction: "down", kind: "step" });

    expect(res.status).toBe(400);
  });

  it("returns 404 when the book is not in the list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    await createBooksInList(accessToken, gifts.id, ["Dune"]);
    const outsider = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Hyperion",
    });

    const res = await moveBook(accessToken, gifts.id, outsider.body.id, {
      direction: "up",
      kind: "step",
    });

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/lists/:listId/books/:bookId/position body validation", () => {
  it("returns 400 when the body carries both a direction and a position", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [book] = await createBooksInList(accessToken, gifts.id, ["Dune", "Dune Messiah"]);

    const res = await moveBook(accessToken, gifts.id, book, {
      direction: "down",
      kind: "step",
      position: 2,
    });

    expect(res.status).toBe(400);
  });

  it("keeps the stored positions untouched when the body carries both a direction and a position", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [first, second] = await createBooksInList(accessToken, gifts.id, [
      "Dune",
      "Dune Messiah",
    ]);

    await moveBook(accessToken, gifts.id, first, {
      direction: "down",
      kind: "step",
      position: 2,
    });

    expect(await positionsOf(gifts.id)).toEqual([
      { bookId: first, position: 1 },
      { bookId: second, position: 2 },
    ]);
  });

  it("returns 400 when the kind is missing", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [book] = await createBooksInList(accessToken, gifts.id, ["Dune", "Dune Messiah"]);

    const res = await moveBook(accessToken, gifts.id, book, { direction: "down" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when an index move carries a position of zero", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const gifts = await createList(userId, "Gifts");
    const [book] = await createBooksInList(accessToken, gifts.id, ["Dune", "Dune Messiah"]);

    const res = await moveBook(accessToken, gifts.id, book, { kind: "index", position: 0 });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "position" })]),
    );
  });
});

import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../lists.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, ListsModule]);
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

type CreateListInput = {
  createdAt?: Date;
  description?: string;
  name: string;
  updatedAt?: Date;
  userId: string;
};

async function addBookToList(listId: string, bookId: string, position: number): Promise<void> {
  await prisma.bookListItem.create({ data: { bookId, listId, position } });
}

async function createBook(
  userId: string,
  withCover: boolean,
): Promise<{ bookId: string; coverId: Nullable<string> }> {
  const coverId = withCover ? await createCover(userId) : null;
  const book = await prisma.book.create({
    data: { coverMediaId: coverId, title: `Book ${randomUUID()}`, userId },
  });
  return { bookId: book.id, coverId };
}

async function createCover(userId: string): Promise<string> {
  const asset = await prisma.mediaAsset.create({
    data: {
      contentType: "image/webp",
      height: 900,
      kind: "book_cover",
      sizeBytes: 1000,
      storageKey: `media/book_cover/${randomUUID()}/image.webp`,
      thumbGeneratedAt: new Date(),
      userId,
      width: 600,
    },
  });
  return asset.id;
}

async function createList({
  createdAt,
  description,
  name,
  updatedAt,
  userId,
}: CreateListInput): Promise<string> {
  const created = await prisma.bookList.create({
    data: {
      createdAt,
      description: description ?? null,
      name,
      normalizedName: name.trim().toLowerCase(),
      updatedAt,
      userId,
    },
  });
  return created.id;
}

function getLists(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/lists")
    .set("Authorization", `Bearer ${accessToken}`);
}

function getSummary(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/lists/summary")
    .set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/lists/summary", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/lists/summary");

    expect(res.status).toBe(401);
  });

  it("returns zeros when the user has no lists", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      averageBooksPerList: 0,
      emptyListCount: 0,
      largestListBookCount: 0,
      listsWithBooksCount: 0,
      maxListsPerBook: 0,
      multiListBookCount: 0,
      totalListCount: 0,
      totalMembershipCount: 0,
      uniqueBookCount: 0,
    });
  });

  it("counts every book once even when it belongs to several lists", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const wide = await createList({ name: "Wide", userId });
    const narrow = await createList({ name: "Narrow", userId });
    await createList({ name: "Empty", userId });

    const shared = await createBook(userId, false);
    const solo = await createBook(userId, false);
    await addBookToList(wide, shared.bookId, 0);
    await addBookToList(wide, solo.bookId, 1);
    await addBookToList(narrow, shared.bookId, 0);

    const res = await getSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      averageBooksPerList: 1,
      emptyListCount: 1,
      largestListBookCount: 2,
      listsWithBooksCount: 2,
      maxListsPerBook: 2,
      multiListBookCount: 1,
      totalListCount: 3,
      totalMembershipCount: 3,
      uniqueBookCount: 2,
    });
  });

  it("ignores trashed lists and trashed books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const kept = await createList({ name: "Kept", userId });
    const trashedList = await createList({ name: "Trashed", userId });

    const keptBook = await createBook(userId, false);
    const trashedBook = await createBook(userId, false);
    await addBookToList(kept, keptBook.bookId, 0);
    await addBookToList(kept, trashedBook.bookId, 1);
    await addBookToList(trashedList, keptBook.bookId, 0);

    await prisma.book.update({
      data: TRASH_RETENTION.stamp(),
      where: { id: trashedBook.bookId },
    });
    await prisma.bookList.update({
      data: TRASH_RETENTION.stamp(),
      where: { id: trashedList },
    });

    const res = await getSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      averageBooksPerList: 1,
      emptyListCount: 0,
      largestListBookCount: 1,
      listsWithBooksCount: 1,
      maxListsPerBook: 1,
      multiListBookCount: 0,
      totalListCount: 1,
      totalMembershipCount: 1,
      uniqueBookCount: 1,
    });
  });

  it("never counts another user's lists", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger-summary@example.com",
      nickname: "strangersummary",
    });
    const strangerList = await createList({ name: "Secret", userId: stranger.userId });
    const strangerBook = await createBook(stranger.userId, false);
    await addBookToList(strangerList, strangerBook.bookId, 0);
    await createList({ name: "Owned", userId: owner.userId });

    const res = await getSummary(owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalListCount: 1,
      totalMembershipCount: 0,
      uniqueBookCount: 0,
    });
  });
});

describe("POST /api/lists", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/lists")
      .send({ name: "Autumn reads" });

    expect(res.status).toBe(401);
  });

  it("creates a list and returns a card with zero count and no covers", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .post("/api/lists")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ description: "cozy", name: "Autumn reads" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      bookCount: 0,
      createdAt: expect.any(String),
      description: "cozy",
      id: expect.any(String),
      name: "Autumn reads",
      previewCovers: [],
      updatedAt: expect.any(String),
    });
  });

  it("returns 409 when a list with the same normalized name exists", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createList({ name: "Autumn reads", userId });

    const res = await request(app.getHttpServer())
      .post("/api/lists")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "  autumn   READS " });

    expect(res.status).toBe(409);
  });

  it("returns 400 when the name is too short", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .post("/api/lists")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "a" });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/lists/:listId", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/lists/${randomUUID()}`)
      .send({ name: "Autumn reads" });

    expect(res.status).toBe(401);
  });

  it("renames a list and clears the description when it is omitted", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList({ description: "cozy", name: "Autumn reads", userId });

    const res = await request(app.getHttpServer())
      .patch(`/api/lists/${listId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Winter reads" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ description: null, id: listId, name: "Winter reads" });
  });

  it("does not error when the title is unchanged on the same list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList({ name: "Autumn reads", userId });

    const res = await request(app.getHttpServer())
      .patch(`/api/lists/${listId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Autumn reads" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Autumn reads");
  });

  it("returns 409 when the new name collides with a different owned list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createList({ name: "Gifts", userId });
    const listId = await createList({ name: "Autumn reads", userId });

    const res = await request(app.getHttpServer())
      .patch(`/api/lists/${listId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "gifts" });

    expect(res.status).toBe(409);
  });

  it("returns 404 for a list owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignListId = await createList({ name: "Secret", userId: stranger.userId });

    const res = await request(app.getHttpServer())
      .patch(`/api/lists/${foreignListId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Renamed" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/lists/:listId", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).delete(`/api/lists/${randomUUID()}`);

    expect(res.status).toBe(401);
  });

  it("moves the list to the trash and hides it while keeping the books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList({ name: "Autumn reads", userId });
    const { bookId } = await createBook(userId, false);
    await addBookToList(listId, bookId, 0);

    const res = await request(app.getHttpServer())
      .delete(`/api/lists/${listId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(await prisma.bookList.count({ where: { deletedAt: null, id: listId } })).toBe(0);
    expect(await prisma.bookListItem.count({ where: { listId } })).toBe(1);
    expect(await prisma.book.count({ where: { id: bookId } })).toBe(1);

    const listing = await request(app.getHttpServer())
      .get("/api/lists")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(listing.body.totalCount).toBe(0);
  });

  it("returns 404 for a list owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignListId = await createList({ name: "Secret", userId: stranger.userId });

    const res = await request(app.getHttpServer())
      .delete(`/api/lists/${foreignListId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(404);
    expect(await prisma.bookList.count({ where: { id: foreignListId } })).toBe(1);
  });
});

describe("GET /api/lists", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/lists");

    expect(res.status).toBe(401);
  });

  it("returns enriched cards with bookCount and preview covers in position order", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList({ description: "cozy", name: "Autumn reads", userId });

    const uncovered = await createBook(userId, false);
    await addBookToList(listId, uncovered.bookId, 0);

    const coverIds: string[] = [];
    for (let position = 1; position <= 5; position += 1) {
      const { bookId, coverId } = await createBook(userId, true);
      await addBookToList(listId, bookId, position);
      if (coverId !== null) {
        coverIds.push(coverId);
      }
    }

    const res = await getLists(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    const card = res.body.items[0];
    expect(card.bookCount).toBe(6);
    expect(card.description).toBe("cozy");
    expect(card.previewCovers).toHaveLength(4);
    expect(card.previewCovers.map((cover: { id: string }) => cover.id)).toEqual(
      coverIds.slice(0, 4),
    );
    expect(card.previewCovers[0].urls).toEqual({
      card: expect.any(String),
      full: expect.any(String),
      thumb: expect.any(String),
    });
  });

  it("matches the search term against the name or the description", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createList({ description: "spooky season", name: "Autumn reads", userId });
    await createList({ description: "birthday", name: "Gifts", userId });
    await createList({ description: "warm blankets", name: "Winter", userId });

    const byDescription = await getLists(accessToken).query({ search: "SPOOKY" });
    const byName = await getLists(accessToken).query({ search: "gift" });

    expect(byDescription.body.items.map((list: { name: string }) => list.name)).toEqual([
      "Autumn reads",
    ]);
    expect(byName.body.items.map((list: { name: string }) => list.name)).toEqual(["Gifts"]);
  });

  it("orders by title ascending and descending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createList({ name: "Beta", userId });
    await createList({ name: "Alpha", userId });
    await createList({ name: "Gamma", userId });

    const asc = await getLists(accessToken).query({ sort: "title_asc" });
    const desc = await getLists(accessToken).query({ sort: "title_desc" });

    expect(asc.body.items.map((list: { name: string }) => list.name)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
    expect(desc.body.items.map((list: { name: string }) => list.name)).toEqual([
      "Gamma",
      "Beta",
      "Alpha",
    ]);
  });

  it("orders by creation time ascending and descending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createList({ createdAt: new Date("2026-01-01T00:00:00.000Z"), name: "Oldest", userId });
    await createList({ createdAt: new Date("2026-02-01T00:00:00.000Z"), name: "Middle", userId });
    await createList({ createdAt: new Date("2026-03-01T00:00:00.000Z"), name: "Newest", userId });

    const asc = await getLists(accessToken).query({ sort: "created_asc" });
    const desc = await getLists(accessToken).query({ sort: "created_desc" });

    expect(asc.body.items.map((list: { name: string }) => list.name)).toEqual([
      "Oldest",
      "Middle",
      "Newest",
    ]);
    expect(desc.body.items.map((list: { name: string }) => list.name)).toEqual([
      "Newest",
      "Middle",
      "Oldest",
    ]);
  });

  it("orders by most recently updated by default", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createList({ name: "Stale", updatedAt: new Date("2026-01-01T00:00:00.000Z"), userId });
    await createList({ name: "Fresh", updatedAt: new Date("2026-03-01T00:00:00.000Z"), userId });
    await createList({ name: "Middling", updatedAt: new Date("2026-02-01T00:00:00.000Z"), userId });

    const res = await getLists(accessToken);

    expect(res.body.items.map((list: { name: string }) => list.name)).toEqual([
      "Fresh",
      "Middling",
      "Stale",
    ]);
  });

  it("orders by the number of books in the list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const many = await createList({ name: "Many", userId });
    const few = await createList({ name: "Few", userId });
    await createList({ name: "None", userId });

    for (let position = 0; position < 3; position += 1) {
      const { bookId } = await createBook(userId, false);
      await addBookToList(many, bookId, position);
    }
    const single = await createBook(userId, false);
    await addBookToList(few, single.bookId, 0);

    const desc = await getLists(accessToken).query({ sort: "books_count_desc" });
    const asc = await getLists(accessToken).query({ sort: "books_count_asc" });

    expect(desc.body.items.map((list: { name: string }) => list.name)).toEqual([
      "Many",
      "Few",
      "None",
    ]);
    expect(asc.body.items.map((list: { name: string }) => list.name)).toEqual([
      "None",
      "Few",
      "Many",
    ]);
  });

  it("never returns another user's lists", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await createList({ name: "Owned", userId: owner.userId });
    await createList({ name: "Secret", userId: stranger.userId });

    const res = await getLists(owner.accessToken);

    expect(res.body.totalCount).toBe(1);
    expect(res.body.items.map((list: { name: string }) => list.name)).toEqual(["Owned"]);
  });
});

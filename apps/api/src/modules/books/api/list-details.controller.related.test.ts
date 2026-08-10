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
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

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

async function addToList(listId: string, bookId: string, position: number): Promise<void> {
  await prisma.bookListItem.create({ data: { bookId, listId, position } });
}

async function createBook(userId: string, title: string): Promise<string> {
  const book = await prisma.book.create({
    data: { firstAuthorName: "", genres: [], readingStatus: "not_started", title, userId },
  });
  return book.id;
}

async function createList(userId: string, name: string): Promise<string> {
  const created = await prisma.bookList.create({
    data: { description: null, name, normalizedName: name.trim().toLowerCase(), userId },
  });
  return created.id;
}

async function fillList(userId: string, listId: string, titles: string[]): Promise<void> {
  let position = 0;
  for (const title of titles) {
    await addToList(listId, await createBook(userId, title), position);
    position += 1;
  }
}

function getRelated(accessToken: string, listId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/lists/${listId}/related`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function trashBook(bookId: string): Promise<void> {
  await prisma.book.update({ data: TRASH_RETENTION.stamp(), where: { id: bookId } });
}

async function trashList(listId: string): Promise<void> {
  await prisma.bookList.update({ data: TRASH_RETENTION.stamp(), where: { id: listId } });
}

describe("GET /api/lists/:listId/related", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(`/api/lists/${randomUUID()}/related`);

    expect(res.status).toBe(401);
  });

  it("returns 404 when the list does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getRelated(accessToken, MISSING_UUID);

    expect(res.status).toBe(404);
  });

  it("returns the other list with the number of books both lists share", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const currentListId = await createList(userId, "Autumn reads");
    const otherListId = await createList(userId, "Winter reads");
    const dune = await createBook(userId, "Dune");
    const foundation = await createBook(userId, "Foundation");
    await addToList(currentListId, dune, 0);
    await addToList(currentListId, foundation, 1);
    await addToList(otherListId, dune, 0);
    await addToList(otherListId, foundation, 1);

    const res = await getRelated(accessToken, currentListId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      lists: [{ bookCount: 2, id: otherListId, name: "Winter reads", sharedCount: 2 }],
    });
  });

  it("reports bookCount as the other list's whole size rather than the shared part", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const currentListId = await createList(userId, "Autumn reads");
    const otherListId = await createList(userId, "Winter reads");
    const shared = await createBook(userId, "Dune");
    await addToList(currentListId, shared, 0);
    await addToList(otherListId, shared, 0);
    await fillList(userId, otherListId, ["Foundation", "Neuromancer", "Hyperion"]);

    const res = await getRelated(accessToken, currentListId);

    expect(res.body.lists).toEqual([
      { bookCount: 4, id: otherListId, name: "Winter reads", sharedCount: 1 },
    ]);
  });

  it("never returns the requested list itself among its related lists", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const currentListId = await createList(userId, "Autumn reads");
    const otherListId = await createList(userId, "Winter reads");
    const shared = await createBook(userId, "Dune");
    await addToList(currentListId, shared, 0);
    await addToList(otherListId, shared, 0);

    const res = await getRelated(accessToken, currentListId);

    expect(res.status).toBe(200);
    expect(res.body.lists.map((entry: { id: string }) => entry.id)).toEqual([otherListId]);
  });

  it("hides a list of another user even when it shares a book", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const currentListId = await createList(owner.userId, "Autumn reads");
    const foreignListId = await createList(stranger.userId, "Secret");
    const shared = await createBook(owner.userId, "Dune");
    await addToList(currentListId, shared, 0);
    await addToList(foreignListId, shared, 0);

    const res = await getRelated(owner.accessToken, currentListId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lists: [] });
  });

  it("orders related lists by shared books first and breaks ties by name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const currentListId = await createList(userId, "Autumn reads");
    const zeta = await createList(userId, "Zeta");
    const beta = await createList(userId, "Beta");
    const alpha = await createList(userId, "Alpha");
    const dune = await createBook(userId, "Dune");
    const foundation = await createBook(userId, "Foundation");
    await addToList(currentListId, dune, 0);
    await addToList(currentListId, foundation, 1);
    await addToList(zeta, dune, 0);
    await addToList(zeta, foundation, 1);
    await addToList(beta, dune, 0);
    await addToList(alpha, foundation, 0);

    const res = await getRelated(accessToken, currentListId);

    expect(res.body.lists.map((entry: { name: string }) => entry.name)).toEqual([
      "Zeta",
      "Alpha",
      "Beta",
    ]);
  });

  it("returns an empty array for an owned list that shares no book with any other list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const currentListId = await createList(userId, "Autumn reads");
    const otherListId = await createList(userId, "Winter reads");
    await fillList(userId, currentListId, ["Dune"]);
    await fillList(userId, otherListId, ["Foundation"]);

    const res = await getRelated(accessToken, currentListId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lists: [] });
  });

  it("returns 404 for a list owned by another user instead of revealing that it exists", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignListId = await createList(stranger.userId, "Secret");
    await fillList(stranger.userId, foreignListId, ["Dune"]);

    const res = await getRelated(owner.accessToken, foreignListId);

    expect(res.status).toBe(404);
  });

  it("stops counting a shared book once it is trashed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const currentListId = await createList(userId, "Autumn reads");
    const otherListId = await createList(userId, "Winter reads");
    const trashed = await createBook(userId, "Dune");
    await addToList(currentListId, trashed, 0);
    await addToList(otherListId, trashed, 0);
    await trashBook(trashed);

    const res = await getRelated(accessToken, currentListId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lists: [] });
  });

  it("keeps counting the books that are still active when another shared book is trashed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const currentListId = await createList(userId, "Autumn reads");
    const otherListId = await createList(userId, "Winter reads");
    const kept = await createBook(userId, "Dune");
    const trashed = await createBook(userId, "Foundation");
    await addToList(currentListId, kept, 0);
    await addToList(currentListId, trashed, 1);
    await addToList(otherListId, kept, 0);
    await addToList(otherListId, trashed, 1);
    await trashBook(trashed);

    const res = await getRelated(accessToken, currentListId);

    expect(res.body.lists).toEqual([
      { bookCount: 1, id: otherListId, name: "Winter reads", sharedCount: 1 },
    ]);
  });

  it("drops a trashed list from the related lists", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const currentListId = await createList(userId, "Autumn reads");
    const trashedListId = await createList(userId, "Winter reads");
    const shared = await createBook(userId, "Dune");
    await addToList(currentListId, shared, 0);
    await addToList(trashedListId, shared, 0);
    await trashList(trashedListId);

    const res = await getRelated(accessToken, currentListId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lists: [] });
  });
});

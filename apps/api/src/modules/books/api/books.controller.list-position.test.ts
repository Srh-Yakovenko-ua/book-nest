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

const getAuthorByKey = vi.fn<(olid: string) => Promise<null | OpenLibraryAuthorDetail>>();
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

function createList(userId: string, name: string): Promise<{ id: string }> {
  return prisma.bookList.create({
    data: { name, normalizedName: name.toLowerCase(), userId },
    select: { id: true },
  });
}

function membership(bookId: string, listId: string): Promise<BookListItemModel | null> {
  return prisma.bookListItem.findUnique({ where: { listId_bookId: { bookId, listId } } });
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

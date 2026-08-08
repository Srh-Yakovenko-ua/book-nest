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

type CreateBookInput = {
  readingStatus?: string;
  title: string;
  userId: string;
  withCover?: boolean;
};

async function addBooks(accessToken: string, listId: string, bookIds: string[]): Promise<void> {
  await request(app.getHttpServer())
    .post(`/api/lists/${listId}/books`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ bookIds });
}

async function createBook({
  readingStatus,
  title,
  userId,
  withCover,
}: CreateBookInput): Promise<string> {
  const book = await prisma.book.create({
    data: {
      coverMediaId: withCover === true ? await createCover(userId) : null,
      readingStatus: readingStatus ?? "not_started",
      title,
      userId,
    },
  });
  return book.id;
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

async function createList(userId: string, name: string, description?: string): Promise<string> {
  const created = await prisma.bookList.create({
    data: {
      description: description ?? null,
      name,
      normalizedName: name.trim().toLowerCase(),
      userId,
    },
  });
  return created.id;
}

function duplicateList(accessToken: string, listId: string): request.Test {
  return request(app.getHttpServer())
    .post(`/api/lists/${listId}/duplicate`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getDetail(accessToken: string, listId: string, query = ""): request.Test {
  const path = query === "" ? `/api/lists/${listId}` : `/api/lists/${listId}?${query}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

function idsOf(items: { id: string }[]): string[] {
  return items.map((item) => item.id);
}

function libraryBooks(accessToken: string, query: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books?${query}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function positionsOf(items: { position: number }[]): number[] {
  return items.map((item) => item.position);
}

function removeBooks(accessToken: string, listId: string, bookIds: string[]): request.Test {
  return request(app.getHttpServer())
    .post(`/api/lists/${listId}/books/remove`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ bookIds });
}

describe("GET /api/books?notInList", () => {
  it("excludes exactly the books that already belong to the list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const inList = await createBook({ title: "Dune", userId });
    const alsoInList = await createBook({ title: "Foundation", userId });
    const outsideList = await createBook({ title: "Hyperion", userId });
    await addBooks(accessToken, listId, [inList, alsoInList]);

    const res = await libraryBooks(accessToken, `notInList=${listId}`);

    expect(res.status).toBe(200);
    expect(idsOf(res.body.items)).toEqual([outsideList]);
  });

  it("excludes list books that fall beyond the first page of the list detail pagination", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const onFirstPage = await createBook({ title: "Dune", userId });
    const beyondFirstPage = await createBook({ title: "Foundation", userId });
    const outsideList = await createBook({ title: "Hyperion", userId });
    await addBooks(accessToken, listId, [onFirstPage, beyondFirstPage]);
    const firstPage = await getDetail(accessToken, listId, "sort=position&pageNumber=1&pageSize=1");
    expect(idsOf(firstPage.body.books.items)).toEqual([onFirstPage]);

    const res = await libraryBooks(accessToken, `notInList=${listId}`);

    expect(idsOf(res.body.items)).toEqual([outsideList]);
  });

  it("returns every owned book when the list is empty", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await createBook({ title: "Dune", userId });
    await createBook({ title: "Foundation", userId });

    const res = await libraryBooks(accessToken, `notInList=${listId}`);

    expect(res.body.totalCount).toBe(2);
  });

  it("keeps books that belong only to another list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const otherListId = await createList(userId, "Winter reads");
    const inOtherList = await createBook({ title: "Dune", userId });
    await addBooks(accessToken, otherListId, [inOtherList]);

    const res = await libraryBooks(accessToken, `notInList=${listId}`);

    expect(idsOf(res.body.items)).toEqual([inOtherList]);
  });

  it("applies the reading-status filter alongside notInList", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const readingAndInList = await createBook({
      readingStatus: "reading",
      title: "Dune",
      userId,
    });
    const readingAndOutside = await createBook({
      readingStatus: "reading",
      title: "Foundation",
      userId,
    });
    await createBook({ readingStatus: "not_started", title: "Hyperion", userId });
    await addBooks(accessToken, listId, [readingAndInList]);

    const res = await libraryBooks(accessToken, `notInList=${listId}&status=reading`);

    expect(idsOf(res.body.items)).toEqual([readingAndOutside]);
  });
});

describe("POST /api/lists/:listId/books/remove", () => {
  it("reports how many books were removed and the remaining count", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const dune = await createBook({ title: "Dune", userId });
    const foundation = await createBook({ title: "Foundation", userId });
    const hyperion = await createBook({ title: "Hyperion", userId });
    await addBooks(accessToken, listId, [dune, foundation, hyperion]);

    const res = await removeBooks(accessToken, listId, [dune, hyperion]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookCount: 1, removed: 2 });
  });

  it("leaves only the books that were not removed in the list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const dune = await createBook({ title: "Dune", userId });
    const foundation = await createBook({ title: "Foundation", userId });
    const hyperion = await createBook({ title: "Hyperion", userId });
    await addBooks(accessToken, listId, [dune, foundation, hyperion]);

    await removeBooks(accessToken, listId, [dune, hyperion]);
    const detail = await getDetail(accessToken, listId, "sort=position");

    expect(idsOf(detail.body.books.items)).toEqual([foundation]);
  });

  it("leaves the remaining positions dense from 1", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const first = await createBook({ title: "Dune", userId });
    const second = await createBook({ title: "Foundation", userId });
    const third = await createBook({ title: "Hyperion", userId });
    const fourth = await createBook({ title: "Neuromancer", userId });
    const fifth = await createBook({ title: "Solaris", userId });
    await addBooks(accessToken, listId, [first, second, third, fourth, fifth]);

    await removeBooks(accessToken, listId, [first, third]);
    const detail = await getDetail(accessToken, listId, "sort=position");

    expect(positionsOf(detail.body.books.items)).toEqual([1, 2, 3]);
    expect(idsOf(detail.body.books.items)).toEqual([second, fourth, fifth]);
  });

  it("ignores ids that are not in the list and counts only the real removals", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const inList = await createBook({ title: "Dune", userId });
    const neverAdded = await createBook({ title: "Foundation", userId });
    await addBooks(accessToken, listId, [inList]);

    const res = await removeBooks(accessToken, listId, [inList, neverAdded, MISSING_UUID]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookCount: 0, removed: 1 });
  });

  it("removes nothing and stays successful when the same request is repeated", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const dune = await createBook({ title: "Dune", userId });
    const foundation = await createBook({ title: "Foundation", userId });
    await addBooks(accessToken, listId, [dune, foundation]);
    await removeBooks(accessToken, listId, [dune]);

    const res = await removeBooks(accessToken, listId, [dune]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookCount: 1, removed: 0 });
  });

  it("returns 400 when the body carries no book ids", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");

    const res = await removeBooks(accessToken, listId, []);

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "bookIds" })]),
    );
  });

  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/lists/${randomUUID()}/books/remove`)
      .send({ bookIds: [MISSING_UUID] });

    expect(res.status).toBe(401);
  });

  it("returns 404 for a list owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignListId = await createList(stranger.userId, "Secret");
    const foreignBook = await createBook({ title: "Dune", userId: stranger.userId });
    await addBooks(stranger.accessToken, foreignListId, [foreignBook]);

    const res = await removeBooks(owner.accessToken, foreignListId, [foreignBook]);

    expect(res.status).toBe(404);
  });

  it("keeps another user's list untouched when the removal is rejected", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignListId = await createList(stranger.userId, "Secret");
    const foreignBook = await createBook({ title: "Dune", userId: stranger.userId });
    await addBooks(stranger.accessToken, foreignListId, [foreignBook]);

    await removeBooks(owner.accessToken, foreignListId, [foreignBook]);
    const detail = await getDetail(stranger.accessToken, foreignListId, "sort=position");

    expect(idsOf(detail.body.books.items)).toEqual([foreignBook]);
  });
});

describe("POST /api/lists/:listId/duplicate", () => {
  it("names the first copy after the source list with a copy suffix", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");

    const res = await duplicateList(accessToken, listId);

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Autumn reads (копія)");
  });

  it("numbers the second copy when the first copy name is taken", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await duplicateList(accessToken, listId);

    const res = await duplicateList(accessToken, listId);

    expect(res.body.name).toBe("Autumn reads (копія 2)");
  });

  it("carries the description of the source list into the copy", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads", "cozy autumn picks");

    const res = await duplicateList(accessToken, listId);

    expect(res.body.description).toBe("cozy autumn picks");
  });

  it("copies the books of the source list in the same order", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const first = await createBook({ title: "Dune", userId });
    const second = await createBook({ title: "Foundation", userId });
    const third = await createBook({ title: "Hyperion", userId });
    await addBooks(accessToken, listId, [first, second, third]);

    const copy = await duplicateList(accessToken, listId);
    const detail = await getDetail(accessToken, copy.body.id, "sort=position");

    expect(idsOf(detail.body.books.items)).toEqual([first, second, third]);
    expect(positionsOf(detail.body.books.items)).toEqual([1, 2, 3]);
  });

  it("reports the copied book count on the returned card", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const dune = await createBook({ title: "Dune", userId });
    const foundation = await createBook({ title: "Foundation", userId });
    await addBooks(accessToken, listId, [dune, foundation]);

    const res = await duplicateList(accessToken, listId);

    expect(res.body.bookCount).toBe(2);
  });

  it("leaves the source list unchanged", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const dune = await createBook({ title: "Dune", userId });
    await addBooks(accessToken, listId, [dune]);

    await duplicateList(accessToken, listId);
    const detail = await getDetail(accessToken, listId, "sort=position");

    expect(detail.body.name).toBe("Autumn reads");
    expect(idsOf(detail.body.books.items)).toEqual([dune]);
  });

  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).post(`/api/lists/${randomUUID()}/duplicate`);

    expect(res.status).toBe(401);
  });

  it("returns 404 for a list owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignListId = await createList(stranger.userId, "Secret");

    const res = await duplicateList(owner.accessToken, foreignListId);

    expect(res.status).toBe(404);
  });
});

describe("GET /api/lists/:listId previewCovers", () => {
  it("returns at most four covers for a list with more covered books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const covered: string[] = [];
    for (const title of ["Dune", "Foundation", "Hyperion", "Neuromancer", "Solaris", "Ubik"]) {
      covered.push(await createBook({ title, userId, withCover: true }));
    }
    await addBooks(accessToken, listId, covered);

    const res = await getDetail(accessToken, listId);

    expect(res.status).toBe(200);
    expect(res.body.previewCovers).toHaveLength(4);
  });

  it("skips the books that have no cover", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const withoutCover = await createBook({ title: "Dune", userId });
    const withCover = await createBook({ title: "Foundation", userId, withCover: true });
    await addBooks(accessToken, listId, [withoutCover, withCover]);

    const res = await getDetail(accessToken, listId);

    expect(res.body.previewCovers).toHaveLength(1);
  });

  it("returns an empty preview for a list whose books have no covers", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const dune = await createBook({ title: "Dune", userId });
    await addBooks(accessToken, listId, [dune]);

    const res = await getDetail(accessToken, listId);

    expect(res.body.previewCovers).toEqual([]);
  });
});

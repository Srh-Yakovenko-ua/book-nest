import type { Nullable } from "@app/shared";
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
  firstAuthorName?: string;
  pagesCount?: Nullable<number>;
  readingStatus?: string;
  title?: string;
  userId: string;
  withCover?: boolean;
};

async function addToList(
  listId: string,
  bookId: string,
  position: number,
  addedAt?: Date,
): Promise<void> {
  await prisma.bookListItem.create({ data: { addedAt, bookId, listId, position } });
}

async function createAuthor(userId: string, name: string): Promise<string> {
  const author = await prisma.author.create({
    data: { name, normalizedName: name.toLowerCase(), userId },
  });
  return author.id;
}

async function createBook({
  firstAuthorName,
  pagesCount,
  readingStatus,
  title,
  userId,
  withCover,
}: CreateBookInput): Promise<string> {
  const coverMediaId = withCover === true ? await createCover(userId) : null;
  const book = await prisma.book.create({
    data: {
      coverMediaId,
      firstAuthorName: firstAuthorName ?? "",
      pagesCount: pagesCount ?? null,
      readingStatus: readingStatus ?? "not_started",
      title: title ?? `Book ${randomUUID()}`,
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

function getDetail(
  accessToken: string,
  listId: string,
  query: Record<string, string> = {},
): request.Test {
  return request(app.getHttpServer())
    .get(`/api/lists/${listId}`)
    .query(query)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function linkAuthor(bookId: string, authorId: string): Promise<void> {
  await prisma.bookAuthor.create({ data: { authorId, bookId, position: 0 } });
}

async function setRating(bookId: string, rating: number): Promise<void> {
  await prisma.bookReadingProgress.create({ data: { bookId, rating } });
}

function titles(body: { books: { items: { title: string }[] } }): string[] {
  return body.books.items.map((item) => item.title);
}

describe("GET /api/lists/:listId", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(`/api/lists/${randomUUID()}`);

    expect(res.status).toBe(401);
  });

  it("returns 404 when the list does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getDetail(accessToken, MISSING_UUID);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a list owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignListId = await createList(stranger.userId, "Secret");

    const res = await getDetail(owner.accessToken, foreignListId);

    expect(res.status).toBe(404);
  });

  it("returns the header fields with the total unfiltered book count", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads", "cozy");
    const first = await createBook({ title: "Dune", userId });
    const second = await createBook({ title: "Foundation", userId });
    await addToList(listId, first, 0);
    await addToList(listId, second, 1);

    const res = await getDetail(accessToken, listId);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      bookCount: 2,
      description: "cozy",
      id: listId,
      name: "Autumn reads",
    });
    expect(res.body.createdAt).toEqual(expect.any(String));
    expect(res.body.updatedAt).toEqual(expect.any(String));
    expect(res.body.books.totalCount).toBe(2);
    expect(res.body.books.page).toBe(1);
  });

  it("keeps the header book count independent of the search filter", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addToList(listId, await createBook({ title: "Dune", userId }), 0);
    await addToList(listId, await createBook({ title: "Foundation", userId }), 1);
    await addToList(listId, await createBook({ title: "Neuromancer", userId }), 2);

    const res = await getDetail(accessToken, listId, { search: "dune" });

    expect(res.status).toBe(200);
    expect(res.body.bookCount).toBe(3);
    expect(res.body.books.totalCount).toBe(1);
    expect(titles(res.body)).toEqual(["Dune"]);
  });

  it("orders books by position by default", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addToList(listId, await createBook({ title: "Third", userId }), 2);
    await addToList(listId, await createBook({ title: "First", userId }), 0);
    await addToList(listId, await createBook({ title: "Second", userId }), 1);

    const res = await getDetail(accessToken, listId);

    expect(titles(res.body)).toEqual(["First", "Second", "Third"]);
  });

  it("orders books by the time they were added", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addToList(
      listId,
      await createBook({ title: "Oldest", userId }),
      2,
      new Date("2026-01-01T00:00:00.000Z"),
    );
    await addToList(
      listId,
      await createBook({ title: "Newest", userId }),
      0,
      new Date("2026-03-01T00:00:00.000Z"),
    );
    await addToList(
      listId,
      await createBook({ title: "Middle", userId }),
      1,
      new Date("2026-02-01T00:00:00.000Z"),
    );

    const desc = await getDetail(accessToken, listId, { sort: "added_desc" });
    const asc = await getDetail(accessToken, listId, { sort: "added_asc" });

    expect(titles(desc.body)).toEqual(["Newest", "Middle", "Oldest"]);
    expect(titles(asc.body)).toEqual(["Oldest", "Middle", "Newest"]);
  });

  it("orders books by title ascending and descending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addToList(listId, await createBook({ title: "Charlie", userId }), 0);
    await addToList(listId, await createBook({ title: "Alpha", userId }), 1);
    await addToList(listId, await createBook({ title: "Bravo", userId }), 2);

    const asc = await getDetail(accessToken, listId, { sort: "title_asc" });
    const desc = await getDetail(accessToken, listId, { sort: "title_desc" });

    expect(titles(asc.body)).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(titles(desc.body)).toEqual(["Charlie", "Bravo", "Alpha"]);
  });

  it("orders books by first author name ascending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addToList(
      listId,
      await createBook({ firstAuthorName: "Zelazny", title: "Amber", userId }),
      0,
    );
    await addToList(
      listId,
      await createBook({ firstAuthorName: "Asimov", title: "Foundation", userId }),
      1,
    );
    await addToList(
      listId,
      await createBook({ firstAuthorName: "Herbert", title: "Dune", userId }),
      2,
    );

    const res = await getDetail(accessToken, listId, { sort: "author_asc" });

    expect(titles(res.body)).toEqual(["Foundation", "Dune", "Amber"]);
  });

  it("orders books by rating descending with unrated books last", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const high = await createBook({ title: "High", userId });
    const mid = await createBook({ title: "Mid", userId });
    const low = await createBook({ title: "Low", userId });
    const none = await createBook({ title: "None", userId });
    await setRating(high, 9);
    await setRating(mid, 5);
    await setRating(low, 2);
    await addToList(listId, high, 0);
    await addToList(listId, mid, 1);
    await addToList(listId, low, 2);
    await addToList(listId, none, 3);

    const res = await getDetail(accessToken, listId, { sort: "rating_desc" });

    expect(titles(res.body)).toEqual(["High", "Mid", "Low", "None"]);
  });

  it("orders books by page count with unknown counts last", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addToList(listId, await createBook({ pagesCount: 300, title: "Long", userId }), 0);
    await addToList(listId, await createBook({ pagesCount: 100, title: "Short", userId }), 1);
    await addToList(listId, await createBook({ pagesCount: 200, title: "Medium", userId }), 2);
    await addToList(listId, await createBook({ pagesCount: null, title: "Unknown", userId }), 3);

    const desc = await getDetail(accessToken, listId, { sort: "pages_desc" });
    const asc = await getDetail(accessToken, listId, { sort: "pages_asc" });

    expect(titles(desc.body)).toEqual(["Long", "Medium", "Short", "Unknown"]);
    expect(titles(asc.body)).toEqual(["Short", "Medium", "Long", "Unknown"]);
  });

  it("filters books within the list by title and by author", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");

    const dune = await createBook({ title: "Dune", userId });
    const herbert = await createAuthor(userId, "Frank Herbert");
    await linkAuthor(dune, herbert);

    const foundation = await createBook({ title: "Foundation", userId });
    const asimov = await createAuthor(userId, "Isaac Asimov");
    await linkAuthor(foundation, asimov);

    await addToList(listId, dune, 0);
    await addToList(listId, foundation, 1);

    const byTitle = await getDetail(accessToken, listId, { search: "dune" });
    const byAuthor = await getDetail(accessToken, listId, { search: "asimov" });

    expect(byTitle.body.books.totalCount).toBe(1);
    expect(titles(byTitle.body)).toEqual(["Dune"]);
    expect(byAuthor.body.books.totalCount).toBe(1);
    expect(titles(byAuthor.body)).toEqual(["Foundation"]);
  });

  it("filters books within the list by a genre display name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");

    await prisma.genre.create({
      data: {
        groupKey: "fiction",
        groupName: "Fiction",
        isDefault: true,
        key: "fentezi",
        name: "Фентезі",
        normalizedName: "фентезі",
        userId: null,
      },
    });
    const fantasy = await prisma.book.create({
      data: { firstAuthorName: "", genres: ["fentezi"], title: "Dune", userId },
    });
    const other = await createBook({ title: "Foundation", userId });
    await addToList(listId, fantasy.id, 0);
    await addToList(listId, other, 1);

    const res = await getDetail(accessToken, listId, { search: "Фентезі" });

    expect(res.status).toBe(200);
    expect(res.body.books.totalCount).toBe(1);
    expect(titles(res.body)).toEqual(["Dune"]);
  });

  it("paginates the books and reflects the filtered total count", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    for (let position = 0; position < 5; position += 1) {
      const bookId = await createBook({ title: `Book ${position}`, userId });
      await addToList(listId, bookId, position);
    }

    const firstPage = await getDetail(accessToken, listId, { pageNumber: "1", pageSize: "2" });
    const lastPage = await getDetail(accessToken, listId, { pageNumber: "3", pageSize: "2" });

    expect(firstPage.body.books.totalCount).toBe(5);
    expect(firstPage.body.books.pagesCount).toBe(3);
    expect(titles(firstPage.body)).toEqual(["Book 0", "Book 1"]);
    expect(titles(lastPage.body)).toEqual(["Book 4"]);

    const filtered = await getDetail(accessToken, listId, {
      pageSize: "2",
      search: "Book",
    });
    expect(filtered.body.books.totalCount).toBe(5);
    expect(filtered.body.bookCount).toBe(5);
  });

  it("returns each book with its position and a fully populated view", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const bookId = await createBook({
      readingStatus: "reading",
      title: "The Left Hand of Darkness",
      userId,
      withCover: true,
    });
    const authorId = await createAuthor(userId, "Ursula Le Guin");
    await linkAuthor(bookId, authorId);
    await addToList(listId, bookId, 3);

    const res = await getDetail(accessToken, listId);

    expect(res.status).toBe(200);
    const item = res.body.books.items[0];
    expect(item.position).toBe(3);
    expect(item.id).toBe(bookId);
    expect(item.readingStatus).toBe("reading");
    expect(item.authors).toEqual([{ id: authorId, name: "Ursula Le Guin" }]);
    expect(item.cover.urls).toEqual({
      card: expect.any(String),
      full: expect.any(String),
      thumb: expect.any(String),
    });
  });

  it("never returns books from a list owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerListId = await createList(owner.userId, "Owned");
    const strangerListId = await createList(stranger.userId, "Secret");
    await addToList(strangerListId, await createBook({ userId: stranger.userId }), 0);

    const res = await getDetail(owner.accessToken, ownerListId);

    expect(res.status).toBe(200);
    expect(res.body.bookCount).toBe(0);
    expect(res.body.books.items).toEqual([]);
  });
});

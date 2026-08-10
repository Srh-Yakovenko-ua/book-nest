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

type CreateBookInput = {
  genres?: string[];
  readingStatus?: string;
  title: string;
  userId: string;
};

async function addBookToList(
  listId: string,
  position: number,
  input: CreateBookInput,
): Promise<string> {
  const bookId = await createBook(input);
  await addToList(listId, bookId, position);
  return bookId;
}

async function addToList(listId: string, bookId: string, position: number): Promise<void> {
  await prisma.bookListItem.create({ data: { bookId, listId, position } });
}

async function createAuthor(userId: string, name: string): Promise<string> {
  const author = await prisma.author.create({
    data: { name, normalizedName: name.toLowerCase(), userId },
  });
  return author.id;
}

async function createBook({
  genres,
  readingStatus,
  title,
  userId,
}: CreateBookInput): Promise<string> {
  const book = await prisma.book.create({
    data: {
      firstAuthorName: "",
      genres: genres ?? [],
      readingStatus: readingStatus ?? "not_started",
      title,
      userId,
    },
  });
  return book.id;
}

async function createGenre(key: string, name: string): Promise<void> {
  await prisma.genre.create({
    data: {
      groupKey: "fiction",
      groupName: "Fiction",
      isDefault: true,
      key,
      name,
      normalizedName: name.toLowerCase(),
      userId: null,
    },
  });
}

async function createList(userId: string, name: string): Promise<string> {
  const created = await prisma.bookList.create({
    data: { description: null, name, normalizedName: name.trim().toLowerCase(), userId },
  });
  return created.id;
}

function getFacets(
  accessToken: string,
  listId: string,
  query: Record<string, string> = {},
): request.Test {
  return request(app.getHttpServer())
    .get(`/api/lists/${listId}/facets`)
    .query(query)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function linkAuthor(bookId: string, authorId: string): Promise<void> {
  await prisma.bookAuthor.create({ data: { authorId, bookId, position: 0 } });
}

async function trashBook(bookId: string): Promise<void> {
  await prisma.book.update({ data: TRASH_RETENTION.stamp(), where: { id: bookId } });
}

describe("GET /api/lists/:listId/facets", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(`/api/lists/${randomUUID()}/facets`);

    expect(res.status).toBe(401);
  });

  it("returns 404 when the list does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getFacets(accessToken, MISSING_UUID);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a list owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignListId = await createList(stranger.userId, "Secret");
    const foreignBook = await addBookToList(foreignListId, 0, {
      genres: ["fantasy"],
      title: "Dune",
      userId: stranger.userId,
    });
    await linkAuthor(foreignBook, await createAuthor(stranger.userId, "Frank Herbert"));

    const res = await getFacets(owner.accessToken, foreignListId);

    expect(res.status).toBe(404);
  });

  it("returns empty facets instead of 404 for an owned list without books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");

    const res = await getFacets(accessToken, listId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authors: [], genres: [] });
  });

  it("counts each author once per book they wrote in the list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const herbert = await createAuthor(userId, "Frank Herbert");
    const asimov = await createAuthor(userId, "Isaac Asimov");
    const dune = await addBookToList(listId, 0, {
      genres: ["fantasy", "scifi"],
      title: "Dune",
      userId,
    });
    const messiah = await addBookToList(listId, 1, { title: "Dune Messiah", userId });
    await linkAuthor(dune, herbert);
    await linkAuthor(dune, asimov);
    await linkAuthor(messiah, herbert);

    const res = await getFacets(accessToken, listId);

    expect(res.body.authors).toEqual([
      { count: 2, id: herbert, name: "Frank Herbert" },
      { count: 1, id: asimov, name: "Isaac Asimov" },
    ]);
  });

  it("counts each genre once per book that carries it", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createGenre("fantasy", "Фентезі");
    await createGenre("scifi", "Наукова фантастика");
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { genres: ["fantasy", "scifi"], title: "Dune", userId });
    await addBookToList(listId, 1, { genres: ["fantasy"], title: "Dune Messiah", userId });

    const res = await getFacets(accessToken, listId);

    expect(res.body.genres).toEqual([
      { count: 2, key: "fantasy", name: "Фентезі" },
      { count: 1, key: "scifi", name: "Наукова фантастика" },
    ]);
  });

  it("orders authors by descending count and then by name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const asimov = await createAuthor(userId, "Isaac Asimov");
    const bradbury = await createAuthor(userId, "Ray Bradbury");
    const clarke = await createAuthor(userId, "Arthur Clarke");
    const first = await addBookToList(listId, 0, { title: "Foundation", userId });
    const second = await addBookToList(listId, 1, { title: "Fahrenheit 451", userId });
    const third = await addBookToList(listId, 2, { title: "Childhood's End", userId });
    await linkAuthor(first, asimov);
    await linkAuthor(second, asimov);
    await linkAuthor(second, bradbury);
    await linkAuthor(third, clarke);

    const res = await getFacets(accessToken, listId);

    expect(res.body.authors).toEqual([
      { count: 2, id: asimov, name: "Isaac Asimov" },
      { count: 1, id: clarke, name: "Arthur Clarke" },
      { count: 1, id: bradbury, name: "Ray Bradbury" },
    ]);
  });

  it("orders genres by descending count and then by key", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { genres: ["fantasy"], title: "Dune", userId });
    await addBookToList(listId, 1, {
      genres: ["fantasy", "adventure"],
      title: "Foundation",
      userId,
    });
    await addBookToList(listId, 2, { genres: ["scifi"], title: "Neuromancer", userId });

    const res = await getFacets(accessToken, listId);

    expect(res.body.genres.map((entry: { key: string }) => entry.key)).toEqual([
      "fantasy",
      "adventure",
      "scifi",
    ]);
  });

  it("excludes books that are not in the list from the counts", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const herbert = await createAuthor(userId, "Frank Herbert");
    const listed = await addBookToList(listId, 0, { genres: ["fantasy"], title: "Dune", userId });
    const unlisted = await createBook({ genres: ["fantasy"], title: "Dune Messiah", userId });
    await linkAuthor(listed, herbert);
    await linkAuthor(unlisted, herbert);

    const res = await getFacets(accessToken, listId);

    expect(res.body).toEqual({
      authors: [{ count: 1, id: herbert, name: "Frank Herbert" }],
      genres: [{ count: 1, key: "fantasy", name: "fantasy" }],
    });
  });

  it("excludes trashed books from the counts", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const herbert = await createAuthor(userId, "Frank Herbert");
    const asimov = await createAuthor(userId, "Isaac Asimov");
    const trashed = await addBookToList(listId, 0, { genres: ["fantasy"], title: "Dune", userId });
    const kept = await addBookToList(listId, 1, { genres: ["scifi"], title: "Foundation", userId });
    await linkAuthor(trashed, herbert);
    await linkAuthor(kept, asimov);
    await trashBook(trashed);

    const res = await getFacets(accessToken, listId);

    expect(res.body).toEqual({
      authors: [{ count: 1, id: asimov, name: "Isaac Asimov" }],
      genres: [{ count: 1, key: "scifi", name: "scifi" }],
    });
  });

  it("ignores the filters that narrow the books page", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const herbert = await createAuthor(userId, "Frank Herbert");
    const asimov = await createAuthor(userId, "Isaac Asimov");
    const dune = await addBookToList(listId, 0, {
      genres: ["fantasy"],
      readingStatus: "finished",
      title: "Dune",
      userId,
    });
    const foundation = await addBookToList(listId, 1, {
      genres: ["scifi"],
      readingStatus: "reading",
      title: "Foundation",
      userId,
    });
    await linkAuthor(dune, herbert);
    await linkAuthor(foundation, asimov);

    const unfiltered = await getFacets(accessToken, listId);
    const filtered = await getFacets(accessToken, listId, {
      author: herbert,
      genre: "fantasy",
      search: "dune",
      status: "reading",
      tab: "finished",
    });

    expect(filtered.status).toBe(200);
    expect(filtered.body).toEqual(unfiltered.body);
  });

  it("falls back to the genre key when the genre has no visible name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createGenre("fantasy", "Фентезі");
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { genres: ["fantasy", "unmapped_key"], title: "Dune", userId });

    const res = await getFacets(accessToken, listId);

    expect(res.body.genres).toEqual([
      { count: 1, key: "fantasy", name: "Фентезі" },
      { count: 1, key: "unmapped_key", name: "unmapped_key" },
    ]);
  });
});

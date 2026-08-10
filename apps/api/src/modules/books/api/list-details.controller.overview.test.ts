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
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

const EMPTY_OVERVIEW = {
  currentlyReading: null,
  distinctAuthorsCount: 0,
  finishedCount: 0,
  genresCount: 0,
  inQueueCount: 0,
  ownedCount: 0,
  pagesKnownCount: 0,
  seriesCount: 0,
  soloCount: 0,
  topGenres: [],
  totalBooks: 0,
  totalPages: 0,
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

type CreateBookInput = {
  genres?: string[];
  ownershipStatus?: string;
  pagesCount?: Nullable<number>;
  partNumber?: Nullable<number>;
  queuePosition?: Nullable<number>;
  readingStatus?: string;
  seriesId?: Nullable<string>;
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
  ownershipStatus,
  pagesCount,
  partNumber,
  queuePosition,
  readingStatus,
  seriesId,
  title,
  userId,
}: CreateBookInput): Promise<string> {
  const book = await prisma.book.create({
    data: {
      firstAuthorName: "",
      genres: genres ?? [],
      ownershipStatus: ownershipStatus ?? "none",
      pagesCount: pagesCount ?? null,
      partNumber: partNumber ?? null,
      queuePosition: queuePosition ?? null,
      readingStatus: readingStatus ?? "not_started",
      seriesId: seriesId ?? null,
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

async function createSeries(userId: string, name: string): Promise<string> {
  const series = await prisma.series.create({
    data: { name, normalizedName: name.toLowerCase(), userId },
  });
  return series.id;
}

function getOverview(accessToken: string, listId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/lists/${listId}/overview`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function linkAuthor(bookId: string, authorId: string): Promise<void> {
  await prisma.bookAuthor.create({ data: { authorId, bookId, position: 0 } });
}

async function setReadingProgress(
  bookId: string,
  progress: { currentPage: number; lastProgressUpdateAt: string },
): Promise<void> {
  await prisma.bookReadingProgress.create({
    data: {
      bookId,
      currentPage: progress.currentPage,
      lastProgressUpdateAt: new Date(`${progress.lastProgressUpdateAt}T00:00:00.000Z`),
    },
  });
}

async function trashBook(bookId: string): Promise<void> {
  await prisma.book.update({ data: TRASH_RETENTION.stamp(), where: { id: bookId } });
}

describe("GET /api/lists/:listId/overview access", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(`/api/lists/${randomUUID()}/overview`);

    expect(res.status).toBe(401);
  });

  it("returns 404 when the list does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getOverview(accessToken, MISSING_UUID);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a list owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignListId = await createList(stranger.userId, "Secret");
    await addBookToList(foreignListId, 0, {
      readingStatus: "reading",
      title: "Dune",
      userId: stranger.userId,
    });

    const res = await getOverview(owner.accessToken, foreignListId);

    expect(res.status).toBe(404);
  });

  it("returns zeroed counters instead of 404 for an owned list without books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");

    const res = await getOverview(accessToken, listId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(EMPTY_OVERVIEW);
  });
});

describe("GET /api/lists/:listId/overview counters", () => {
  it("returns every overview field for a list holding books in each reading status", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const statuses = [
      "not_started",
      "want_to_read",
      "reading",
      "rereading",
      "finished",
      "paused",
      "dnf",
    ];
    for (const [index, readingStatus] of statuses.entries()) {
      await addBookToList(listId, index, { readingStatus, title: `Book ${readingStatus}`, userId });
    }

    const res = await getOverview(accessToken, listId);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      "currentlyReading",
      "distinctAuthorsCount",
      "finishedCount",
      "genresCount",
      "inQueueCount",
      "ownedCount",
      "pagesKnownCount",
      "seriesCount",
      "soloCount",
      "topGenres",
      "totalBooks",
      "totalPages",
    ]);
  });

  it("counts a finished book as finished and leaves a rereading book out", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { readingStatus: "finished", title: "Done", userId });
    await addBookToList(listId, 1, { readingStatus: "rereading", title: "Again", userId });
    await addBookToList(listId, 2, { readingStatus: "reading", title: "In progress", userId });

    const res = await getOverview(accessToken, listId);

    expect(res.body.finishedCount).toBe(1);
  });

  it("sums the pages of only the books whose page count is known", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { pagesCount: 300, title: "Thick", userId });
    await addBookToList(listId, 1, { pagesCount: 120, title: "Thin", userId });
    await addBookToList(listId, 2, { pagesCount: null, title: "Unmeasured", userId });

    const res = await getOverview(accessToken, listId);

    expect(res.body.totalPages).toBe(420);
  });

  it("counts only the books whose page count is known", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { pagesCount: 300, title: "Thick", userId });
    await addBookToList(listId, 1, { pagesCount: 120, title: "Thin", userId });
    await addBookToList(listId, 2, { pagesCount: null, title: "Unmeasured", userId });

    const res = await getOverview(accessToken, listId);

    expect(res.body.pagesKnownCount).toBe(2);
    expect(res.body.totalBooks).toBe(3);
  });

  it("counts both authors of a book written by two people", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const bookId = await addBookToList(listId, 0, { title: "Co-written", userId });
    await linkAuthor(bookId, await createAuthor(userId, "Frank Herbert"));
    await linkAuthor(bookId, await createAuthor(userId, "Isaac Asimov"));

    const res = await getOverview(accessToken, listId);

    expect(res.body.distinctAuthorsCount).toBe(2);
  });

  it("counts an author shared by two books only once", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const herbert = await createAuthor(userId, "Frank Herbert");
    const dune = await addBookToList(listId, 0, { title: "Dune", userId });
    const messiah = await addBookToList(listId, 1, { title: "Dune Messiah", userId });
    await linkAuthor(dune, herbert);
    await linkAuthor(messiah, herbert);

    const res = await getOverview(accessToken, listId);

    expect(res.body.distinctAuthorsCount).toBe(1);
  });

  it("counts no author for a book that has none", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const dune = await addBookToList(listId, 0, { title: "Dune", userId });
    await addBookToList(listId, 1, { title: "Anonymous", userId });
    await linkAuthor(dune, await createAuthor(userId, "Frank Herbert"));

    const res = await getOverview(accessToken, listId);

    expect(res.body.distinctAuthorsCount).toBe(1);
    expect(res.body.totalBooks).toBe(2);
  });

  it("splits the list into series parts and standalone books that add up to the total", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const seriesId = await createSeries(userId, "Dune saga");
    await addBookToList(listId, 0, { partNumber: 1, seriesId, title: "Dune", userId });
    await addBookToList(listId, 1, { partNumber: 2, seriesId, title: "Dune Messiah", userId });
    await addBookToList(listId, 2, { title: "Neuromancer", userId });
    await addBookToList(listId, 3, { title: "Solaris", userId });
    await addBookToList(listId, 4, { title: "Roadside Picnic", userId });

    const res = await getOverview(accessToken, listId);

    expect(res.body).toMatchObject({ seriesCount: 2, soloCount: 3, totalBooks: 5 });
  });

  it("counts owned, borrowed and lent books as physically owned", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const ownershipStatuses = [
      "owned",
      "borrowed_from_someone",
      "lent_to_someone",
      "want_to_buy",
      "in_transit",
      "none",
    ];
    for (const [index, ownershipStatus] of ownershipStatuses.entries()) {
      await addBookToList(listId, index, {
        ownershipStatus,
        title: `Book ${ownershipStatus}`,
        userId,
      });
    }

    const res = await getOverview(accessToken, listId);

    expect(res.body.ownedCount).toBe(3);
  });

  it("counts only the books that sit in the reading queue", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { queuePosition: 1, title: "Queued first", userId });
    await addBookToList(listId, 1, { queuePosition: 2, title: "Queued second", userId });
    await addBookToList(listId, 2, { title: "Loose", userId });

    const res = await getOverview(accessToken, listId);

    expect(res.body.inQueueCount).toBe(2);
  });

  it("excludes a trashed book from every counter", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const seriesId = await createSeries(userId, "Dune saga");
    const kept = await addBookToList(listId, 0, {
      genres: ["fantasy"],
      ownershipStatus: "owned",
      pagesCount: 100,
      partNumber: 1,
      queuePosition: 1,
      readingStatus: "finished",
      seriesId,
      title: "Dune",
      userId,
    });
    const trashed = await addBookToList(listId, 1, {
      genres: ["scifi"],
      ownershipStatus: "owned",
      pagesCount: 500,
      queuePosition: 2,
      readingStatus: "finished",
      title: "Neuromancer",
      userId,
    });
    await linkAuthor(kept, await createAuthor(userId, "Frank Herbert"));
    await linkAuthor(trashed, await createAuthor(userId, "William Gibson"));
    await trashBook(trashed);

    const res = await getOverview(accessToken, listId);

    expect(res.body).toEqual({
      ...EMPTY_OVERVIEW,
      distinctAuthorsCount: 1,
      finishedCount: 1,
      genresCount: 1,
      inQueueCount: 1,
      ownedCount: 1,
      pagesKnownCount: 1,
      seriesCount: 1,
      topGenres: [{ count: 1, key: "fantasy", name: "fantasy" }],
      totalBooks: 1,
      totalPages: 100,
    });
  });

  it("excludes a book of the same user that is not in the list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const listed = await addBookToList(listId, 0, {
      genres: ["fantasy"],
      ownershipStatus: "owned",
      pagesCount: 100,
      queuePosition: 1,
      readingStatus: "finished",
      title: "Dune",
      userId,
    });
    const unlisted = await createBook({
      genres: ["scifi"],
      ownershipStatus: "owned",
      pagesCount: 500,
      queuePosition: 2,
      readingStatus: "finished",
      title: "Neuromancer",
      userId,
    });
    await linkAuthor(listed, await createAuthor(userId, "Frank Herbert"));
    await linkAuthor(unlisted, await createAuthor(userId, "William Gibson"));

    const res = await getOverview(accessToken, listId);

    expect(res.body).toEqual({
      ...EMPTY_OVERVIEW,
      distinctAuthorsCount: 1,
      finishedCount: 1,
      genresCount: 1,
      inQueueCount: 1,
      ownedCount: 1,
      pagesKnownCount: 1,
      soloCount: 1,
      topGenres: [{ count: 1, key: "fantasy", name: "fantasy" }],
      totalBooks: 1,
      totalPages: 100,
    });
  });
});

describe("GET /api/lists/:listId/overview genres", () => {
  it("returns at most three top genres with their resolved names", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createGenre("fantasy", "Фентезі");
    await createGenre("scifi", "Наукова фантастика");
    await createGenre("history", "Історія");
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { genres: ["fantasy", "scifi"], title: "Dune", userId });
    await addBookToList(listId, 1, { genres: ["fantasy", "scifi"], title: "Foundation", userId });
    await addBookToList(listId, 2, { genres: ["fantasy", "history"], title: "Ubik", userId });
    await addBookToList(listId, 3, { genres: ["poetry"], title: "Kobzar", userId });

    const res = await getOverview(accessToken, listId);

    expect(res.body.topGenres).toEqual([
      { count: 3, key: "fantasy", name: "Фентезі" },
      { count: 2, key: "scifi", name: "Наукова фантастика" },
      { count: 1, key: "history", name: "Історія" },
    ]);
  });

  it("counts every distinct genre of the list beyond the top three", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { genres: ["fantasy", "scifi"], title: "Dune", userId });
    await addBookToList(listId, 1, { genres: ["history", "poetry"], title: "Kobzar", userId });

    const res = await getOverview(accessToken, listId);

    expect(res.body.genresCount).toBe(4);
  });

  it("falls back to the genre key when a top genre has no visible name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createGenre("fantasy", "Фентезі");
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { genres: ["fantasy", "unmapped_key"], title: "Dune", userId });

    const res = await getOverview(accessToken, listId);

    expect(res.body.topGenres).toEqual([
      { count: 1, key: "fantasy", name: "Фентезі" },
      { count: 1, key: "unmapped_key", name: "unmapped_key" },
    ]);
  });
});

describe("GET /api/lists/:listId/overview currently reading", () => {
  it("returns no currently reading book when nothing in the list is being read", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { readingStatus: "finished", title: "Done", userId });
    await addBookToList(listId, 1, { readingStatus: "paused", title: "On hold", userId });
    await addBookToList(listId, 2, { readingStatus: "want_to_read", title: "Someday", userId });

    const res = await getOverview(accessToken, listId);

    expect(res.body.currentlyReading).toBeNull();
  });

  it("highlights the most recently touched read and counts the other active reads", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const recent = await addBookToList(listId, 0, {
      readingStatus: "reading",
      title: "Recently touched",
      userId,
    });
    await addBookToList(listId, 1, { readingStatus: "reading", title: "Untouched", userId });
    await addBookToList(listId, 2, { readingStatus: "rereading", title: "Again", userId });
    await setReadingProgress(recent, { currentPage: 42, lastProgressUpdateAt: "2026-03-01" });

    const res = await getOverview(accessToken, listId);

    expect(res.body.currentlyReading).toMatchObject({
      book: { id: recent, title: "Recently touched" },
      othersCount: 2,
    });
  });

  it("returns the highlighted read as a full list book view", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const herbert = await createAuthor(userId, "Frank Herbert");
    const bookId = await addBookToList(listId, 3, {
      pagesCount: 400,
      readingStatus: "reading",
      title: "Dune",
      userId,
    });
    await linkAuthor(bookId, herbert);
    await setReadingProgress(bookId, { currentPage: 120, lastProgressUpdateAt: "2026-03-01" });

    const res = await getOverview(accessToken, listId);

    expect(res.body.currentlyReading.book).toMatchObject({
      authors: [{ id: herbert, name: "Frank Herbert" }],
      position: 3,
      readingProgress: { currentPage: 120, lastProgressUpdateAt: "2026-03-01" },
      title: "Dune",
    });
  });
});

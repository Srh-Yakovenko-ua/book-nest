import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

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
  formats?: string[];
  genres?: string[];
  isFavorite?: boolean;
  ownershipStatus?: string;
  pagesCount?: Nullable<number>;
  publicationYear?: Nullable<number>;
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
  firstAuthorName,
  formats,
  genres,
  isFavorite,
  ownershipStatus,
  pagesCount,
  publicationYear,
  queuePosition,
  readingStatus,
  seriesId,
  title,
  userId,
}: CreateBookInput): Promise<string> {
  const book = await prisma.book.create({
    data: {
      firstAuthorName: firstAuthorName ?? "",
      formats: formats ?? [],
      genres: genres ?? [],
      isFavorite: isFavorite ?? false,
      ownershipStatus: ownershipStatus ?? "none",
      pagesCount: pagesCount ?? null,
      publicationYear: publicationYear ?? null,
      queuePosition: queuePosition ?? null,
      readingStatus: readingStatus ?? "not_started",
      seriesId: seriesId ?? null,
      title,
      userId,
    },
  });
  return book.id;
}

async function createInterleavedStatusList(userId: string): Promise<string> {
  const listId = await createList(userId, "Autumn reads");
  await addBookToList(listId, 0, { readingStatus: "finished", title: "Finished first", userId });
  await addBookToList(listId, 1, { readingStatus: "reading", title: "Reading second", userId });
  await addBookToList(listId, 2, { readingStatus: "finished", title: "Finished third", userId });
  await addBookToList(listId, 3, { readingStatus: "rereading", title: "Rereading fourth", userId });
  await addBookToList(listId, 4, {
    readingStatus: "not_started",
    title: "Untouched fifth",
    userId,
  });
  await addBookToList(listId, 5, { readingStatus: "finished", title: "Finished sixth", userId });
  return listId;
}

async function createList(userId: string, name: string): Promise<string> {
  const created = await prisma.bookList.create({
    data: { description: null, name, normalizedName: name.trim().toLowerCase(), userId },
  });
  return created.id;
}

async function createMixedStatusList(userId: string): Promise<string> {
  const listId = await createList(userId, "Autumn reads");
  await addBookToList(listId, 0, {
    genres: ["fantasy"],
    readingStatus: "finished",
    title: "Fantasy finished",
    userId,
  });
  await addBookToList(listId, 1, {
    genres: ["fantasy"],
    readingStatus: "reading",
    title: "Fantasy reading",
    userId,
  });
  await addBookToList(listId, 2, {
    genres: ["scifi"],
    readingStatus: "finished",
    title: "Space finished",
    userId,
  });
  await addBookToList(listId, 3, {
    genres: ["scifi"],
    readingStatus: "not_started",
    title: "Space untouched",
    userId,
  });
  return listId;
}

async function createQuickFilterList(userId: string): Promise<string> {
  const listId = await createList(userId, "Autumn reads");
  const seriesId = await createSeries(userId, "Dune saga");
  await addBookToList(listId, 0, {
    isFavorite: true,
    queuePosition: 1,
    readingStatus: "reading",
    title: "Queued favourite",
    userId,
  });
  await addBookToList(listId, 1, {
    queuePosition: 2,
    readingStatus: "not_started",
    seriesId,
    title: "Queued series part",
    userId,
  });
  await addBookToList(listId, 2, {
    isFavorite: true,
    readingStatus: "finished",
    title: "Finished favourite",
    userId,
  });
  await addBookToList(listId, 3, { readingStatus: "not_started", title: "Plain book", userId });
  return listId;
}

async function createRatedList(userId: string): Promise<string> {
  const listId = await createList(userId, "Autumn reads");
  const slim = await addBookToList(listId, 0, {
    pagesCount: 120,
    title: "Slim classic",
    userId,
  });
  const middling = await addBookToList(listId, 1, {
    pagesCount: 400,
    title: "Middling tome",
    userId,
  });
  const doorstopper = await addBookToList(listId, 2, {
    pagesCount: 900,
    title: "Doorstopper",
    userId,
  });
  await addBookToList(listId, 3, { pagesCount: 50, title: "Unrated pamphlet", userId });
  await setRating(slim, 9);
  await setRating(middling, 5);
  await setRating(doorstopper, 2);
  return listId;
}

async function createSeries(userId: string, name: string): Promise<string> {
  const series = await prisma.series.create({
    data: { name, normalizedName: name.toLowerCase(), userId },
  });
  return series.id;
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

describe("GET /api/lists/:listId filters", () => {
  it("narrows the page to the requested reading statuses", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { readingStatus: "reading", title: "In progress", userId });
    await addBookToList(listId, 1, { readingStatus: "finished", title: "Done", userId });

    const res = await getDetail(accessToken, listId, { status: "reading" });

    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual(["In progress"]);
  });

  it("narrows the page to the reading statuses of the requested tab", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { readingStatus: "not_started", title: "Untouched", userId });
    await addBookToList(listId, 1, { readingStatus: "want_to_read", title: "Someday", userId });
    await addBookToList(listId, 2, { readingStatus: "reading", title: "In progress", userId });

    const res = await getDetail(accessToken, listId, { tab: "not_started" });

    expect(res.body.books.totalCount).toBe(2);
    expect(titles(res.body)).toEqual(["Untouched", "Someday"]);
  });

  it("narrows the page to the requested ownership statuses", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { ownershipStatus: "owned", title: "On the shelf", userId });
    await addBookToList(listId, 1, { ownershipStatus: "want_to_buy", title: "Wanted", userId });
    await addBookToList(listId, 2, { ownershipStatus: "none", title: "Unowned", userId });

    const res = await getDetail(accessToken, listId, { owner: "owned,want_to_buy" });

    expect(titles(res.body)).toEqual(["On the shelf", "Wanted"]);
  });

  it("narrows the page to the requested formats", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { formats: ["paper"], title: "Paperback", userId });
    await addBookToList(listId, 1, { formats: ["ebook", "audiobook"], title: "Digital", userId });
    await addBookToList(listId, 2, { title: "Format unknown", userId });

    const res = await getDetail(accessToken, listId, { format: "audiobook" });

    expect(titles(res.body)).toEqual(["Digital"]);
  });

  it("narrows the page to the requested genres", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { genres: ["fantasy"], title: "Fantasy pick", userId });
    await addBookToList(listId, 1, { genres: ["scifi"], title: "Space pick", userId });
    await addBookToList(listId, 2, { title: "Unclassified", userId });

    const res = await getDetail(accessToken, listId, { genre: "fantasy" });

    expect(titles(res.body)).toEqual(["Fantasy pick"]);
  });

  it("narrows the page to the requested authors", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const herbert = await createAuthor(userId, "Frank Herbert");
    const asimov = await createAuthor(userId, "Isaac Asimov");
    const dune = await addBookToList(listId, 0, { title: "Dune", userId });
    const foundation = await addBookToList(listId, 1, { title: "Foundation", userId });
    await linkAuthor(dune, herbert);
    await linkAuthor(foundation, asimov);

    const res = await getDetail(accessToken, listId, { author: herbert });

    expect(titles(res.body)).toEqual(["Dune"]);
  });

  it("narrows the page to standalone books when bookType is solo", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const seriesId = await createSeries(userId, "Dune saga");
    await addBookToList(listId, 0, { seriesId, title: "Dune Messiah", userId });
    await addBookToList(listId, 1, { title: "Standalone", userId });

    const res = await getDetail(accessToken, listId, { bookType: "solo" });

    expect(titles(res.body)).toEqual(["Standalone"]);
  });

  it("narrows the page to series parts when bookType is series_part", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const seriesId = await createSeries(userId, "Dune saga");
    await addBookToList(listId, 0, { seriesId, title: "Dune Messiah", userId });
    await addBookToList(listId, 1, { title: "Standalone", userId });

    const res = await getDetail(accessToken, listId, { bookType: "series_part" });

    expect(titles(res.body)).toEqual(["Dune Messiah"]);
  });

  it("narrows the page to favourite books when isFavorite is true", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { isFavorite: true, title: "Beloved", userId });
    await addBookToList(listId, 1, { title: "Just a book", userId });

    const res = await getDetail(accessToken, listId, { isFavorite: "true" });

    expect(titles(res.body)).toEqual(["Beloved"]);
  });

  it("partitions the list between books in the reading queue and books outside it", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { queuePosition: 1, title: "Queued first", userId });
    await addBookToList(listId, 1, { queuePosition: 2, title: "Queued second", userId });
    await addBookToList(listId, 2, { title: "Loose one", userId });
    await addBookToList(listId, 3, { title: "Loose two", userId });

    const queued = await getDetail(accessToken, listId, { inQueue: "true" });
    const unqueued = await getDetail(accessToken, listId, { inQueue: "false" });

    expect(titles(queued.body)).toEqual(["Queued first", "Queued second"]);
    expect(titles(unqueued.body)).toEqual(["Loose one", "Loose two"]);
    expect(queued.body.books.totalCount + unqueued.body.books.totalCount).toBe(4);
  });

  it("never returns a book that matches every filter but is not in the list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const herbert = await createAuthor(userId, "Frank Herbert");
    const matching: CreateBookInput = {
      formats: ["paper"],
      genres: ["fantasy"],
      isFavorite: true,
      ownershipStatus: "owned",
      queuePosition: 1,
      readingStatus: "reading",
      title: "Inside the list",
      userId,
    };
    const listed = await addBookToList(listId, 0, matching);
    const unlisted = await createBook({
      ...matching,
      queuePosition: 2,
      title: "Outside the list",
    });
    await linkAuthor(listed, herbert);
    await linkAuthor(unlisted, herbert);

    const res = await getDetail(accessToken, listId, {
      author: herbert,
      bookType: "solo",
      format: "paper",
      genre: "fantasy",
      inQueue: "true",
      isFavorite: "true",
      owner: "owned",
      status: "reading",
      tab: "reading",
    });

    expect(res.body.books.totalCount).toBe(1);
    expect(titles(res.body)).toEqual(["Inside the list"]);
  });

  it("keeps the header book count at the unfiltered total when a filter narrows the page", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { genres: ["fantasy"], title: "Fantasy pick", userId });
    await addBookToList(listId, 1, { genres: ["scifi"], title: "Space pick", userId });
    await addBookToList(listId, 2, { title: "Unclassified", userId });

    const res = await getDetail(accessToken, listId, { genre: "fantasy" });

    expect(res.body.bookCount).toBe(3);
    expect(res.body.books.totalCount).toBe(1);
  });
});

describe("GET /api/lists/:listId quick counts", () => {
  it("returns a count for every quick filter of the list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createMixedStatusList(userId);

    const res = await getDetail(accessToken, listId);

    expect(res.body.quickCounts).toEqual({
      all: 4,
      favorites: 0,
      finished: 2,
      in_queue: 0,
      not_started: 1,
      reading: 1,
      series: 0,
    });
  });

  it("counts the favourite, queued and series books of the list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createQuickFilterList(userId);

    const res = await getDetail(accessToken, listId);

    expect(res.body.quickCounts).toEqual({
      all: 4,
      favorites: 2,
      finished: 1,
      in_queue: 2,
      not_started: 2,
      reading: 1,
      series: 1,
    });
  });

  it("keeps the quick counts unchanged when the requested tab changes", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createMixedStatusList(userId);

    const allTab = await getDetail(accessToken, listId, { tab: "all" });
    const finishedTab = await getDetail(accessToken, listId, { tab: "finished" });

    expect(finishedTab.body.quickCounts).toEqual(allTab.body.quickCounts);
    expect(titles(finishedTab.body)).toEqual(["Fantasy finished", "Space finished"]);
  });

  it("keeps the quick counts unchanged when the status filter changes", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createMixedStatusList(userId);

    const unfiltered = await getDetail(accessToken, listId);
    const filtered = await getDetail(accessToken, listId, { status: "reading" });

    expect(filtered.body.quickCounts).toEqual(unfiltered.body.quickCounts);
    expect(titles(filtered.body)).toEqual(["Fantasy reading"]);
  });

  it("keeps the quick counts unchanged when a sibling chip is pressed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createQuickFilterList(userId);

    const unfiltered = await getDetail(accessToken, listId);
    const favorites = await getDetail(accessToken, listId, { isFavorite: "true" });
    const queued = await getDetail(accessToken, listId, { inQueue: "true" });
    const series = await getDetail(accessToken, listId, { bookType: "series_part" });

    expect(favorites.body.quickCounts).toEqual(unfiltered.body.quickCounts);
    expect(queued.body.quickCounts).toEqual(unfiltered.body.quickCounts);
    expect(series.body.quickCounts).toEqual(unfiltered.body.quickCounts);
  });

  it("narrows every quick count when a genre filter is applied", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createMixedStatusList(userId);

    const res = await getDetail(accessToken, listId, { genre: "fantasy" });

    expect(res.body.quickCounts).toEqual({
      all: 2,
      favorites: 0,
      finished: 1,
      in_queue: 0,
      not_started: 0,
      reading: 1,
      series: 0,
    });
  });

  it("counts want_to_read under not_started and rereading under reading", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { readingStatus: "want_to_read", title: "Someday", userId });
    await addBookToList(listId, 1, { readingStatus: "rereading", title: "Again", userId });

    const res = await getDetail(accessToken, listId);

    expect(res.body.quickCounts).toEqual({
      all: 2,
      favorites: 0,
      finished: 0,
      in_queue: 0,
      not_started: 1,
      reading: 1,
      series: 0,
    });
  });

  it("counts a paused book in the all bucket only", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { readingStatus: "paused", title: "On hold", userId });

    const res = await getDetail(accessToken, listId);

    expect(res.body.quickCounts).toEqual({
      all: 1,
      favorites: 0,
      finished: 0,
      in_queue: 0,
      not_started: 0,
      reading: 0,
      series: 0,
    });
  });
});

describe("GET /api/lists/:listId quick filter pagination", () => {
  it("pages the favourites while the quick counts keep the whole list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createQuickFilterList(userId);

    const res = await getDetail(accessToken, listId, { isFavorite: "true" });

    expect(res.body.quickCounts.all).toBe(4);
    expect(res.body.quickCounts.favorites).toBe(2);
    expect(res.body.books.totalCount).toBe(2);
    expect(titles(res.body)).toEqual(["Queued favourite", "Finished favourite"]);
  });

  it("pages the queued books while the quick counts keep the whole list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createQuickFilterList(userId);

    const res = await getDetail(accessToken, listId, { inQueue: "true" });

    expect(res.body.quickCounts.all).toBe(4);
    expect(res.body.books.totalCount).toBe(2);
    expect(titles(res.body)).toEqual(["Queued favourite", "Queued series part"]);
  });

  it("pages the series parts while the quick counts keep the whole list", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createQuickFilterList(userId);

    const res = await getDetail(accessToken, listId, { bookType: "series_part" });

    expect(res.body.quickCounts.all).toBe(4);
    expect(res.body.books.totalCount).toBe(1);
    expect(titles(res.body)).toEqual(["Queued series part"]);
  });

  it("counts only the last page of the favourites as the page total", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createQuickFilterList(userId);

    const res = await getDetail(accessToken, listId, {
      isFavorite: "true",
      pageNumber: "2",
      pageSize: "1",
    });

    expect(res.body.books.totalCount).toBe(2);
    expect(res.body.books.pagesCount).toBe(2);
    expect(titles(res.body)).toEqual(["Finished favourite"]);
  });
});

describe("GET /api/lists/:listId sorting", () => {
  it("orders books by first author name descending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { firstAuthorName: "Zelazny", title: "Amber", userId });
    await addBookToList(listId, 1, { firstAuthorName: "Asimov", title: "Foundation", userId });
    await addBookToList(listId, 2, { firstAuthorName: "Herbert", title: "Dune", userId });

    const res = await getDetail(accessToken, listId, { sort: "author_desc" });

    expect(titles(res.body)).toEqual(["Amber", "Dune", "Foundation"]);
  });

  it("orders books by rating ascending with unrated books last", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    const high = await addBookToList(listId, 0, { title: "High", userId });
    const mid = await addBookToList(listId, 1, { title: "Mid", userId });
    const low = await addBookToList(listId, 2, { title: "Low", userId });
    await addBookToList(listId, 3, { title: "None", userId });
    await setRating(high, 9);
    await setRating(mid, 5);
    await setRating(low, 2);

    const res = await getDetail(accessToken, listId, { sort: "rating_asc" });

    expect(titles(res.body)).toEqual(["Low", "Mid", "High", "None"]);
  });
});

describe("GET /api/lists/:listId status sorting", () => {
  it("puts every unfinished book before every finished one and keeps position order inside each group", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createInterleavedStatusList(userId);

    const res = await getDetail(accessToken, listId, { sort: "status_unread_first" });

    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual([
      "Reading second",
      "Rereading fourth",
      "Untouched fifth",
      "Finished first",
      "Finished third",
      "Finished sixth",
    ]);
  });

  it("treats a rereading book as unfinished even though it sits after a finished one", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { readingStatus: "finished", title: "Read once", userId });
    await addBookToList(listId, 1, { readingStatus: "rereading", title: "Reading again", userId });

    const res = await getDetail(accessToken, listId, { sort: "status_unread_first" });

    expect(titles(res.body)).toEqual(["Reading again", "Read once"]);
  });

  it("returns the exact inverse group order for status_read_first", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createInterleavedStatusList(userId);

    const res = await getDetail(accessToken, listId, { sort: "status_read_first" });

    expect(titles(res.body)).toEqual([
      "Finished first",
      "Finished third",
      "Finished sixth",
      "Reading second",
      "Rereading fourth",
      "Untouched fifth",
    ]);
  });
});

describe("GET /api/lists/:listId year sorting", () => {
  it("orders books by publication year descending with undated books last", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { publicationYear: 2001, title: "Millennial", userId });
    await addBookToList(listId, 1, { title: "Undated", userId });
    await addBookToList(listId, 2, { publicationYear: 2010, title: "Recent", userId });
    await addBookToList(listId, 3, { publicationYear: 1999, title: "Vintage", userId });

    const res = await getDetail(accessToken, listId, { sort: "year_desc" });

    expect(titles(res.body)).toEqual(["Recent", "Millennial", "Vintage", "Undated"]);
  });

  it("orders books by publication year ascending with undated books last", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { publicationYear: 2001, title: "Millennial", userId });
    await addBookToList(listId, 1, { title: "Undated", userId });
    await addBookToList(listId, 2, { publicationYear: 2010, title: "Recent", userId });
    await addBookToList(listId, 3, { publicationYear: 1999, title: "Vintage", userId });

    const res = await getDetail(accessToken, listId, { sort: "year_asc" });

    expect(titles(res.body)).toEqual(["Vintage", "Millennial", "Recent", "Undated"]);
  });
});

describe("GET /api/lists/:listId rating and pages filters", () => {
  it("keeps only books rated at least ratingMin", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createRatedList(userId);

    const res = await getDetail(accessToken, listId, { ratingMin: "5" });

    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual(["Slim classic", "Middling tome"]);
  });

  it("keeps only books rated at most ratingMax", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createRatedList(userId);

    const res = await getDetail(accessToken, listId, { ratingMax: "5" });

    expect(titles(res.body)).toEqual(["Middling tome", "Doorstopper"]);
  });

  it("keeps only unrated books when hasRating is false", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createRatedList(userId);

    const res = await getDetail(accessToken, listId, { hasRating: "false" });

    expect(titles(res.body)).toEqual(["Unrated pamphlet"]);
  });

  it("keeps only books with at least pagesMin pages", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createRatedList(userId);

    const res = await getDetail(accessToken, listId, { pagesMin: "400" });

    expect(titles(res.body)).toEqual(["Middling tome", "Doorstopper"]);
  });

  it("keeps only books with at most pagesMax pages", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createRatedList(userId);

    const res = await getDetail(accessToken, listId, { pagesMax: "120" });

    expect(titles(res.body)).toEqual(["Slim classic", "Unrated pamphlet"]);
  });

  it("never returns a rated book outside the list that matches the rating range", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createRatedList(userId);
    const unlisted = await createBook({ pagesCount: 400, title: "Outside the list", userId });
    await setRating(unlisted, 9);

    const res = await getDetail(accessToken, listId, { pagesMin: "100", ratingMin: "5" });

    expect(res.body.books.totalCount).toBe(2);
    expect(titles(res.body)).toEqual(["Slim classic", "Middling tome"]);
  });

  it("rejects a rating range whose minimum exceeds its maximum", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createRatedList(userId);

    const res = await getDetail(accessToken, listId, { ratingMax: "2", ratingMin: "9" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "ratingMin", message: expect.any(String) }),
      ]),
    );
  });

  it("rejects a pages range whose minimum exceeds its maximum", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createRatedList(userId);

    const res = await getDetail(accessToken, listId, { pagesMax: "100", pagesMin: "900" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "pagesMin", message: expect.any(String) }),
      ]),
    );
  });
});

describe("GET /api/lists/:listId search", () => {
  it("ignores a search query shorter than two characters", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { title: "Dune", userId });
    await addBookToList(listId, 1, { title: "Foundation", userId });
    await addBookToList(listId, 2, { title: "Neuromancer", userId });

    const res = await getDetail(accessToken, listId, { search: "d" });

    expect(res.body.books.totalCount).toBe(3);
    expect(titles(res.body)).toEqual(["Dune", "Foundation", "Neuromancer"]);
  });

  it("applies a search query of at least two characters", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const listId = await createList(userId, "Autumn reads");
    await addBookToList(listId, 0, { title: "Dune", userId });
    await addBookToList(listId, 1, { title: "Foundation", userId });
    await addBookToList(listId, 2, { title: "Neuromancer", userId });

    const res = await getDetail(accessToken, listId, { search: "du" });

    expect(res.body.books.totalCount).toBe(1);
    expect(titles(res.body)).toEqual(["Dune"]);
  });
});

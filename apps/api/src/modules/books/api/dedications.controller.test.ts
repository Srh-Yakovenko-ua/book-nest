import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../books.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule]);
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

type DedicationBook = {
  dedication: string;
  id: string;
  isFavoriteDedication: boolean;
  title: string;
};

type SeedBookInput = {
  authorId: string;
  createdAt?: Date;
  dedication?: null | string;
  firstAuthorName?: string;
  genres?: string[];
  isFavoriteDedication?: boolean;
  publicationYear?: null | number;
  readingStatus?: string;
  title?: string;
  userId: string;
};

function getDedications(accessToken: string, query: Record<string, string> = {}): request.Test {
  return request(app.getHttpServer())
    .get("/api/books/dedications")
    .query(query)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getSummary(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/books/dedications/summary")
    .set("Authorization", `Bearer ${accessToken}`);
}

function seedAuthor(input: { name: string; userId: string }): Promise<{ id: string }> {
  return prisma.author.create({
    data: { name: input.name, normalizedName: input.name.toLowerCase(), userId: input.userId },
    select: { id: true },
  });
}

function seedBook(input: SeedBookInput): Promise<{ id: string }> {
  return prisma.book.create({
    data: {
      authors: { create: [{ authorId: input.authorId, position: 0 }] },
      createdAt: input.createdAt,
      dedication: input.dedication === undefined ? null : input.dedication,
      firstAuthorName: input.firstAuthorName ?? "",
      genres: input.genres ?? [],
      isFavoriteDedication: input.isFavoriteDedication ?? false,
      publicationYear: input.publicationYear ?? null,
      readingStatus: input.readingStatus ?? "not_started",
      title: input.title ?? "Untitled",
      userId: input.userId,
    },
    select: { id: true },
  });
}

function titlesOf(body: { items: DedicationBook[] }): string[] {
  return body.items.map((book) => book.title);
}

describe("GET /api/books/dedications", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/books/dedications");

    expect(res.status).toBe(401);
  });

  it("resolves the list route instead of the :id handler and returns an empty page", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getDedications(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [],
      page: 1,
      pagesCount: 0,
      pageSize: 12,
      totalCount: 0,
    });
  });

  it("returns only books that carry a real dedication", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });

    await seedBook({ authorId: author.id, dedication: "For my mother", title: "Real", userId });
    await seedBook({ authorId: author.id, dedication: null, title: "Null", userId });
    await seedBook({ authorId: author.id, dedication: "", title: "Empty", userId });
    await request(app.getHttpServer())
      .post("/api/books")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ authors: [{ name: "Frank Herbert" }], dedication: "   ", title: "Whitespace" });

    const res = await getDedications(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Real"]);
  });

  describe("filter", () => {
    async function seedFilterSet(): Promise<string> {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "Frank Herbert", userId });
      await seedBook({
        authorId: author.id,
        dedication: "d",
        isFavoriteDedication: false,
        readingStatus: "finished",
        title: "PlainFinished",
        userId,
      });
      await seedBook({
        authorId: author.id,
        dedication: "d",
        isFavoriteDedication: true,
        readingStatus: "reading",
        title: "FavReading",
        userId,
      });
      await seedBook({
        authorId: author.id,
        dedication: "d",
        isFavoriteDedication: true,
        readingStatus: "finished",
        title: "FavFinished",
        userId,
      });
      await seedBook({
        authorId: author.id,
        dedication: "d",
        isFavoriteDedication: false,
        readingStatus: "not_started",
        title: "PlainUnstarted",
        userId,
      });
      return accessToken;
    }

    it("returns every dedication for filter=all", async () => {
      const accessToken = await seedFilterSet();

      const res = await getDedications(accessToken, { filter: "all" });

      expect(res.body.totalCount).toBe(4);
    });

    it("returns only favorite dedications for filter=favorites", async () => {
      const accessToken = await seedFilterSet();

      const res = await getDedications(accessToken, { filter: "favorites" });

      expect(titlesOf(res.body).sort()).toEqual(["FavFinished", "FavReading"]);
    });

    it("returns only non-favorite dedications for filter=without_favorites", async () => {
      const accessToken = await seedFilterSet();

      const res = await getDedications(accessToken, { filter: "without_favorites" });

      expect(titlesOf(res.body).sort()).toEqual(["PlainFinished", "PlainUnstarted"]);
    });

    it("returns only finished dedications for filter=finished", async () => {
      const accessToken = await seedFilterSet();

      const res = await getDedications(accessToken, { filter: "finished" });

      expect(titlesOf(res.body).sort()).toEqual(["FavFinished", "PlainFinished"]);
    });

    it("returns only unfinished dedications for filter=unfinished", async () => {
      const accessToken = await seedFilterSet();

      const res = await getDedications(accessToken, { filter: "unfinished" });

      expect(titlesOf(res.body).sort()).toEqual(["FavReading", "PlainUnstarted"]);
    });
  });

  describe("sort", () => {
    it("orders by newest (created descending) by default", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "A", userId });
      await seedBook({
        authorId: author.id,
        createdAt: new Date("2020-01-01T00:00:00Z"),
        dedication: "d",
        title: "Old",
        userId,
      });
      await seedBook({
        authorId: author.id,
        createdAt: new Date("2022-01-01T00:00:00Z"),
        dedication: "d",
        title: "New",
        userId,
      });
      await seedBook({
        authorId: author.id,
        createdAt: new Date("2021-01-01T00:00:00Z"),
        dedication: "d",
        title: "Mid",
        userId,
      });

      const res = await getDedications(accessToken, { sort: "newest" });

      expect(titlesOf(res.body)).toEqual(["New", "Mid", "Old"]);
    });

    it("orders by recently_updated (updated descending)", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "A", userId });
      const first = await seedBook({
        authorId: author.id,
        dedication: "d",
        title: "First",
        userId,
      });
      const second = await seedBook({
        authorId: author.id,
        dedication: "d",
        title: "Second",
        userId,
      });
      const third = await seedBook({
        authorId: author.id,
        dedication: "d",
        title: "Third",
        userId,
      });

      await prisma.book.update({ data: { title: "First" }, where: { id: first.id } });
      await prisma.book.update({ data: { title: "Third" }, where: { id: third.id } });
      await prisma.book.update({ data: { title: "Second" }, where: { id: second.id } });

      const res = await getDedications(accessToken, { sort: "recently_updated" });

      expect(titlesOf(res.body)).toEqual(["Second", "Third", "First"]);
    });

    it("orders by book_title_asc", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "A", userId });
      await seedBook({ authorId: author.id, dedication: "d", title: "Charlie", userId });
      await seedBook({ authorId: author.id, dedication: "d", title: "Alpha", userId });
      await seedBook({ authorId: author.id, dedication: "d", title: "Bravo", userId });

      const res = await getDedications(accessToken, { sort: "book_title_asc" });

      expect(titlesOf(res.body)).toEqual(["Alpha", "Bravo", "Charlie"]);
    });

    it("orders by author_asc using the denormalized first author name", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "A", userId });
      await seedBook({
        authorId: author.id,
        dedication: "d",
        firstAuthorName: "Clarke",
        title: "Clarke book",
        userId,
      });
      await seedBook({
        authorId: author.id,
        dedication: "d",
        firstAuthorName: "Asimov",
        title: "Asimov book",
        userId,
      });
      await seedBook({
        authorId: author.id,
        dedication: "d",
        firstAuthorName: "Bradbury",
        title: "Bradbury book",
        userId,
      });

      const res = await getDedications(accessToken, { sort: "author_asc" });

      expect(titlesOf(res.body)).toEqual(["Asimov book", "Bradbury book", "Clarke book"]);
    });

    it("orders by favorites_first then created descending", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "A", userId });
      await seedBook({
        authorId: author.id,
        createdAt: new Date("2020-01-01T00:00:00Z"),
        dedication: "d",
        isFavoriteDedication: true,
        title: "FavOld",
        userId,
      });
      await seedBook({
        authorId: author.id,
        createdAt: new Date("2022-01-01T00:00:00Z"),
        dedication: "d",
        isFavoriteDedication: true,
        title: "FavNew",
        userId,
      });
      await seedBook({
        authorId: author.id,
        createdAt: new Date("2023-01-01T00:00:00Z"),
        dedication: "d",
        isFavoriteDedication: false,
        title: "PlainNewest",
        userId,
      });

      const res = await getDedications(accessToken, { sort: "favorites_first" });

      expect(titlesOf(res.body)).toEqual(["FavNew", "FavOld", "PlainNewest"]);
    });

    it("orders by publication_year_desc with nulls last", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "A", userId });
      await seedBook({
        authorId: author.id,
        dedication: "d",
        publicationYear: 2000,
        title: "Y2000",
        userId,
      });
      await seedBook({
        authorId: author.id,
        dedication: "d",
        publicationYear: null,
        title: "NoYear",
        userId,
      });
      await seedBook({
        authorId: author.id,
        dedication: "d",
        publicationYear: 2020,
        title: "Y2020",
        userId,
      });

      const res = await getDedications(accessToken, { sort: "publication_year_desc" });

      expect(titlesOf(res.body)).toEqual(["Y2020", "Y2000", "NoYear"]);
    });
  });

  describe("search", () => {
    it("matches on dedication text, title and author name", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const neutral = await seedAuthor({ name: "Zeta Writer", userId });
      const claraAuthor = await seedAuthor({ name: "Clara Author", userId });

      await seedBook({
        authorId: neutral.id,
        dedication: "For beloved Clara",
        title: "Alpha",
        userId,
      });
      await seedBook({
        authorId: neutral.id,
        dedication: "no relation here",
        title: "Clara Chronicles",
        userId,
      });
      await seedBook({ authorId: claraAuthor.id, dedication: "nothing", title: "Beta", userId });
      await seedBook({
        authorId: neutral.id,
        dedication: "unrelated text",
        title: "Gamma",
        userId,
      });

      const res = await getDedications(accessToken, { q: "clara" });

      expect(titlesOf(res.body).sort()).toEqual(["Alpha", "Beta", "Clara Chronicles"]);
    });

    it("finds a book whose only match is its dedication text", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "Nobody", userId });
      await seedBook({
        authorId: author.id,
        dedication: "To the memory of Wintermute",
        title: "Untitled Work",
        userId,
      });
      await seedBook({ authorId: author.id, dedication: "something else", title: "Other", userId });

      const res = await getDedications(accessToken, { q: "wintermute" });

      expect(titlesOf(res.body)).toEqual(["Untitled Work"]);
    });
  });

  it("filters by a single genre key", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "A", userId });
    await seedBook({
      authorId: author.id,
      dedication: "d",
      genres: ["memoir"],
      title: "M",
      userId,
    });
    await seedBook({
      authorId: author.id,
      dedication: "d",
      genres: ["history"],
      title: "H",
      userId,
    });
    await seedBook({
      authorId: author.id,
      dedication: "d",
      genres: ["memoir", "history"],
      title: "MH",
      userId,
    });

    const res = await getDedications(accessToken, { genre: "memoir" });

    expect(titlesOf(res.body).sort()).toEqual(["M", "MH"]);
  });

  it("paginates the result set", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "A", userId });
    for (let index = 0; index < 5; index += 1) {
      await seedBook({
        authorId: author.id,
        createdAt: new Date(`2020-01-0${index + 1}T00:00:00Z`),
        dedication: "d",
        title: `Book ${index}`,
        userId,
      });
    }

    const firstPage = await getDedications(accessToken, { pageNumber: "1", pageSize: "2" });
    const lastPage = await getDedications(accessToken, { pageNumber: "3", pageSize: "2" });

    expect(firstPage.body.totalCount).toBe(5);
    expect(firstPage.body.pagesCount).toBe(3);
    expect(firstPage.body.items).toHaveLength(2);
    expect(lastPage.body.items).toHaveLength(1);

    const firstIds = firstPage.body.items.map((book: DedicationBook) => book.id);
    const lastIds = lastPage.body.items.map((book: DedicationBook) => book.id);
    expect(firstIds).not.toEqual(expect.arrayContaining(lastIds));
  });

  it("never leaks another user's dedications", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerAuthor = await seedAuthor({ name: "Frank Herbert", userId: owner.userId });
    const strangerAuthor = await seedAuthor({ name: "Isaac Asimov", userId: stranger.userId });
    await seedBook({
      authorId: ownerAuthor.id,
      dedication: "For my readers",
      title: "Owner Dedication",
      userId: owner.userId,
    });
    await seedBook({
      authorId: strangerAuthor.id,
      dedication: "Not yours",
      title: "Stranger Dedication",
      userId: stranger.userId,
    });

    const res = await getDedications(owner.accessToken);

    expect(titlesOf(res.body)).toEqual(["Owner Dedication"]);
  });
});

describe("GET /api/books/dedications/summary", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/books/dedications/summary");

    expect(res.status).toBe(401);
  });

  it("resolves the summary route and returns an empty summary", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      authorsCount: 0,
      availableGenres: [],
      favoriteCount: 0,
      finishedCount: 0,
      topAuthor: null,
      topGenre: null,
      totalCount: 0,
      unfinishedCount: 0,
    });
  });

  it("aggregates stats and distinct genres across all dedications", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const herbert = await seedAuthor({ name: "Frank Herbert", userId });
    const asimov = await seedAuthor({ name: "Isaac Asimov", userId });

    await seedBook({
      authorId: herbert.id,
      dedication: "For my mother",
      genres: ["memoir", "history"],
      readingStatus: "finished",
      title: "Finished dedication",
      userId,
    });
    await seedBook({
      authorId: asimov.id,
      dedication: "To the reader",
      genres: ["memoir"],
      isFavoriteDedication: true,
      readingStatus: "reading",
      title: "Favorite dedication",
      userId,
    });
    await seedBook({ authorId: herbert.id, dedication: null, title: "No dedication", userId });

    const res = await getSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      authorsCount: 2,
      availableGenres: ["history", "memoir"],
      favoriteCount: 1,
      finishedCount: 1,
      topAuthor: { count: 1, name: "Frank Herbert" },
      topGenre: { count: 2, genre: "memoir" },
      totalCount: 2,
      unfinishedCount: 1,
    });
  });

  it("reconciles the summary with the unfiltered list and surfaces every genre", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const herbert = await seedAuthor({ name: "Frank Herbert", userId });
    const asimov = await seedAuthor({ name: "Isaac Asimov", userId });

    await seedBook({
      authorId: herbert.id,
      dedication: "one",
      genres: ["memoir", "history"],
      readingStatus: "finished",
      title: "One",
      userId,
    });
    await seedBook({
      authorId: herbert.id,
      dedication: "two",
      genres: ["memoir"],
      isFavoriteDedication: true,
      readingStatus: "reading",
      title: "Two",
      userId,
    });
    await seedBook({
      authorId: asimov.id,
      dedication: "three",
      genres: ["rare-solo-genre"],
      readingStatus: "not_started",
      title: "Three",
      userId,
    });
    await seedBook({ authorId: herbert.id, dedication: null, title: "No dedication", userId });

    const [summaryRes, listRes, rareGenreRes] = await Promise.all([
      getSummary(accessToken),
      getDedications(accessToken, { pageSize: "1" }),
      getDedications(accessToken, { genre: "rare-solo-genre" }),
    ]);

    expect(summaryRes.body.totalCount).toBe(listRes.body.totalCount);
    expect(summaryRes.body.totalCount).toBe(3);
    expect(summaryRes.body.authorsCount).toBe(2);
    expect(summaryRes.body.favoriteCount).toBe(1);
    expect(summaryRes.body.finishedCount).toBe(1);
    expect(summaryRes.body.unfinishedCount).toBe(2);
    expect(summaryRes.body.availableGenres).toEqual(["history", "memoir", "rare-solo-genre"]);
    expect(summaryRes.body.topGenre).toEqual({ count: 2, genre: "memoir" });
    expect(summaryRes.body.topAuthor).toEqual({ count: 2, name: "Frank Herbert" });
    expect(rareGenreRes.body.totalCount).toBe(1);
  });

  it("breaks topGenre and topAuthor ties by ascending label", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const beta = await seedAuthor({ name: "Beta Writer", userId });
    const alpha = await seedAuthor({ name: "Alpha Writer", userId });

    await seedBook({ authorId: beta.id, dedication: "d", genres: ["zeta"], title: "B", userId });
    await seedBook({ authorId: alpha.id, dedication: "d", genres: ["alef"], title: "A", userId });

    const res = await getSummary(accessToken);

    expect(res.body.topGenre).toEqual({ count: 1, genre: "alef" });
    expect(res.body.topAuthor).toEqual({ count: 1, name: "Alpha Writer" });
  });

  it("never counts another user's dedications in the summary", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerAuthor = await seedAuthor({ name: "Frank Herbert", userId: owner.userId });
    const strangerAuthor = await seedAuthor({ name: "Isaac Asimov", userId: stranger.userId });
    await seedBook({
      authorId: ownerAuthor.id,
      dedication: "mine",
      genres: ["memoir"],
      title: "Owner",
      userId: owner.userId,
    });
    await seedBook({
      authorId: strangerAuthor.id,
      dedication: "theirs",
      genres: ["scifi"],
      title: "Stranger",
      userId: stranger.userId,
    });

    const res = await getSummary(owner.accessToken);

    expect(res.body.totalCount).toBe(1);
    expect(res.body.availableGenres).toEqual(["memoir"]);
  });
});

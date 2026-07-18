import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../books.module.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

type SeedBookInput = {
  authorId: string;
  createdAt?: Date;
  currentPage?: number;
  extraAuthorIds?: string[];
  genres?: string[];
  isFavorite?: boolean;
  ownershipStatus?: string;
  pagesCount?: number;
  partNumber?: number;
  readingStatus?: string;
  seriesId?: string;
  tagIds?: string[];
  title?: string;
  userId: string;
};

const PHYSICAL_SCOPE = "owner=owned&owner=lent_to_someone&owner=borrowed_from_someone";

function getOverview(accessToken: string, query = ""): request.Test {
  const path = query === "" ? "/api/books/overview" : `/api/books/overview?${query}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
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
      authors: {
        create: [input.authorId, ...(input.extraAuthorIds ?? [])].map((authorId, position) => ({
          authorId,
          position,
        })),
      },
      createdAt: input.createdAt,
      genres: input.genres ?? [],
      isFavorite: input.isFavorite ?? false,
      ownershipStatus: input.ownershipStatus ?? "none",
      pagesCount: input.pagesCount ?? null,
      partNumber: input.partNumber ?? null,
      readingProgress:
        input.currentPage === undefined
          ? undefined
          : { create: { currentPage: input.currentPage } },
      readingStatus: input.readingStatus ?? "not_started",
      seriesId: input.seriesId ?? null,
      tags:
        input.tagIds === undefined
          ? undefined
          : { create: input.tagIds.map((tagId) => ({ tagId })) },
      title: input.title ?? "Untitled",
      userId: input.userId,
    },
    select: { id: true },
  });
}

function seedGenre(input: { key: string; name: string }): Promise<unknown> {
  return prisma.genre.create({
    data: {
      groupKey: "fiction",
      groupName: "Fiction",
      isDefault: true,
      key: input.key,
      name: input.name,
      normalizedName: input.name.toLowerCase(),
      userId: null,
    },
  });
}

function seedSeries(input: { name: string; userId: string }): Promise<{ id: string }> {
  return prisma.series.create({
    data: { name: input.name, normalizedName: input.name.toLowerCase(), userId: input.userId },
    select: { id: true },
  });
}

function seedTag(input: { name: string; userId: string }): Promise<{ id: string }> {
  return prisma.tag.create({
    data: { name: input.name, normalizedName: input.name.toLowerCase(), userId: input.userId },
    select: { id: true },
  });
}

describe("GET /api/books/overview", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/books/overview");

    expect(res.status).toBe(401);
  });

  it("returns an all-zero summary and empty blocks for an empty library", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getOverview(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      recentlyAdded: [],
      summary: {
        authorsCount: 0,
        borrowed: 0,
        favorites: 0,
        finished: 0,
        inTransit: 0,
        physicallyAvailable: 0,
        reading: 0,
        series: 0,
        seriesCount: 0,
        solo: 0,
        total: 0,
        wantToBuy: 0,
        wantToRead: 0,
      },
      topGenres: [],
      topTags: [],
    });
  });

  it("counts reading as the sum of reading and rereading statuses", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      readingStatus: "reading",
      title: "A",
      userId,
    });
    await seedBook({ authorId: author.id, readingStatus: "rereading", title: "B", userId });
    await seedBook({ authorId: author.id, readingStatus: "finished", title: "C", userId });
    await seedBook({ authorId: author.id, readingStatus: "want_to_read", title: "D", userId });

    const res = await getOverview(accessToken);

    expect(res.body.summary).toEqual({
      authorsCount: 1,
      borrowed: 0,
      favorites: 1,
      finished: 1,
      inTransit: 0,
      physicallyAvailable: 0,
      reading: 2,
      series: 0,
      seriesCount: 0,
      solo: 4,
      total: 4,
      wantToBuy: 0,
      wantToRead: 1,
    });
  });

  it("returns the three most frequent genres by count with resolved display names", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "a-genre", name: "Alpha" });
    await seedGenre({ key: "b-genre", name: "Beta" });
    await seedGenre({ key: "c-genre", name: "Gamma" });
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, genres: ["a-genre", "b-genre"], title: "1", userId });
    await seedBook({ authorId: author.id, genres: ["a-genre", "b-genre"], title: "2", userId });
    await seedBook({ authorId: author.id, genres: ["a-genre", "c-genre"], title: "3", userId });
    await seedBook({ authorId: author.id, genres: ["d-genre"], title: "4", userId });

    const res = await getOverview(accessToken);

    expect(res.body.topGenres).toEqual([
      { count: 3, key: "a-genre", name: "Alpha" },
      { count: 2, key: "b-genre", name: "Beta" },
      { count: 1, key: "c-genre", name: "Gamma" },
    ]);
  });

  it("falls back to the genre key when no display name exists", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, genres: ["ghost-genre"], title: "1", userId });

    const res = await getOverview(accessToken);

    expect(res.body.topGenres).toEqual([{ count: 1, key: "ghost-genre", name: "ghost-genre" }]);
  });

  it("returns the three most frequent tags by count", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const t1 = await seedTag({ name: "slow burn", userId });
    const t2 = await seedTag({ name: "dark academia", userId });
    const t3 = await seedTag({ name: "dragons", userId });
    const t4 = await seedTag({ name: "found family", userId });
    await seedBook({
      authorId: author.id,
      tagIds: [t1.id, t2.id, t3.id, t4.id],
      title: "1",
      userId,
    });
    await seedBook({ authorId: author.id, tagIds: [t1.id, t2.id, t3.id], title: "2", userId });
    await seedBook({ authorId: author.id, tagIds: [t1.id, t2.id], title: "3", userId });
    await seedBook({ authorId: author.id, tagIds: [t1.id], title: "4", userId });

    const res = await getOverview(accessToken);

    expect(res.body.topTags).toEqual([
      { count: 4, id: t1.id, name: "slow burn" },
      { count: 3, id: t2.id, name: "dark academia" },
      { count: 2, id: t3.id, name: "dragons" },
    ]);
  });

  it("returns at most three recently added books ordered by createdAt descending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      title: "Oldest",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      title: "Older",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      title: "Newer",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-04T00:00:00.000Z"),
      title: "Newest",
      userId,
    });

    const res = await getOverview(accessToken);

    expect(res.body.recentlyAdded.map((book: { title: string }) => book.title)).toEqual([
      "Newest",
      "Newer",
      "Older",
    ]);
    expect(res.body.recentlyAdded[0].id).toMatch(UUID);
  });

  it("counts and aggregates only the caller's own books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerAuthor = await seedAuthor({ name: "Frank Herbert", userId: owner.userId });
    const strangerAuthor = await seedAuthor({ name: "Isaac Asimov", userId: stranger.userId });
    await seedBook({
      authorId: ownerAuthor.id,
      readingStatus: "reading",
      title: "Mine",
      userId: owner.userId,
    });
    await seedBook({
      authorId: strangerAuthor.id,
      isFavorite: true,
      readingStatus: "reading",
      title: "Theirs",
      userId: stranger.userId,
    });

    const res = await getOverview(owner.accessToken);

    expect(res.body.summary).toEqual({
      authorsCount: 1,
      borrowed: 0,
      favorites: 0,
      finished: 0,
      inTransit: 0,
      physicallyAvailable: 0,
      reading: 1,
      series: 0,
      seriesCount: 0,
      solo: 1,
      total: 1,
      wantToBuy: 0,
      wantToRead: 0,
    });
    expect(res.body.recentlyAdded.map((book: { title: string }) => book.title)).toEqual(["Mine"]);
  });
});

describe("GET /api/books/overview owner scope", () => {
  async function seedMixedLibrary(input: { authorId: string; userId: string }): Promise<void> {
    const { authorId, userId } = input;
    await seedBook({
      authorId,
      isFavorite: true,
      ownershipStatus: "owned",
      readingStatus: "reading",
      title: "Owned Reading Favorite",
      userId,
    });
    await seedBook({
      authorId,
      ownershipStatus: "lent_to_someone",
      readingStatus: "finished",
      title: "Lent Finished",
      userId,
    });
    await seedBook({
      authorId,
      isFavorite: true,
      ownershipStatus: "borrowed_from_someone",
      readingStatus: "rereading",
      title: "Borrowed Rereading Favorite",
      userId,
    });
    await seedBook({
      authorId,
      ownershipStatus: "owned",
      readingStatus: "not_started",
      title: "Owned Unread",
      userId,
    });
    await seedBook({
      authorId,
      isFavorite: true,
      ownershipStatus: "want_to_buy",
      readingStatus: "finished",
      title: "Want To Buy Finished Favorite",
      userId,
    });
    await seedBook({
      authorId,
      isFavorite: true,
      ownershipStatus: "none",
      readingStatus: "reading",
      title: "None Reading Favorite",
      userId,
    });
    await seedBook({
      authorId,
      ownershipStatus: "in_transit",
      readingStatus: "not_started",
      title: "In Transit Unread",
      userId,
    });
  }

  it("scopes every summary number to the physical library set with exact counts", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedMixedLibrary({ authorId: author.id, userId });

    const res = await getOverview(accessToken, PHYSICAL_SCOPE);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      authorsCount: 1,
      borrowed: 2,
      favorites: 2,
      finished: 1,
      inTransit: 1,
      physicallyAvailable: 4,
      reading: 2,
      series: 0,
      seriesCount: 0,
      solo: 4,
      total: 4,
      wantToBuy: 1,
      wantToRead: 0,
    });
  });

  it("keeps every scoped summary number at or below the global summary", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedMixedLibrary({ authorId: author.id, userId });

    const global = await getOverview(accessToken);
    const scoped = await getOverview(accessToken, PHYSICAL_SCOPE);

    expect(scoped.body.summary.total).toBeLessThanOrEqual(global.body.summary.total);
    expect(scoped.body.summary.reading).toBeLessThanOrEqual(global.body.summary.reading);
    expect(scoped.body.summary.finished).toBeLessThanOrEqual(global.body.summary.finished);
    expect(scoped.body.summary.favorites).toBeLessThanOrEqual(global.body.summary.favorites);
  });

  it("returns global summary numbers over all books when no owner scope is given", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedMixedLibrary({ authorId: author.id, userId });

    const res = await getOverview(accessToken);

    expect(res.body.summary).toEqual({
      authorsCount: 1,
      borrowed: 2,
      favorites: 4,
      finished: 2,
      inTransit: 1,
      physicallyAvailable: 4,
      reading: 3,
      series: 0,
      seriesCount: 0,
      solo: 7,
      total: 7,
      wantToBuy: 1,
      wantToRead: 0,
    });
  });

  it("excludes out-of-scope ownership statuses from scoped finished and favorites counts", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      ownershipStatus: "owned",
      readingStatus: "finished",
      title: "Owned Finished",
      userId,
    });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      ownershipStatus: "want_to_buy",
      readingStatus: "finished",
      title: "Want To Buy Finished Favorite",
      userId,
    });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      ownershipStatus: "none",
      readingStatus: "reading",
      title: "None Reading Favorite",
      userId,
    });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      ownershipStatus: "owned",
      readingStatus: "reading",
      title: "Owned Reading Favorite",
      userId,
    });

    const scoped = await getOverview(accessToken, "owner=owned");
    const global = await getOverview(accessToken);

    expect(scoped.body.summary).toEqual({
      authorsCount: 1,
      borrowed: 0,
      favorites: 1,
      finished: 1,
      inTransit: 0,
      physicallyAvailable: 2,
      reading: 1,
      series: 0,
      seriesCount: 0,
      solo: 2,
      total: 2,
      wantToBuy: 1,
      wantToRead: 0,
    });
    expect(global.body.summary.finished).toBe(2);
    expect(global.body.summary.favorites).toBe(3);
  });

  it("scopes recentlyAdded to the owner set and drops a newer out-of-scope book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      ownershipStatus: "owned",
      title: "Owned Older",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-04T00:00:00.000Z"),
      ownershipStatus: "owned",
      title: "Owned Newer",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-05T00:00:00.000Z"),
      ownershipStatus: "want_to_buy",
      title: "Want To Buy Newest",
      userId,
    });

    const res = await getOverview(accessToken, "owner=owned");

    expect(res.body.recentlyAdded.map((book: { title: string }) => book.title)).toEqual([
      "Owned Newer",
      "Owned Older",
    ]);
  });

  it("excludes a genre carried only by an out-of-scope book from scoped topGenres", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "owned-genre", name: "Owned Genre" });
    await seedGenre({ key: "out-genre", name: "Out Genre" });
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      genres: ["owned-genre"],
      ownershipStatus: "owned",
      title: "Owned",
      userId,
    });
    await seedBook({
      authorId: author.id,
      genres: ["out-genre"],
      ownershipStatus: "want_to_buy",
      title: "Want To Buy",
      userId,
    });

    const scoped = await getOverview(accessToken, "owner=owned");
    const global = await getOverview(accessToken);

    expect(scoped.body.topGenres).toEqual([{ count: 1, key: "owned-genre", name: "Owned Genre" }]);
    expect(global.body.topGenres.map((genre: { key: string }) => genre.key)).toEqual(
      expect.arrayContaining(["owned-genre", "out-genre"]),
    );
  });

  it("excludes a tag carried only by an out-of-scope book from scoped topTags", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const ownedTag = await seedTag({ name: "owned tag", userId });
    const outTag = await seedTag({ name: "out tag", userId });
    await seedBook({
      authorId: author.id,
      ownershipStatus: "owned",
      tagIds: [ownedTag.id],
      title: "Owned",
      userId,
    });
    await seedBook({
      authorId: author.id,
      ownershipStatus: "want_to_buy",
      tagIds: [outTag.id],
      title: "Want To Buy",
      userId,
    });

    const scoped = await getOverview(accessToken, "owner=owned");
    const global = await getOverview(accessToken);

    expect(scoped.body.topTags).toEqual([{ count: 1, id: ownedTag.id, name: "owned tag" }]);
    expect(global.body.topTags.map((tag: { id: string }) => tag.id)).toEqual(
      expect.arrayContaining([ownedTag.id, outTag.id]),
    );
  });

  it("scopes the overview to a single ownership status and returns only that subset", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      isFavorite: true,
      ownershipStatus: "none",
      readingStatus: "reading",
      title: "None Reading Favorite",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      ownershipStatus: "none",
      readingStatus: "finished",
      title: "None Finished",
      userId,
    });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      ownershipStatus: "owned",
      readingStatus: "reading",
      title: "Owned Reading Favorite",
      userId,
    });

    const res = await getOverview(accessToken, "owner=none");

    expect(res.body.summary).toEqual({
      authorsCount: 1,
      borrowed: 0,
      favorites: 1,
      finished: 1,
      inTransit: 0,
      physicallyAvailable: 0,
      reading: 1,
      series: 0,
      seriesCount: 0,
      solo: 2,
      total: 2,
      wantToBuy: 0,
      wantToRead: 0,
    });
    expect(res.body.recentlyAdded.map((book: { title: string }) => book.title)).toEqual([
      "None Finished",
      "None Reading Favorite",
    ]);
  });

  it("returns 400 when the owner query param is not a valid ownership status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getOverview(accessToken, "owner=not_a_status");

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: expect.stringMatching(/^owner/) })]),
    );
  });

  it("never leaks another user's books into the scoped overview", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerAuthor = await seedAuthor({ name: "Frank Herbert", userId: owner.userId });
    const strangerAuthor = await seedAuthor({ name: "Isaac Asimov", userId: stranger.userId });
    await seedBook({
      authorId: ownerAuthor.id,
      ownershipStatus: "owned",
      title: "Mine Owned",
      userId: owner.userId,
    });
    await seedBook({
      authorId: ownerAuthor.id,
      ownershipStatus: "want_to_buy",
      title: "Mine Want To Buy",
      userId: owner.userId,
    });
    await seedBook({
      authorId: strangerAuthor.id,
      ownershipStatus: "owned",
      title: "Stranger Owned",
      userId: stranger.userId,
    });

    const res = await getOverview(owner.accessToken, "owner=owned");

    expect(res.body.summary.total).toBe(1);
    expect(res.body.recentlyAdded.map((book: { title: string }) => book.title)).toEqual([
      "Mine Owned",
    ]);
  });
});

describe("GET /api/books/overview quick-filter counters", () => {
  function listBooks(accessToken: string, query: string): request.Test {
    return request(app.getHttpServer())
      .get(`/api/books?${query}`)
      .set("Authorization", `Bearer ${accessToken}`);
  }

  async function seedSpread(input: { authorId: string; userId: string }): Promise<void> {
    const { authorId, userId } = input;
    const series = await seedSeries({ name: "Dune Saga", userId });
    await seedBook({
      authorId,
      ownershipStatus: "want_to_buy",
      readingStatus: "want_to_read",
      title: "Want To Buy And Want To Read",
      userId,
    });
    await seedBook({ authorId, ownershipStatus: "in_transit", title: "In Transit", userId });
    await seedBook({
      authorId,
      ownershipStatus: "borrowed_from_someone",
      title: "Borrowed",
      userId,
    });
    await seedBook({ authorId, ownershipStatus: "lent_to_someone", title: "Lent", userId });
    await seedBook({
      authorId,
      partNumber: 1,
      seriesId: series.id,
      title: "Series Part One",
      userId,
    });
    await seedBook({
      authorId,
      partNumber: 2,
      readingStatus: "want_to_read",
      seriesId: series.id,
      title: "Series Part Two",
      userId,
    });
    await seedBook({
      authorId,
      ownershipStatus: "owned",
      readingStatus: "reading",
      title: "Solo Owned Reading",
      userId,
    });
  }

  it("counts each chip and matches the list endpoint totalCount for the same predicate", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedSpread({ authorId: author.id, userId });

    const overview = await getOverview(accessToken);
    const [wantToRead, wantToBuy, inTransit, borrowed, series, solo] = await Promise.all([
      listBooks(accessToken, "status=want_to_read"),
      listBooks(accessToken, "owner=want_to_buy"),
      listBooks(accessToken, "owner=in_transit"),
      listBooks(accessToken, "owner=borrowed_from_someone&owner=lent_to_someone"),
      listBooks(accessToken, "bookType=series_part"),
      listBooks(accessToken, "bookType=solo"),
    ]);

    expect(overview.body.summary.wantToRead).toBe(wantToRead.body.totalCount);
    expect(overview.body.summary.wantToBuy).toBe(wantToBuy.body.totalCount);
    expect(overview.body.summary.inTransit).toBe(inTransit.body.totalCount);
    expect(overview.body.summary.borrowed).toBe(borrowed.body.totalCount);
    expect(overview.body.summary.series).toBe(series.body.totalCount);
    expect(overview.body.summary.solo).toBe(solo.body.totalCount);

    expect(overview.body.summary).toMatchObject({
      borrowed: 2,
      inTransit: 1,
      series: 2,
      solo: 5,
      wantToBuy: 1,
      wantToRead: 2,
    });
  });
});

describe("GET /api/books/overview micro-facts", () => {
  it("counts unique series by id, distinct from the series-part book count", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const dune = await seedSeries({ name: "Dune Saga", userId });
    const foundation = await seedSeries({ name: "Foundation", userId });
    await seedBook({
      authorId: author.id,
      partNumber: 1,
      seriesId: dune.id,
      title: "Dune",
      userId,
    });
    await seedBook({
      authorId: author.id,
      partNumber: 2,
      seriesId: dune.id,
      title: "Dune Messiah",
      userId,
    });
    await seedBook({
      authorId: author.id,
      partNumber: 1,
      seriesId: foundation.id,
      title: "Foundation",
      userId,
    });
    await seedBook({ authorId: author.id, title: "Standalone", userId });

    const res = await getOverview(accessToken);

    expect(res.body.summary.seriesCount).toBe(2);
    expect(res.body.summary.series).toBe(3);
  });

  it("counts distinct authors across the multi-author join, not per book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const herbert = await seedAuthor({ name: "Frank Herbert", userId });
    const asimov = await seedAuthor({ name: "Isaac Asimov", userId });
    const clarke = await seedAuthor({ name: "Arthur C. Clarke", userId });
    await seedBook({
      authorId: herbert.id,
      extraAuthorIds: [asimov.id],
      title: "Co-authored A",
      userId,
    });
    await seedBook({
      authorId: asimov.id,
      extraAuthorIds: [clarke.id],
      title: "Co-authored B",
      userId,
    });

    const res = await getOverview(accessToken);

    expect(res.body.summary.total).toBe(2);
    expect(res.body.summary.authorsCount).toBe(3);
  });

  it("counts physically available books and narrows the count under an owner scope", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, ownershipStatus: "owned", title: "Owned", userId });
    await seedBook({
      authorId: author.id,
      ownershipStatus: "lent_to_someone",
      title: "Lent",
      userId,
    });
    await seedBook({
      authorId: author.id,
      ownershipStatus: "borrowed_from_someone",
      title: "Borrowed",
      userId,
    });
    await seedBook({
      authorId: author.id,
      ownershipStatus: "want_to_buy",
      title: "Want To Buy",
      userId,
    });
    await seedBook({ authorId: author.id, ownershipStatus: "none", title: "None", userId });

    const global = await getOverview(accessToken);
    const scoped = await getOverview(accessToken, "owner=owned");

    expect(global.body.summary.physicallyAvailable).toBe(3);
    expect(scoped.body.summary.physicallyAvailable).toBe(1);
  });

  it("sums pagesAhead over active books with known pages, excluding unknowns and clamping negatives", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      currentPage: 100,
      pagesCount: 300,
      readingStatus: "reading",
      title: "Ahead By 200",
      userId,
    });
    await seedBook({
      authorId: author.id,
      currentPage: 250,
      pagesCount: 200,
      readingStatus: "rereading",
      title: "Overshoot Clamped",
      userId,
    });
    await seedBook({
      authorId: author.id,
      currentPage: 50,
      readingStatus: "reading",
      title: "Unknown Pages",
      userId,
    });
    await seedBook({
      authorId: author.id,
      pagesCount: 400,
      readingStatus: "reading",
      title: "Unknown Current Page",
      userId,
    });
    await seedBook({
      authorId: author.id,
      currentPage: 10,
      pagesCount: 500,
      readingStatus: "finished",
      title: "Not Active",
      userId,
    });

    const res = await getOverview(accessToken);

    expect(res.body.summary.reading).toBe(4);
    expect(res.body.activeReading.pagesAhead).toBe(200);
    expect(res.body.activeReading.book).toBeNull();
  });

  it("exposes the single active book only when exactly one active book has known pages", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const active = await seedBook({
      authorId: author.id,
      currentPage: 120,
      pagesCount: 320,
      readingStatus: "reading",
      title: "The Only Active",
      userId,
    });
    await seedBook({
      authorId: author.id,
      currentPage: 10,
      pagesCount: 500,
      readingStatus: "finished",
      title: "Finished",
      userId,
    });

    const res = await getOverview(accessToken);

    expect(res.body.activeReading).toEqual({
      book: { currentPage: 120, id: active.id, pagesCount: 320, title: "The Only Active" },
      pagesAhead: 200,
    });
  });

  it("leaves the single active book null when its page count is unknown", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      currentPage: 40,
      readingStatus: "reading",
      title: "No Page Count",
      userId,
    });

    const res = await getOverview(accessToken);

    expect(res.body.activeReading).toEqual({ book: null, pagesAhead: 0 });
  });

  it("returns a null active book when two or more books are active", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      currentPage: 100,
      pagesCount: 300,
      readingStatus: "reading",
      title: "First Active",
      userId,
    });
    await seedBook({
      authorId: author.id,
      currentPage: 100,
      pagesCount: 250,
      readingStatus: "rereading",
      title: "Second Active",
      userId,
    });

    const res = await getOverview(accessToken);

    expect(res.body.activeReading.book).toBeNull();
    expect(res.body.activeReading.pagesAhead).toBe(350);
  });

  it("omits activeReading entirely when nothing is being read", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      readingStatus: "want_to_read",
      title: "Queued",
      userId,
    });
    await seedBook({
      authorId: author.id,
      currentPage: 10,
      pagesCount: 100,
      readingStatus: "finished",
      title: "Done",
      userId,
    });

    const res = await getOverview(accessToken);

    expect(res.body.activeReading).toBeUndefined();
  });

  it("scopes seriesCount, authorsCount and activeReading to the owner set", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const herbert = await seedAuthor({ name: "Frank Herbert", userId });
    const asimov = await seedAuthor({ name: "Isaac Asimov", userId });
    const ownedSeries = await seedSeries({ name: "Owned Series", userId });
    const wishlistSeries = await seedSeries({ name: "Wishlist Series", userId });
    const owned = await seedBook({
      authorId: herbert.id,
      currentPage: 100,
      ownershipStatus: "owned",
      pagesCount: 300,
      partNumber: 1,
      readingStatus: "reading",
      seriesId: ownedSeries.id,
      title: "Owned Reading Part",
      userId,
    });
    await seedBook({
      authorId: asimov.id,
      currentPage: 40,
      ownershipStatus: "want_to_buy",
      pagesCount: 240,
      partNumber: 1,
      readingStatus: "reading",
      seriesId: wishlistSeries.id,
      title: "Wishlist Reading Part",
      userId,
    });

    const global = await getOverview(accessToken);
    const scoped = await getOverview(accessToken, "owner=owned");

    expect(global.body.summary.seriesCount).toBe(2);
    expect(global.body.summary.authorsCount).toBe(2);
    expect(global.body.activeReading.book).toBeNull();
    expect(global.body.activeReading.pagesAhead).toBe(400);

    expect(scoped.body.summary.seriesCount).toBe(1);
    expect(scoped.body.summary.authorsCount).toBe(1);
    expect(scoped.body.activeReading).toEqual({
      book: { currentPage: 100, id: owned.id, pagesCount: 300, title: "Owned Reading Part" },
      pagesAhead: 200,
    });
  });
});

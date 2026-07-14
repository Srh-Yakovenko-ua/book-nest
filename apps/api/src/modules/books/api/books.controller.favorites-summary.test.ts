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

type SeedBookInput = {
  authorId: string;
  genres?: string[];
  isFavorite?: boolean;
  partNumber?: number;
  rating?: number;
  readingStatus?: string;
  seriesId?: string;
  tagIds?: string[];
  title?: string;
  userId: string;
};

function getFavoritesSummary(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/books/favorites-summary")
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
      genres: input.genres ?? [],
      isFavorite: input.isFavorite ?? false,
      partNumber: input.partNumber ?? null,
      readingProgress:
        input.rating === undefined ? undefined : { create: { rating: input.rating } },
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

describe("GET /api/books/favorites-summary", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/books/favorites-summary");

    expect(res.status).toBe(401);
  });

  it("returns an empty summary with a null average rating for a library without favorites", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      rating: 9,
      readingStatus: "finished",
      title: "A",
      userId,
    });

    const res = await getFavoritesSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      averageRating: null,
      finished: 0,
      reading: 0,
      series: 0,
      solo: 0,
      topGenres: [],
      topTags: [],
      total: 0,
      wantToRead: 0,
    });
  });

  it("counts only favorites in total and excludes non-favorites", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, isFavorite: true, title: "Fav A", userId });
    await seedBook({ authorId: author.id, isFavorite: true, title: "Fav B", userId });
    await seedBook({ authorId: author.id, isFavorite: false, title: "Plain", userId });

    const res = await getFavoritesSummary(accessToken);

    expect(res.body.total).toBe(2);
  });

  it("counts finished and reading only for favorites and treats rereading as reading", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      readingStatus: "reading",
      title: "Reading fav",
      userId,
    });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      readingStatus: "rereading",
      title: "Rereading fav",
      userId,
    });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      readingStatus: "finished",
      title: "Finished fav",
      userId,
    });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      readingStatus: "not_started",
      title: "Idle fav",
      userId,
    });
    await seedBook({
      authorId: author.id,
      isFavorite: false,
      readingStatus: "finished",
      title: "Finished plain",
      userId,
    });
    await seedBook({
      authorId: author.id,
      isFavorite: false,
      readingStatus: "reading",
      title: "Reading plain",
      userId,
    });

    const res = await getFavoritesSummary(accessToken);

    expect(res.body).toEqual({
      averageRating: null,
      finished: 1,
      reading: 2,
      series: 0,
      solo: 4,
      topGenres: [],
      topTags: [],
      total: 4,
      wantToRead: 0,
    });
  });

  it("averages ratings only over favorites that have a rating", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, isFavorite: true, rating: 8, title: "Rated A", userId });
    await seedBook({ authorId: author.id, isFavorite: true, rating: 4, title: "Rated B", userId });
    await seedBook({ authorId: author.id, isFavorite: true, title: "Unrated fav", userId });
    await seedBook({
      authorId: author.id,
      isFavorite: false,
      rating: 10,
      title: "Rated plain",
      userId,
    });

    const res = await getFavoritesSummary(accessToken);

    expect(res.body.averageRating).toBe(6);
    expect(res.body.total).toBe(3);
  });

  it("returns a null average rating when no favorite has a rating even if a non-favorite does", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, isFavorite: true, title: "Unrated fav", userId });
    await seedBook({
      authorId: author.id,
      isFavorite: false,
      rating: 10,
      title: "Rated plain",
      userId,
    });

    const res = await getFavoritesSummary(accessToken);

    expect(res.body.averageRating).toBeNull();
  });

  it("never leaks another user's favorites into the summary", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerAuthor = await seedAuthor({ name: "Frank Herbert", userId: owner.userId });
    const strangerAuthor = await seedAuthor({ name: "Isaac Asimov", userId: stranger.userId });
    await seedBook({
      authorId: ownerAuthor.id,
      isFavorite: true,
      rating: 6,
      readingStatus: "finished",
      title: "Mine",
      userId: owner.userId,
    });
    await seedBook({
      authorId: strangerAuthor.id,
      isFavorite: true,
      rating: 10,
      readingStatus: "finished",
      title: "Theirs",
      userId: stranger.userId,
    });

    const res = await getFavoritesSummary(owner.accessToken);

    expect(res.body).toEqual({
      averageRating: 6,
      finished: 1,
      reading: 0,
      series: 0,
      solo: 1,
      topGenres: [],
      topTags: [],
      total: 1,
      wantToRead: 0,
    });
  });

  it("counts want-to-read, series, and solo among favorites only", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const series = await seedSeries({ name: "Dune Saga", userId });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      readingStatus: "want_to_read",
      title: "Fav Want To Read Solo",
      userId,
    });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      partNumber: 1,
      seriesId: series.id,
      title: "Fav Series Part",
      userId,
    });
    await seedBook({ authorId: author.id, isFavorite: true, title: "Fav Solo", userId });
    await seedBook({
      authorId: author.id,
      isFavorite: false,
      readingStatus: "want_to_read",
      title: "Plain Want To Read",
      userId,
    });

    const res = await getFavoritesSummary(accessToken);

    expect(res.body).toMatchObject({ series: 1, solo: 2, total: 3, wantToRead: 1 });
  });

  describe("topGenres and topTags", () => {
    it("returns the top three genres and tags ordered by count descending and drops the fourth", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "Frank Herbert", userId });
      const willow = await seedTag({ name: "willow", userId });
      const tulip = await seedTag({ name: "tulip", userId });
      const sage = await seedTag({ name: "sage", userId });
      const aster = await seedTag({ name: "aster", userId });
      await seedBook({
        authorId: author.id,
        genres: ["wolf", "tiger", "shark", "ant"],
        isFavorite: true,
        tagIds: [willow.id, tulip.id, sage.id, aster.id],
        title: "Book 1",
        userId,
      });
      await seedBook({
        authorId: author.id,
        genres: ["wolf", "tiger", "shark"],
        isFavorite: true,
        tagIds: [willow.id, tulip.id, sage.id],
        title: "Book 2",
        userId,
      });
      await seedBook({
        authorId: author.id,
        genres: ["wolf", "tiger"],
        isFavorite: true,
        tagIds: [willow.id, tulip.id],
        title: "Book 3",
        userId,
      });
      await seedBook({
        authorId: author.id,
        genres: ["wolf"],
        isFavorite: true,
        tagIds: [willow.id],
        title: "Book 4",
        userId,
      });

      const res = await getFavoritesSummary(accessToken);

      expect(res.body.topGenres).toEqual([
        { count: 4, genre: "wolf" },
        { count: 3, genre: "tiger" },
        { count: 2, genre: "shark" },
      ]);
      expect(res.body.topTags).toEqual([
        { count: 4, tag: "willow" },
        { count: 3, tag: "tulip" },
        { count: 2, tag: "sage" },
      ]);
    });

    it("orders genres and tags with equal counts by name ascending and keeps the first three", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "Frank Herbert", userId });
      const dune = await seedTag({ name: "dune", userId });
      const coral = await seedTag({ name: "coral", userId });
      const beryl = await seedTag({ name: "beryl", userId });
      const amber = await seedTag({ name: "amber", userId });
      const equalGenres = ["delta", "charlie", "bravo", "alpha"];
      const equalTagIds = [dune.id, coral.id, beryl.id, amber.id];
      await seedBook({
        authorId: author.id,
        genres: equalGenres,
        isFavorite: true,
        tagIds: equalTagIds,
        title: "Book 1",
        userId,
      });
      await seedBook({
        authorId: author.id,
        genres: equalGenres,
        isFavorite: true,
        tagIds: equalTagIds,
        title: "Book 2",
        userId,
      });

      const res = await getFavoritesSummary(accessToken);

      expect(res.body.topGenres).toEqual([
        { count: 2, genre: "alpha" },
        { count: 2, genre: "bravo" },
        { count: 2, genre: "charlie" },
      ]);
      expect(res.body.topTags).toEqual([
        { count: 2, tag: "amber" },
        { count: 2, tag: "beryl" },
        { count: 2, tag: "coral" },
      ]);
    });

    it("returns an identical genre and tag order across repeated calls on unchanged data", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "Frank Herbert", userId });
      const dune = await seedTag({ name: "dune", userId });
      const coral = await seedTag({ name: "coral", userId });
      const beryl = await seedTag({ name: "beryl", userId });
      const equalGenres = ["gamma", "beta", "alpha"];
      const equalTagIds = [dune.id, coral.id, beryl.id];
      await seedBook({
        authorId: author.id,
        genres: equalGenres,
        isFavorite: true,
        tagIds: equalTagIds,
        title: "Book 1",
        userId,
      });
      await seedBook({
        authorId: author.id,
        genres: equalGenres,
        isFavorite: true,
        tagIds: equalTagIds,
        title: "Book 2",
        userId,
      });

      const first = await getFavoritesSummary(accessToken);
      const second = await getFavoritesSummary(accessToken);

      expect(first.body.topGenres).toEqual(second.body.topGenres);
      expect(first.body.topTags).toEqual(second.body.topTags);
      expect(second.body.topGenres).toEqual([
        { count: 2, genre: "alpha" },
        { count: 2, genre: "beta" },
        { count: 2, genre: "gamma" },
      ]);
      expect(second.body.topTags).toEqual([
        { count: 2, tag: "beryl" },
        { count: 2, tag: "coral" },
        { count: 2, tag: "dune" },
      ]);
    });

    it("increments each genre and tag carried by a single favorite book", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "Frank Herbert", userId });
      const foo = await seedTag({ name: "foo", userId });
      const bar = await seedTag({ name: "bar", userId });
      await seedBook({
        authorId: author.id,
        genres: ["biography", "history"],
        isFavorite: true,
        tagIds: [foo.id, bar.id],
        title: "Book 1",
        userId,
      });

      const res = await getFavoritesSummary(accessToken);

      expect(res.body.topGenres).toEqual([
        { count: 1, genre: "biography" },
        { count: 1, genre: "history" },
      ]);
      expect(res.body.topTags).toEqual([
        { count: 1, tag: "bar" },
        { count: 1, tag: "foo" },
      ]);
    });

    it("excludes genres and tags belonging to non-favorite books", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "Frank Herbert", userId });
      const keptTag = await seedTag({ name: "kept", userId });
      const droppedTag = await seedTag({ name: "dropped", userId });
      await seedBook({
        authorId: author.id,
        genres: ["kept"],
        isFavorite: true,
        tagIds: [keptTag.id],
        title: "Fav",
        userId,
      });
      await seedBook({
        authorId: author.id,
        genres: ["dropped"],
        isFavorite: false,
        tagIds: [droppedTag.id],
        title: "Plain",
        userId,
      });

      const res = await getFavoritesSummary(accessToken);

      expect(res.body.topGenres).toEqual([{ count: 1, genre: "kept" }]);
      expect(res.body.topTags).toEqual([{ count: 1, tag: "kept" }]);
    });

    it("never leaks another user's favorite genres and tags", async () => {
      const owner = await context.registerVerifyAndLogin();
      const stranger = await context.registerVerifyAndLogin({
        email: "stranger@example.com",
        nickname: "stranger",
      });
      const ownerAuthor = await seedAuthor({ name: "Frank Herbert", userId: owner.userId });
      const strangerAuthor = await seedAuthor({ name: "Isaac Asimov", userId: stranger.userId });
      const ownerTag = await seedTag({ name: "ownglory", userId: owner.userId });
      const strangerTag = await seedTag({ name: "otherglory", userId: stranger.userId });
      await seedBook({
        authorId: ownerAuthor.id,
        genres: ["ownscape"],
        isFavorite: true,
        tagIds: [ownerTag.id],
        title: "Mine",
        userId: owner.userId,
      });
      await seedBook({
        authorId: strangerAuthor.id,
        genres: ["otherscape"],
        isFavorite: true,
        tagIds: [strangerTag.id],
        title: "Theirs",
        userId: stranger.userId,
      });

      const res = await getFavoritesSummary(owner.accessToken);

      expect(res.body.topGenres).toEqual([{ count: 1, genre: "ownscape" }]);
      expect(res.body.topTags).toEqual([{ count: 1, tag: "ownglory" }]);
    });

    it("returns empty genre and tag arrays for favorites that carry no genres or tags", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "Frank Herbert", userId });
      await seedBook({ authorId: author.id, isFavorite: true, title: "Bare fav", userId });

      const res = await getFavoritesSummary(accessToken);

      expect(res.body.topGenres).toEqual([]);
      expect(res.body.topTags).toEqual([]);
    });

    it("returns only the distinct genres and tags present without padding to three", async () => {
      const { accessToken, userId } = await context.registerVerifyAndLogin();
      const author = await seedAuthor({ name: "Frank Herbert", userId });
      const oakTag = await seedTag({ name: "oak", userId });
      const pineTag = await seedTag({ name: "pine", userId });
      await seedBook({
        authorId: author.id,
        genres: ["oak"],
        isFavorite: true,
        tagIds: [oakTag.id],
        title: "Book 1",
        userId,
      });
      await seedBook({
        authorId: author.id,
        genres: ["pine"],
        isFavorite: true,
        tagIds: [pineTag.id],
        title: "Book 2",
        userId,
      });

      const res = await getFavoritesSummary(accessToken);

      expect(res.body.topGenres).toEqual([
        { count: 1, genre: "oak" },
        { count: 1, genre: "pine" },
      ]);
      expect(res.body.topTags).toEqual([
        { count: 1, tag: "oak" },
        { count: 1, tag: "pine" },
      ]);
    });
  });
});

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
  genres?: string[];
  isFavorite?: boolean;
  readingStatus?: string;
  tagIds?: string[];
  title?: string;
  userId: string;
};

function getOverview(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/books/overview")
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
      genres: input.genres ?? [],
      isFavorite: input.isFavorite ?? false,
      readingStatus: input.readingStatus ?? "not_started",
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
      summary: { favorites: 0, finished: 0, reading: 0, total: 0 },
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

    expect(res.body.summary).toEqual({ favorites: 1, finished: 1, reading: 2, total: 4 });
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

    expect(res.body.summary).toEqual({ favorites: 0, finished: 0, reading: 1, total: 1 });
    expect(res.body.recentlyAdded.map((book: { title: string }) => book.title)).toEqual(["Mine"]);
  });
});

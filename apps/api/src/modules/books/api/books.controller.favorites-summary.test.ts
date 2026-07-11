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
  isFavorite?: boolean;
  partNumber?: number;
  rating?: number;
  readingStatus?: string;
  seriesId?: string;
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
      isFavorite: input.isFavorite ?? false,
      partNumber: input.partNumber ?? null,
      readingProgress:
        input.rating === undefined ? undefined : { create: { rating: input.rating } },
      readingStatus: input.readingStatus ?? "not_started",
      seriesId: input.seriesId ?? null,
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
});

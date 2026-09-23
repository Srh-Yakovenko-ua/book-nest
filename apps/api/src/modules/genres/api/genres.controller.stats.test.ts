import type { GenreStatsView, PaginatedGenreStats } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { GENRES_PAGE_SIZE } from "@app/shared";
import { addMinutes } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { GenresModule } from "../genres.module.js";

const BASE_CREATED_AT = new Date("2026-01-01T10:00:00.000Z");

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, GenresModule]);
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

function getStats(accessToken: string, query = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/genres/stats${query === "" ? "" : `?${query}`}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function keysOf(body: PaginatedGenreStats): string[] {
  return body.items.map((entry) => entry.key);
}

function seedBook(input: {
  coverMediaId?: string;
  createdAt?: Date;
  genres: string[];
  ownershipStatus?: string;
  queuePosition?: number;
  rating?: number;
  readingStatus?: string;
  userId: string;
}): Promise<{ id: string }> {
  return prisma.book.create({
    data: {
      coverMediaId: input.coverMediaId,
      createdAt: input.createdAt,
      genres: input.genres,
      ownershipStatus: input.ownershipStatus ?? "none",
      queuePosition: input.queuePosition,
      readingProgress:
        input.rating === undefined ? undefined : { create: { rating: input.rating } },
      readingStatus: input.readingStatus ?? "not_started",
      title: "Untitled",
      userId: input.userId,
    },
    select: { id: true },
  });
}

function seedCover(input: {
  kind?: string;
  storageKey: string;
  userId: string;
}): Promise<{ id: string }> {
  return prisma.mediaAsset.create({
    data: {
      contentType: "image/webp",
      height: 90,
      kind: input.kind ?? "book_cover",
      sizeBytes: 1000,
      storageKey: input.storageKey,
      userId: input.userId,
      width: 60,
    },
    select: { id: true },
  });
}

function seedGenre(input: {
  groupKey?: string;
  groupName?: string;
  key: string;
  name: string;
  sortOrder?: number;
  userId?: string;
}): Promise<{ key: string }> {
  return prisma.genre.create({
    data: {
      groupKey: input.groupKey ?? "fiction",
      groupName: input.groupName ?? "Fiction",
      isDefault: input.userId === undefined,
      key: input.key,
      name: input.name,
      normalizedName: input.name.toLowerCase(),
      sortOrder: input.sortOrder ?? 0,
      userId: input.userId ?? null,
    },
    select: { key: true },
  });
}

describe("GET /api/genres/stats", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/genres/stats");

    expect(res.status).toBe(401);
  });

  it("returns an empty page when the user has no books with genres", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getStats(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [],
      page: 1,
      pagesCount: 0,
      pageSize: GENRES_PAGE_SIZE,
      totalCount: 0,
    });
  });

  it("aggregates counts, rating sample, label and group metadata per system genre", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "fantasy", name: "Фентезі" });
    await seedGenre({
      groupKey: "romance-group",
      groupName: "Романтика",
      key: "romance",
      name: "Романтика",
    });
    await seedBook({
      genres: ["fantasy"],
      ownershipStatus: "owned",
      rating: 4,
      readingStatus: "finished",
      userId,
    });
    await seedBook({
      genres: ["fantasy", "romance"],
      ownershipStatus: "want_to_buy",
      queuePosition: 1,
      rating: 5,
      readingStatus: "reading",
      userId,
    });
    await seedBook({ genres: ["fantasy"], userId });

    const res = await getStats(accessToken);

    expect(res.status).toBe(200);
    const body = res.body as PaginatedGenreStats;
    expect(keysOf(body)).toEqual(["fantasy", "romance"]);
    expect(body.totalCount).toBe(2);
    expect(body.items[0]).toEqual({
      averageRating: 4.5,
      booksCount: 3,
      coverUrls: [],
      groupKey: "fiction",
      groupName: "Fiction",
      key: "fantasy",
      label: "Фентезі",
      ratedBooksCount: 2,
      readCount: 1,
      readingQueueCount: 1,
      wantToBuyCount: 1,
    } satisfies GenreStatsView);
    expect(body.items[1]).toMatchObject({
      averageRating: 5,
      booksCount: 1,
      groupKey: "romance-group",
      groupName: "Романтика",
      ratedBooksCount: 1,
    });
  });

  it("ignores genre keys that are not in the system catalog", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "comfort-reads", name: "Comfort Reads", userId });
    await seedBook({ genres: ["mystery", "comfort-reads"], userId });

    const res = await getStats(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("does not count another user's books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedGenre({ key: "fantasy", name: "Фентезі" });
    await seedBook({ genres: ["fantasy"], userId: stranger.userId });

    const res = await getStats(owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("searches genre names with normalized whitespace and case", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "dark-fantasy", name: "Темне фентезі" });
    await seedGenre({ key: "romance", name: "Романтика" });
    await seedBook({ genres: ["dark-fantasy", "romance"], userId });

    const res = await getStats(accessToken, `q=${encodeURIComponent("  ТЕМНЕ   фент ")}`);

    expect(res.status).toBe(200);
    expect(keysOf(res.body)).toEqual(["dark-fantasy"]);
  });

  it("combines selected groups with OR semantics", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ groupKey: "fiction", key: "fantasy", name: "Фентезі" });
    await seedGenre({ groupKey: "nonfiction", key: "history", name: "Історія" });
    await seedGenre({ groupKey: "kids", key: "fairy-tale", name: "Казка" });
    await seedBook({ genres: ["fantasy", "history", "fairy-tale"], userId });

    const res = await getStats(accessToken, "group=fiction&group=nonfiction&sort=name_asc");

    expect(res.status).toBe(200);
    expect(keysOf(res.body)).toEqual(["history", "fantasy"]);
  });

  it("applies the books range and a rating range that excludes unrated genres", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "fantasy", name: "Фентезі" });
    await seedGenre({ key: "romance", name: "Романтика" });
    await seedGenre({ key: "horror", name: "Жахи" });
    await seedBook({ genres: ["fantasy", "romance"], rating: 8, userId });
    await seedBook({ genres: ["fantasy", "horror"], userId });
    await seedBook({ genres: ["fantasy"], rating: 6, userId });

    const byBooks = await getStats(accessToken, "booksMin=2");
    const byRating = await getStats(accessToken, "ratingMin=6.5&ratingMax=10");

    expect(keysOf(byBooks.body)).toEqual(["fantasy"]);
    expect(keysOf(byRating.body)).toEqual(["fantasy", "romance"]);
  });

  it("applies the quick filter after the dataset criteria", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "fantasy", name: "Фентезі" });
    await seedGenre({ key: "romance", name: "Романтика" });
    await seedBook({ genres: ["fantasy"], readingStatus: "finished", userId });
    await seedBook({ genres: ["romance"], readingStatus: "finished", userId });
    await seedBook({ genres: ["romance"], userId });

    const unread = await getStats(accessToken, "filter=unread");
    const finished = await getStats(accessToken, "filter=finished&sort=name_asc");

    expect(keysOf(unread.body)).toEqual(["romance"]);
    expect(unread.body.totalCount).toBe(1);
    expect(keysOf(finished.body)).toEqual(["romance", "fantasy"]);
  });

  it("sorts by average rating with unrated genres last", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "fantasy", name: "Фентезі" });
    await seedGenre({ key: "romance", name: "Романтика" });
    await seedGenre({ key: "horror", name: "Жахи" });
    await seedBook({ genres: ["fantasy"], rating: 6, userId });
    await seedBook({ genres: ["romance"], rating: 9, userId });
    await seedBook({ genres: ["horror"], userId });

    const res = await getStats(accessToken, "sort=rating_desc");

    expect(keysOf(res.body)).toEqual(["romance", "fantasy", "horror"]);
  });

  it("paginates deterministically with page size 24 and equal counts tie-broken by name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const genreKeys = Array.from(
      { length: GENRES_PAGE_SIZE + 2 },
      (_, index) => `genre-${String(index).padStart(2, "0")}`,
    );
    for (const key of genreKeys) {
      await seedGenre({ key, name: `Name ${key}` });
    }
    await seedBook({ genres: genreKeys.slice(0, 5), userId });
    await seedBook({ genres: genreKeys.slice(5, 10), userId });
    await seedBook({ genres: genreKeys.slice(10, 15), userId });
    await seedBook({ genres: genreKeys.slice(15, 20), userId });
    await seedBook({ genres: genreKeys.slice(20, 25), userId });
    await seedBook({ genres: genreKeys.slice(25), userId });

    const firstPage = await getStats(accessToken);
    const secondPage = await getStats(accessToken, "pageNumber=2");

    expect(firstPage.body.pageSize).toBe(GENRES_PAGE_SIZE);
    expect(firstPage.body.totalCount).toBe(genreKeys.length);
    expect(firstPage.body.pagesCount).toBe(2);
    expect(keysOf(firstPage.body)).toEqual(genreKeys.slice(0, GENRES_PAGE_SIZE));
    expect(keysOf(secondPage.body)).toEqual(genreKeys.slice(GENRES_PAGE_SIZE));
  });

  it("returns up to four newest-added covers per genre on the page", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "fantasy", name: "Фентезі" });
    await seedGenre({ key: "romance", name: "Романтика" });
    const coverOrder = ["c0", "c1", "c2", "c3", "c4"];
    for (const [index, label] of coverOrder.entries()) {
      const cover = await seedCover({ storageKey: `covers/${label}.webp`, userId });
      await seedBook({
        coverMediaId: cover.id,
        createdAt: addMinutes(BASE_CREATED_AT, index),
        genres: ["fantasy"],
        userId,
      });
    }
    await seedBook({ createdAt: addMinutes(BASE_CREATED_AT, 10), genres: ["fantasy"], userId });
    const romanceCover = await seedCover({ storageKey: "covers/r0.webp", userId });
    await seedBook({ coverMediaId: romanceCover.id, genres: ["romance"], userId });

    const res = await getStats(accessToken);

    const fantasy = res.body.items.find((entry: GenreStatsView) => entry.key === "fantasy");
    const romance = res.body.items.find((entry: GenreStatsView) => entry.key === "romance");
    expect(fantasy.booksCount).toBe(6);
    expect(fantasy.coverUrls).toHaveLength(4);
    ["c4", "c3", "c2", "c1"].forEach((label, index) => {
      expect(fantasy.coverUrls[index]).toContain(`covers/${label}`);
    });
    expect(romance.coverUrls).toEqual([expect.stringContaining("covers/r0")]);
  });

  it("fills four cover slots from usable covers when a newer cover cannot be rendered", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "fantasy", name: "Фентезі" });
    const coverOrder = ["c0", "c1", "c2", "c3"];
    for (const [index, label] of coverOrder.entries()) {
      const cover = await seedCover({ storageKey: `covers/${label}.webp`, userId });
      await seedBook({
        coverMediaId: cover.id,
        createdAt: addMinutes(BASE_CREATED_AT, index),
        genres: ["fantasy"],
        userId,
      });
    }
    const unrenderable = await seedCover({
      kind: "legacy_scan",
      storageKey: "covers/broken.webp",
      userId,
    });
    await seedBook({
      coverMediaId: unrenderable.id,
      createdAt: addMinutes(BASE_CREATED_AT, 10),
      genres: ["fantasy"],
      userId,
    });

    const res = await getStats(accessToken);

    const [fantasy] = res.body.items;
    expect(fantasy.booksCount).toBe(5);
    expect(fantasy.coverUrls).toHaveLength(4);
    ["c3", "c2", "c1", "c0"].forEach((label, index) => {
      expect(fantasy.coverUrls[index]).toContain(`covers/${label}`);
    });
  });

  it("rejects a books range where the minimum exceeds the maximum", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getStats(accessToken, "booksMin=5&booksMax=2");

    expect(res.status).toBe(400);
  });

  it("rejects a rating bound outside the 0.5 step domain", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getStats(accessToken, "ratingMin=7.3");

    expect(res.status).toBe(400);
  });

  it("rejects an unknown sort value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getStats(accessToken, "sort=view");

    expect(res.status).toBe(400);
  });
});

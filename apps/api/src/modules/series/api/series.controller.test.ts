import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { SeriesModule } from "../series.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, SeriesModule]);
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

function searchSeries(accessToken: string, search?: string): request.Test {
  const path = search === undefined ? "/api/series" : `/api/series?search=${search}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/series", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/series");

    expect(res.status).toBe(401);
  });

  it("returns only the caller's own series", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", userId },
    });

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      booksInSeries: 0,
      finishedInSeries: 0,
      name: "Throne of Glass",
      status: "unknown",
    });
  });

  it("computes booksInSeries live from the linked books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const linked = await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", userId },
    });
    const empty = await prisma.series.create({
      data: { name: "A Court of Thorns", normalizedName: "a court of thorns", userId },
    });
    await prisma.book.createMany({
      data: [
        {
          partNumber: 1,
          seriesId: linked.id,
          title: "Throne of Glass",
          userId,
        },
        {
          partNumber: 2,
          seriesId: linked.id,
          title: "Crown of Midnight",
          userId,
        },
      ],
    });

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    const byId = new Map<string, number>(
      res.body.items.map((item: { booksInSeries: number; id: string }) => [
        item.id,
        item.booksInSeries,
      ]),
    );
    expect(byId.get(linked.id)).toBe(2);
    expect(byId.get(empty.id)).toBe(0);
  });

  it("computes finishedInSeries live from the books with a finished reading status", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const linked = await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", userId },
    });
    await prisma.book.createMany({
      data: [
        {
          partNumber: 1,
          readingStatus: "finished",
          seriesId: linked.id,
          title: "Throne of Glass",
          userId,
        },
        {
          partNumber: 2,
          readingStatus: "finished",
          seriesId: linked.id,
          title: "Crown of Midnight",
          userId,
        },
        {
          partNumber: 3,
          readingStatus: "reading",
          seriesId: linked.id,
          title: "Heir of Fire",
          userId,
        },
      ],
    });

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      booksInSeries: 3,
      finishedInSeries: 2,
      readingInSeries: 1,
    });
  });

  it("does not return another user's series", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await prisma.series.create({
      data: { name: "Secret Series", normalizedName: "secret series", userId: stranger.userId },
    });

    const res = await searchSeries(owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(0);
  });

  it("includes the genres on each returned item", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.series.create({
      data: {
        genres: ["fantasy", "romance"],
        name: "Throne of Glass",
        normalizedName: "throne of glass",
        userId,
      },
    });

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].genres).toEqual(["fantasy", "romance"]);
  });

  it("filters by a case-insensitive search term", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", userId },
    });
    await prisma.series.create({
      data: { name: "A Court of Thorns", normalizedName: "a court of thorns", userId },
    });

    const res = await searchSeries(accessToken, "throne");

    const names = res.body.items.map((item: { name: string }) => item.name);
    expect(names).toEqual(["Throne of Glass"]);
  });
});

describe("GET /api/series attention fields", () => {
  async function seedSeries(userId: string): Promise<string> {
    const created = await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", userId },
    });
    return created.id;
  }

  it("reports the interior part numbers missing from the linked books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await seedSeries(userId);
    await prisma.book.createMany({
      data: [
        { partNumber: 1, seriesId, title: "Throne of Glass", userId },
        { partNumber: 3, seriesId, title: "Heir of Fire", userId },
        { partNumber: 5, seriesId, title: "Empire of Storms", userId },
      ],
    });

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].missingPartNumbers).toEqual([2, 4]);
  });

  it("reports no missing part numbers when the linked parts are contiguous", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await seedSeries(userId);
    await prisma.book.createMany({
      data: [
        { partNumber: 1, seriesId, title: "Throne of Glass", userId },
        { partNumber: 2, seriesId, title: "Crown of Midnight", userId },
      ],
    });

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].missingPartNumbers).toEqual([]);
  });

  it("flags a series whose linked book carries a publisher", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await seedSeries(userId);
    const publisher = await prisma.publisher.create({
      data: { name: "Vivat", normalizedName: "vivat", userId },
    });
    await prisma.book.createMany({
      data: [
        { partNumber: 1, publisherId: publisher.id, seriesId, title: "Throne of Glass", userId },
        { partNumber: 2, seriesId, title: "Crown of Midnight", userId },
      ],
    });

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].hasPublisher).toBe(true);
  });

  it("flags a series whose linked book carries a publication year", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await seedSeries(userId);
    await prisma.book.createMany({
      data: [
        { partNumber: 1, publicationYear: 2012, seriesId, title: "Throne of Glass", userId },
        { partNumber: 2, seriesId, title: "Crown of Midnight", userId },
      ],
    });

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].hasPublicationYears).toBe(true);
  });

  it("reports both attention flags as false when no linked book carries either value", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await seedSeries(userId);
    await prisma.book.create({
      data: { partNumber: 1, seriesId, title: "Throne of Glass", userId },
    });

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      hasPublicationYears: false,
      hasPublisher: false,
    });
  });

  it("returns the ownership status of the next unfinished book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await seedSeries(userId);
    await prisma.book.createMany({
      data: [
        {
          ownershipStatus: "owned",
          partNumber: 1,
          readingStatus: "finished",
          seriesId,
          title: "Throne of Glass",
          userId,
        },
        {
          ownershipStatus: "lent_to_someone",
          partNumber: 2,
          seriesId,
          title: "Crown of Midnight",
          userId,
        },
      ],
    });

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].nextBook).toMatchObject({
      ownershipStatus: "lent_to_someone",
      partNumber: 2,
      title: "Crown of Midnight",
    });
  });

  it("ignores a linked book without a part number when reporting missing parts", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await seedSeries(userId);
    await prisma.book.createMany({
      data: [
        { partNumber: null, seriesId, title: "The Assassin's Blade", userId },
        { partNumber: 1, seriesId, title: "Throne of Glass", userId },
        { partNumber: 3, seriesId, title: "Heir of Fire", userId },
      ],
    });

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].missingPartNumbers).toEqual([2]);
  });
});

describe("GET /api/series book aggregates", () => {
  type SeededAggregateSeries = {
    adventureTagId: string;
    epicTagId: string;
    seriesId: string;
  };

  async function seedAggregateSeries(userId: string): Promise<SeededAggregateSeries> {
    const created = await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", userId },
    });
    const epic = await prisma.tag.create({
      data: { name: "epic", normalizedName: "epic", userId },
    });
    const adventure = await prisma.tag.create({
      data: { name: "adventure", normalizedName: "adventure", userId },
    });

    await prisma.book.create({
      data: {
        ageCategory: "18_plus",
        formats: ["ebook"],
        language: "english",
        ownershipStatus: "borrowed_from_someone",
        pagesCount: 100,
        partNumber: 1,
        readingProgress: { create: { rating: 7 } },
        readingStatus: "finished",
        seriesId: created.id,
        tags: { create: [{ tagId: epic.id }] },
        title: "Throne of Glass",
        userId,
      },
    });
    await prisma.book.create({
      data: {
        ageCategory: "6_plus",
        formats: ["paper", "ebook"],
        isFavorite: true,
        language: "ukrainian",
        ownershipStatus: "owned",
        pagesCount: 200,
        partNumber: 2,
        readingProgress: { create: { rating: 8 } },
        readingStatus: "reading",
        seriesId: created.id,
        tags: { create: [{ tagId: adventure.id }, { tagId: epic.id }] },
        title: "Crown of Midnight",
        userId,
      },
    });
    await prisma.book.create({
      data: {
        ageCategory: "12_plus",
        formats: ["audiobook"],
        language: "other",
        ownershipStatus: "want_to_buy",
        partNumber: 3,
        seriesId: created.id,
        title: "Heir of Fire",
        userId,
      },
    });

    return { adventureTagId: adventure.id, epicTagId: epic.id, seriesId: created.id };
  }

  it("averages the ratings of the linked books that carry one", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedAggregateSeries(userId);

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].averageRating).toBe(7.5);
  });

  it("counts the owned books against the total, leaving a borrowed book out of ownedCount", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedAggregateSeries(userId);

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].ownership).toEqual({ ownedCount: 1, total: 3 });
  });

  it("returns the deduplicated formats of the linked books in the declared enum order", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedAggregateSeries(userId);

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].formats).toEqual(["paper", "ebook", "audiobook"]);
  });

  it("returns the deduplicated tags of the linked books sorted by name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { adventureTagId, epicTagId } = await seedAggregateSeries(userId);

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].tags).toEqual([
      { id: adventureTagId, name: "adventure" },
      { id: epicTagId, name: "epic" },
    ]);
  });

  it("returns the deduplicated languages of the linked books in the declared enum order", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedAggregateSeries(userId);

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].languages).toEqual(["ukrainian", "english", "other"]);
  });

  it("returns the deduplicated age categories of the linked books in the declared enum order", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedAggregateSeries(userId);

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].ageCategories).toEqual(["6_plus", "12_plus", "18_plus"]);
  });

  it("sums and averages the page counts over the linked books that carry one", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedAggregateSeries(userId);

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ averagePages: 150, pagesCount: 300 });
  });

  it("flags a series holding a favorite book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedAggregateSeries(userId);

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].hasFavoriteBook).toBe(true);
  });

  it("returns empty aggregates and a zeroed ownership for a series with no linked books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.series.create({
      data: { name: "A Court of Thorns", normalizedName: "a court of thorns", userId },
    });

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      ageCategories: [],
      averagePages: null,
      averageRating: null,
      formats: [],
      hasFavoriteBook: false,
      languages: [],
      ownership: { ownedCount: 0, total: 0 },
      pagesCount: null,
      tags: [],
    });
  });
});

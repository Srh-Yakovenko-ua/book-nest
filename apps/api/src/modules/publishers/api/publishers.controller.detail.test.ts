import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { PublishersModule } from "../publishers.module.js";
import { seedBook, seedPublisher, seedSeries } from "./publisher-library.fixtures.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, PublishersModule]);
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

function getDetail(accessToken: string, publisherId: string, query = ""): request.Test {
  const path =
    query === ""
      ? `/api/publishers/${publisherId}/library-detail`
      : `/api/publishers/${publisherId}/library-detail?${query}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/publishers/:id/library-detail authentication", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/publishers/${MISSING_ID}/library-detail`,
    );

    expect(res.status).toBe(401);
  });
});

describe("GET /api/publishers/:id/library-detail happy path", () => {
  it("returns the publisher with the caller's library stats", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      countryCode: "UA",
      foundedYear: 2001,
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
      websiteUrl: "https://example.org",
    });
    await seedBook({
      prisma,
      publisherId: publisher.id,
      rating: 8,
      readingStatus: "finished",
      userId,
    });
    await seedBook({ prisma, publisherId: publisher.id, readingStatus: "reading", userId });

    const res = await getDetail(accessToken, publisher.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      countryCode: "UA",
      foundedYear: 2001,
      id: publisher.id,
      isCustom: false,
      name: "Penguin",
      stats: { averageRating: 8, booksCount: 2, ratedBooksCount: 1, readCount: 1, readingCount: 1 },
      websiteUrl: "https://example.org",
    });
    expect(res.body.id).toMatch(UUID_PATTERN);
  });

  it("resolves the display name to the requested locale", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Vydavnytstvo Stary Lev",
      names: [
        {
          isPrimary: true,
          locale: "en",
          name: "Vydavnytstvo Stary Lev",
          normalizedName: "vydavnytstvo stary lev",
        },
        {
          isPrimary: true,
          locale: "uk",
          name: "Видавництво Старого Лева",
          normalizedName: "видавництво старого лева",
        },
      ],
      normalizedName: "vydavnytstvo stary lev",
      prisma,
      userId: null,
    });
    await seedBook({ prisma, publisherId: publisher.id, userId });

    const english = await getDetail(accessToken, publisher.id, "locale=en");

    expect(english.body.name).toBe("Vydavnytstvo Stary Lev");
  });
});

describe("GET /api/publishers/:id/library-detail zero-book publishers", () => {
  const ZERO_STATS = {
    averageRating: null,
    booksCount: 0,
    lastBookAddedAt: null,
    lastBookReadAt: null,
    queueCount: 0,
    ratedBooksCount: 0,
    readCount: 0,
    readingCount: 0,
    seriesCount: 0,
    wantToBuyCount: 0,
    wantToReadCount: 0,
    wishlistWithoutPriceCount: 0,
  };

  it("returns 200 with zero stats for a global publisher the caller has no books for", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });

    const res = await getDetail(accessToken, publisher.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: publisher.id, isCustom: false, stats: ZERO_STATS });
  });

  it("returns 200 with zero stats for the caller's own custom publisher without books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "My Press",
      normalizedName: "my press",
      prisma,
      userId,
    });

    const res = await getDetail(accessToken, publisher.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: publisher.id, isCustom: true, stats: ZERO_STATS });
  });
});

describe("GET /api/publishers/:id/library-detail wishlist without price", () => {
  it("counts want-to-buy books without a priced store link and ignores the expected price", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    const wished = await seedBook({
      currency: "UAH",
      ownershipStatus: "want_to_buy",
      price: 250,
      prisma,
      publisherId: publisher.id,
      userId,
    });

    const before = await getDetail(accessToken, publisher.id);

    expect(before.body.stats).toMatchObject({
      booksCount: 1,
      wantToBuyCount: 1,
      wishlistWithoutPriceCount: 1,
    });

    await prisma.bookStoreLink.create({
      data: {
        bookId: wished.id,
        currency: "UAH",
        price: 300,
        storeName: "Yakaboo",
        url: "https://example.org/book",
        userId,
      },
    });

    const after = await getDetail(accessToken, publisher.id);

    expect(after.body.stats.wishlistWithoutPriceCount).toBe(0);
  });
});

describe("GET /api/publishers/:id/library-detail not found", () => {
  it("returns 404 for another user's custom publisher without leaking its existence", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerPress = await seedPublisher({
      name: "Stranger Press",
      normalizedName: "stranger press",
      prisma,
      userId: stranger.userId,
    });
    await seedBook({ prisma, publisherId: strangerPress.id, userId: owner.userId });

    const res = await getDetail(owner.accessToken, strangerPress.id);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a publisher id that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getDetail(accessToken, MISSING_ID);

    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed publisher id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getDetail(accessToken, "not-a-uuid");

    expect(res.status).toBe(400);
  });
});

function seedPenguin(): Promise<{ id: string }> {
  return seedPublisher({ name: "Penguin", normalizedName: "penguin", prisma, userId: null });
}

describe("GET /api/publishers/:id/library-detail stat semantics", () => {
  it("counts a want-to-buy book in booksCount alongside owned books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPenguin();
    await seedBook({ ownershipStatus: "want_to_buy", prisma, publisherId: publisher.id, userId });
    await seedBook({ ownershipStatus: "owned", prisma, publisherId: publisher.id, userId });

    const res = await getDetail(accessToken, publisher.id);

    expect(res.body.stats).toMatchObject({ booksCount: 2, wantToBuyCount: 1 });
  });

  it("counts a rereading book toward both readCount and readingCount", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPenguin();
    await seedBook({ prisma, publisherId: publisher.id, readingStatus: "finished", userId });
    await seedBook({ prisma, publisherId: publisher.id, readingStatus: "reading", userId });
    await seedBook({ prisma, publisherId: publisher.id, readingStatus: "rereading", userId });

    const res = await getDetail(accessToken, publisher.id);

    expect(res.body.stats).toMatchObject({ booksCount: 3, readCount: 2, readingCount: 2 });
  });

  it("excludes a soft-deleted series from seriesCount", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPenguin();
    const active = await seedSeries({ name: "Active Saga", prisma, userId });
    const trashed = await seedSeries({ name: "Trashed Saga", prisma, userId });
    await prisma.series.update({ data: TRASH_RETENTION.stamp(), where: { id: trashed.id } });
    await seedBook({
      partNumber: 1,
      prisma,
      publisherId: publisher.id,
      seriesId: active.id,
      userId,
    });
    await seedBook({
      partNumber: 1,
      prisma,
      publisherId: publisher.id,
      seriesId: trashed.id,
      userId,
    });

    const res = await getDetail(accessToken, publisher.id);

    expect(res.body.stats).toMatchObject({ booksCount: 2, seriesCount: 1 });
  });

  it("reports zero books when the only books are trashed or belong to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const publisher = await seedPenguin();
    const trashed = await seedBook({
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: publisher.id,
      rating: 9,
      userId: owner.userId,
    });
    await prisma.book.update({ data: TRASH_RETENTION.stamp(), where: { id: trashed.id } });
    await seedBook({
      prisma,
      publisherId: publisher.id,
      readingStatus: "finished",
      userId: stranger.userId,
    });

    const res = await getDetail(owner.accessToken, publisher.id);

    expect(res.status).toBe(200);
    expect(res.body.stats).toMatchObject({
      averageRating: null,
      booksCount: 0,
      lastBookAddedAt: null,
      readCount: 0,
      wantToBuyCount: 0,
      wishlistWithoutPriceCount: 0,
    });
  });

  it("agrees with the archive list item on every shared stat", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPenguin();
    const series = await seedSeries({ name: "Saga", prisma, userId });
    await seedBook({
      finishedAt: new Date("2026-03-04T00:00:00.000Z"),
      partNumber: 1,
      prisma,
      publisherId: publisher.id,
      rating: 7,
      readingStatus: "finished",
      seriesId: series.id,
      userId,
    });
    await seedBook({ prisma, publisherId: publisher.id, readingStatus: "rereading", userId });
    await seedBook({
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: publisher.id,
      queuePosition: 1,
      readingStatus: "want_to_read",
      userId,
    });

    const detail = await getDetail(accessToken, publisher.id);
    const archive = await request(app.getHttpServer())
      .get("/api/publishers/library")
      .set("Authorization", `Bearer ${accessToken}`);

    const { wishlistWithoutPriceCount, ...sharedStats } = detail.body.stats;
    expect(wishlistWithoutPriceCount).toBe(1);
    expect(sharedStats).toEqual(archive.body.items[0].stats);
    expect(sharedStats).toMatchObject({
      booksCount: 3,
      queueCount: 1,
      readCount: 2,
      readingCount: 1,
      seriesCount: 1,
      wantToBuyCount: 1,
      wantToReadCount: 1,
    });
  });
});

describe("GET /api/publishers/:id/library-detail wishlist without price edge cases", () => {
  it("keeps counting a want-to-buy book whose only store link has no price", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPenguin();
    const wished = await seedBook({
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: publisher.id,
      userId,
    });
    await prisma.bookStoreLink.create({
      data: { bookId: wished.id, storeName: "Yakaboo", url: "https://example.org/b", userId },
    });

    const res = await getDetail(accessToken, publisher.id);

    expect(res.body.stats.wishlistWithoutPriceCount).toBe(1);
  });

  it("does not count an owned book without a priced store link", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPenguin();
    await seedBook({ ownershipStatus: "owned", prisma, publisherId: publisher.id, userId });

    const res = await getDetail(accessToken, publisher.id);

    expect(res.body.stats.wishlistWithoutPriceCount).toBe(0);
  });
});

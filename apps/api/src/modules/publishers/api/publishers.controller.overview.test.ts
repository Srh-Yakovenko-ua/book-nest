import type { INestApplication } from "@nestjs/common";

import { subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { PublishersModule } from "../publishers.module.js";
import { seedBook, seedPublisher, seedSeries } from "./publisher-library.fixtures.js";

const MISSING_ID = "00000000-0000-4000-8000-000000000000";
const BASE_DATE = new Date("2026-05-01T10:00:00.000Z");

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

function getOverview(accessToken: string, publisherId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/publishers/${publisherId}/library-overview`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function seedGlobalPublisher(): Promise<{ id: string }> {
  return seedPublisher({ name: "Penguin", normalizedName: "penguin", prisma, userId: null });
}

describe("GET /api/publishers/:id/library-overview authentication", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/publishers/${MISSING_ID}/library-overview`,
    );

    expect(res.status).toBe(401);
  });
});

describe("GET /api/publishers/:id/library-overview visibility", () => {
  it("returns the empty shape for a visible publisher without caller books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobalPublisher();

    const res = await getOverview(accessToken, publisher.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ activeReading: [], latestBook: null, series: [], wishlist: [] });
  });

  it("returns 404 for another user's custom publisher", async () => {
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

    const res = await getOverview(owner.accessToken, strangerPress.id);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a publisher id that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getOverview(accessToken, MISSING_ID);

    expect(res.status).toBe(404);
  });
});

describe("GET /api/publishers/:id/library-overview blocks", () => {
  it("resolves the latest book tie on createdAt by id and hides a trashed series", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobalPublisher();
    const series = await seedSeries({ name: "Saga", prisma, userId });
    await prisma.series.update({
      data: { deletedAt: BASE_DATE, purgeAt: BASE_DATE },
      where: { id: series.id },
    });
    const first = await seedBook({
      createdAt: BASE_DATE,
      prisma,
      publisherId: publisher.id,
      seriesId: series.id,
      title: "First",
      userId,
    });
    const second = await seedBook({
      createdAt: BASE_DATE,
      prisma,
      publisherId: publisher.id,
      seriesId: series.id,
      title: "Second",
      userId,
    });
    const expectedId = [first.id, second.id].sort()[0];

    const res = await getOverview(accessToken, publisher.id);

    expect(res.status).toBe(200);
    expect(res.body.latestBook).toMatchObject({ id: expectedId, series: null });
    expect(res.body.series).toEqual([]);
  });

  it("ranks reading books with progress before those without and limits to three", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobalPublisher();
    const withProgress = await seedBook({
      createdAt: subDays(BASE_DATE, 10),
      hasProgress: true,
      prisma,
      publisherId: publisher.id,
      readingStatus: "reading",
      userId,
    });
    for (const offset of [1, 2, 3]) {
      await seedBook({
        createdAt: subDays(BASE_DATE, offset),
        prisma,
        publisherId: publisher.id,
        readingStatus: "rereading",
        userId,
      });
    }

    const res = await getOverview(accessToken, publisher.id);

    expect(res.body.activeReading).toHaveLength(3);
    expect(res.body.activeReading[0]).toMatchObject({ id: withProgress.id, progress: null });
  });

  it("orders the wishlist by wishlist-added date and exposes the canonical best offer", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobalPublisher();
    const older = await seedBook({
      createdAt: subDays(BASE_DATE, 5),
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: publisher.id,
      userId,
    });
    const newer = await seedBook({
      createdAt: subDays(BASE_DATE, 1),
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: publisher.id,
      userId,
    });
    await prisma.book.update({ data: { wishlistAddedAt: BASE_DATE }, where: { id: older.id } });
    await prisma.bookStoreLink.create({
      data: {
        bookId: older.id,
        currency: "UAH",
        price: 199,
        storeName: "Yakaboo",
        url: "https://example.org/older",
        userId,
      },
    });

    const res = await getOverview(accessToken, publisher.id);

    expect(res.body.wishlist.map((book: { id: string }) => book.id)).toEqual([older.id, newer.id]);
    expect(res.body.wishlist[0].bestOffer).toEqual({ currency: "UAH", price: 199 });
    expect(res.body.wishlist[1].bestOffer).toBeNull();
  });

  it("counts rereading as read in the publisher-scoped series block", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobalPublisher();
    const series = await seedSeries({ name: "Saga", prisma, userId });
    await seedBook({
      partNumber: 1,
      prisma,
      publisherId: publisher.id,
      readingStatus: "finished",
      seriesId: series.id,
      userId,
    });
    await seedBook({
      partNumber: 2,
      prisma,
      publisherId: publisher.id,
      readingStatus: "rereading",
      seriesId: series.id,
      userId,
    });
    await seedBook({ partNumber: 3, prisma, seriesId: series.id, userId });

    const res = await getOverview(accessToken, publisher.id);

    expect(res.body.series).toEqual([
      { booksCount: 2, id: series.id, name: "Saga", readCount: 2, status: "unknown" },
    ]);
  });
});

function idsOf(items: { id: string }[]): string[] {
  return items.map((item) => item.id);
}

async function setBookUpdatedAt(bookId: string, updatedAt: Date): Promise<void> {
  await prisma.$executeRaw`UPDATE books SET updated_at = ${updatedAt} WHERE id = ${bookId}::uuid`;
}

async function setProgressUpdatedAt(bookId: string, updatedAt: Date): Promise<void> {
  await prisma.$executeRaw`UPDATE book_reading_progress SET updated_at = ${updatedAt} WHERE book_id = ${bookId}::uuid`;
}

describe("GET /api/publishers/:id/library-overview latest book", () => {
  it("returns the newest book with its active series slot", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobalPublisher();
    const series = await seedSeries({ name: "Saga", prisma, userId });
    await seedBook({ createdAt: subDays(BASE_DATE, 3), prisma, publisherId: publisher.id, userId });
    const newest = await seedBook({
      createdAt: BASE_DATE,
      ownershipStatus: "owned",
      partNumber: 2,
      prisma,
      publisherId: publisher.id,
      readingStatus: "reading",
      seriesId: series.id,
      title: "Newest",
      userId,
    });

    const res = await getOverview(accessToken, publisher.id);

    expect(res.body.latestBook).toMatchObject({
      createdAt: BASE_DATE.toISOString(),
      id: newest.id,
      ownershipStatus: "owned",
      readingStatus: "reading",
      series: { id: series.id, name: "Saga", partNumber: 2, totalBooks: null },
      title: "Newest",
    });
  });

  it("ignores trashed books and books of another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const publisher = await seedGlobalPublisher();
    const trashed = await seedBook({
      createdAt: BASE_DATE,
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: publisher.id,
      readingStatus: "reading",
      userId: owner.userId,
    });
    await prisma.book.update({
      data: { deletedAt: BASE_DATE, purgeAt: BASE_DATE },
      where: { id: trashed.id },
    });
    await seedBook({
      createdAt: BASE_DATE,
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: publisher.id,
      readingStatus: "reading",
      userId: stranger.userId,
    });

    const res = await getOverview(owner.accessToken, publisher.id);

    expect(res.body).toEqual({ activeReading: [], latestBook: null, series: [], wishlist: [] });
  });
});

describe("GET /api/publishers/:id/library-overview active reading", () => {
  it("ranks by reading progress activity rather than the book's own updatedAt", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobalPublisher();
    const recentlyRead = await seedBook({
      createdAt: subDays(BASE_DATE, 20),
      hasProgress: true,
      prisma,
      publisherId: publisher.id,
      readingStatus: "reading",
      userId,
    });
    const recentlyEdited = await seedBook({
      createdAt: subDays(BASE_DATE, 20),
      hasProgress: true,
      prisma,
      publisherId: publisher.id,
      readingStatus: "reading",
      userId,
    });
    await setProgressUpdatedAt(recentlyRead.id, BASE_DATE);
    await setProgressUpdatedAt(recentlyEdited.id, subDays(BASE_DATE, 5));
    await setBookUpdatedAt(recentlyRead.id, subDays(BASE_DATE, 10));
    await setBookUpdatedAt(recentlyEdited.id, BASE_DATE);

    const res = await getOverview(accessToken, publisher.id);

    expect(idsOf(res.body.activeReading)).toEqual([recentlyRead.id, recentlyEdited.id]);
  });

  it("leaves out books that are not being read or reread", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobalPublisher();
    const rereading = await seedBook({
      prisma,
      publisherId: publisher.id,
      readingStatus: "rereading",
      userId,
    });
    for (const readingStatus of ["finished", "want_to_read", "not_started"]) {
      await seedBook({ prisma, publisherId: publisher.id, readingStatus, userId });
    }

    const res = await getOverview(accessToken, publisher.id);

    expect(idsOf(res.body.activeReading)).toEqual([rereading.id]);
  });

  it("exposes progress when the current page and a positive page count are known", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobalPublisher();
    const book = await seedBook({
      hasProgress: true,
      prisma,
      publisherId: publisher.id,
      readingStatus: "reading",
      userId,
    });
    await prisma.book.update({ data: { pagesCount: 320 }, where: { id: book.id } });
    await prisma.bookReadingProgress.update({
      data: { currentPage: 80 },
      where: { bookId: book.id },
    });

    const res = await getOverview(accessToken, publisher.id);

    expect(res.body.activeReading[0].progress).toEqual({ currentPage: 80, pagesCount: 320 });
  });
});

describe("GET /api/publishers/:id/library-overview wishlist", () => {
  it("orders by the wishlist-added date falling back to the created date", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobalPublisher();
    const createdRecently = await seedBook({
      createdAt: subDays(BASE_DATE, 1),
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: publisher.id,
      userId,
    });
    const wishedMidway = await seedBook({
      createdAt: subDays(BASE_DATE, 10),
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: publisher.id,
      userId,
    });
    const createdLastWishedEarly = await seedBook({
      createdAt: BASE_DATE,
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: publisher.id,
      userId,
    });
    await prisma.book.update({
      data: { wishlistAddedAt: subDays(BASE_DATE, 5) },
      where: { id: wishedMidway.id },
    });
    await prisma.book.update({
      data: { wishlistAddedAt: subDays(BASE_DATE, 8) },
      where: { id: createdLastWishedEarly.id },
    });

    const res = await getOverview(accessToken, publisher.id);

    expect(idsOf(res.body.wishlist)).toEqual([
      createdRecently.id,
      wishedMidway.id,
      createdLastWishedEarly.id,
    ]);
  });

  it("keeps only want-to-buy books and at most three of them", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobalPublisher();
    for (const offset of [1, 2, 3, 4]) {
      await seedBook({
        createdAt: subDays(BASE_DATE, offset),
        ownershipStatus: "want_to_buy",
        prisma,
        publisherId: publisher.id,
        userId,
      });
    }
    const owned = await seedBook({
      createdAt: BASE_DATE,
      ownershipStatus: "owned",
      prisma,
      publisherId: publisher.id,
      userId,
    });

    const res = await getOverview(accessToken, publisher.id);

    expect(res.body.wishlist).toHaveLength(3);
    expect(idsOf(res.body.wishlist)).not.toContain(owned.id);
  });
});

describe("GET /api/publishers/:id/library-overview series", () => {
  it("ranks series by publisher book count then name and keeps three", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobalPublisher();
    const zulu = await seedSeries({ name: "Zulu", prisma, userId });
    const charlie = await seedSeries({ name: "Charlie", prisma, userId });
    const alpha = await seedSeries({ name: "Alpha", prisma, userId });
    const bravo = await seedSeries({ name: "Bravo", prisma, userId });
    await seedBook({ partNumber: 1, prisma, publisherId: publisher.id, seriesId: zulu.id, userId });
    await seedBook({ partNumber: 2, prisma, publisherId: publisher.id, seriesId: zulu.id, userId });
    for (const series of [charlie, alpha, bravo]) {
      await seedBook({
        partNumber: 1,
        prisma,
        publisherId: publisher.id,
        seriesId: series.id,
        userId,
      });
    }

    const res = await getOverview(accessToken, publisher.id);

    expect(idsOf(res.body.series)).toEqual([zulu.id, alpha.id, bravo.id]);
    expect(res.body.series[0]).toMatchObject({ booksCount: 2, readCount: 0 });
  });

  it("hides a soft-deleted series while keeping its sibling", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobalPublisher();
    const active = await seedSeries({ name: "Active", prisma, userId });
    const trashed = await seedSeries({ name: "Trashed", prisma, userId });
    await prisma.series.update({
      data: { deletedAt: BASE_DATE, purgeAt: BASE_DATE },
      where: { id: trashed.id },
    });
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

    const res = await getOverview(accessToken, publisher.id);

    expect(idsOf(res.body.series)).toEqual([active.id]);
  });
});

describe("GET /api/publishers/:id/library-overview custom publishers", () => {
  it("returns the empty shape for the caller's own custom publisher without books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const custom = await seedPublisher({
      name: "My Press",
      normalizedName: "my press",
      prisma,
      userId,
    });

    const res = await getOverview(accessToken, custom.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ activeReading: [], latestBook: null, series: [], wishlist: [] });
  });

  it("returns 400 for a malformed publisher id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getOverview(accessToken, "not-a-uuid");

    expect(res.status).toBe(400);
  });
});

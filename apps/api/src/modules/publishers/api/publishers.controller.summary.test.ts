import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { PublishersModule } from "../publishers.module.js";
import { seedBook, seedPublisher } from "./publisher-library.fixtures.js";

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

function getSummary(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/publishers/library/summary")
    .set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/publishers/library/summary authentication", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/publishers/library/summary");

    expect(res.status).toBe(401);
  });
});

describe("GET /api/publishers/library/summary counts", () => {
  it("returns a zeroed summary shape for an empty library", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      averageBookRating: null,
      bestRatedPublishers: [],
      booksToBuyWithPublisherCount: 0,
      booksWithoutPublisherCount: 0,
      booksWithPublisherCount: 0,
      expectedPriceTotals: [],
      mostReadPublisher: null,
      mostRepresentedPublisher: null,
      publishersCount: 0,
      publishersInPlansCount: 0,
      ratedBooksCount: 0,
      topFiveBooksCoveragePercent: 0,
      unreadPublishers: [],
      wantToBuyBooksCount: 0,
    });
  });

  it("counts distinct publishers and splits books by whether they have a publisher", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const one = await seedPublisher({ name: "One", normalizedName: "one", prisma, userId: null });
    const two = await seedPublisher({ name: "Two", normalizedName: "two", prisma, userId: null });
    await seedBook({ prisma, publisherId: one.id, userId });
    await seedBook({ prisma, publisherId: one.id, userId });
    await seedBook({ prisma, publisherId: two.id, userId });
    await seedBook({ prisma, publisherId: null, userId });

    const res = await getSummary(accessToken);

    expect(res.body).toMatchObject({
      booksWithoutPublisherCount: 1,
      booksWithPublisherCount: 3,
      publishersCount: 2,
    });
  });

  it("counts want-to-buy books across the library", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "One",
      normalizedName: "one",
      prisma,
      userId: null,
    });
    await seedBook({ ownershipStatus: "want_to_buy", prisma, publisherId: publisher.id, userId });
    await seedBook({ ownershipStatus: "want_to_buy", prisma, publisherId: null, userId });
    await seedBook({ ownershipStatus: "owned", prisma, publisherId: publisher.id, userId });

    const res = await getSummary(accessToken);

    expect(res.body.wantToBuyBooksCount).toBe(2);
  });

  it("does not count another user's books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const publisher = await seedPublisher({
      name: "One",
      normalizedName: "one",
      prisma,
      userId: null,
    });
    await seedBook({ prisma, publisherId: publisher.id, userId: stranger.userId });

    const res = await getSummary(owner.accessToken);

    expect(res.body).toMatchObject({ booksWithPublisherCount: 0, publishersCount: 0 });
  });
});

describe("GET /api/publishers/library/summary average book rating", () => {
  it("weights the average by each rated book rather than by publisher", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisherX = await seedPublisher({
      name: "X",
      normalizedName: "x",
      prisma,
      userId: null,
    });
    const publisherY = await seedPublisher({
      name: "Y",
      normalizedName: "y",
      prisma,
      userId: null,
    });
    await seedBook({ prisma, publisherId: publisherX.id, rating: 5, userId });
    await seedBook({ prisma, publisherId: publisherY.id, rating: 4, userId });
    await seedBook({ prisma, publisherId: publisherY.id, rating: 4, userId });
    await seedBook({ prisma, publisherId: publisherY.id, rating: 4, userId });

    const res = await getSummary(accessToken);

    expect(res.body.averageBookRating).toBe(4.25);
    expect(res.body.ratedBooksCount).toBe(4);
  });

  it("ignores books whose rating is null", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({ name: "X", normalizedName: "x", prisma, userId: null });
    await seedBook({ prisma, publisherId: publisher.id, rating: 6, userId });
    await seedBook({ prisma, publisherId: publisher.id, rating: null, userId });

    const res = await getSummary(accessToken);

    expect(res.body.averageBookRating).toBe(6);
    expect(res.body.ratedBooksCount).toBe(1);
  });
});

describe("GET /api/publishers/library/summary expected price totals", () => {
  it("groups totals by currency and never sums unlike currencies", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "One",
      normalizedName: "one",
      prisma,
      userId: null,
    });
    await seedBook({ currency: "UAH", price: 500, prisma, publisherId: publisher.id, userId });
    await seedBook({ currency: "EUR", price: 10, prisma, publisherId: publisher.id, userId });

    const res = await getSummary(accessToken);

    expect(res.body.expectedPriceTotals).toEqual([
      { amount: 10, currency: "EUR", pricedBooksCount: 1 },
      { amount: 500, currency: "UAH", pricedBooksCount: 1 },
    ]);
  });

  it("sums the amount and counts within a single currency bucket", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "One",
      normalizedName: "one",
      prisma,
      userId: null,
    });
    await seedBook({ currency: "UAH", price: 300, prisma, publisherId: publisher.id, userId });
    await seedBook({ currency: "UAH", price: 200, prisma, publisherId: publisher.id, userId });

    const res = await getSummary(accessToken);

    expect(res.body.expectedPriceTotals).toEqual([
      { amount: 500, currency: "UAH", pricedBooksCount: 2 },
    ]);
  });

  it("excludes purchase rows with a null price or a null currency", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "One",
      normalizedName: "one",
      prisma,
      userId: null,
    });
    await seedBook({ currency: "UAH", price: 500, prisma, publisherId: publisher.id, userId });
    await seedBook({ currency: null, price: 99, prisma, publisherId: publisher.id, userId });
    await seedBook({ currency: "USD", price: null, prisma, publisherId: publisher.id, userId });

    const res = await getSummary(accessToken);

    expect(res.body.expectedPriceTotals).toEqual([
      { amount: 500, currency: "UAH", pricedBooksCount: 1 },
    ]);
  });
});

function getSummaryWithQuery(accessToken: string, query: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/publishers/library/summary?${query}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function seedBooks(input: {
  count: number;
  publisherId: string;
  readingStatus?: string;
  userId: string;
}): Promise<void> {
  for (let index = 0; index < input.count; index += 1) {
    await seedBook({
      prisma,
      publisherId: input.publisherId,
      readingStatus: input.readingStatus,
      userId: input.userId,
    });
  }
}

function seedGlobal(name: string): Promise<{ id: string }> {
  return seedPublisher({ name, normalizedName: name.toLowerCase(), prisma, userId: null });
}

async function seedRatedBooks(input: {
  publisherId: string;
  ratings: number[];
  userId: string;
}): Promise<void> {
  for (const rating of input.ratings) {
    await seedBook({ prisma, publisherId: input.publisherId, rating, userId: input.userId });
  }
}

describe("GET /api/publishers/library/summary top five coverage", () => {
  it("reports 100 percent for a single publisher and ignores books without a publisher", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const only = await seedGlobal("Only Press");
    await seedBooks({ count: 2, publisherId: only.id, userId });
    await seedBook({ prisma, publisherId: null, userId });

    const res = await getSummary(accessToken);

    expect(res.body.topFiveBooksCoveragePercent).toBe(100);
  });

  it("reports 100 percent when the library has between two and five publishers", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    for (const [index, name] of ["Alpha", "Bravo", "Charlie", "Delta", "Echo"].entries()) {
      const publisher = await seedGlobal(name);
      await seedBooks({ count: index + 1, publisherId: publisher.id, userId });
    }
    await seedBook({ prisma, publisherId: null, userId });

    const res = await getSummary(accessToken);

    expect(res.body.topFiveBooksCoveragePercent).toBe(100);
  });

  it("returns the unrounded share of the five largest publishers when there are more than five", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const largest = await seedGlobal("Largest");
    await seedBooks({ count: 2, publisherId: largest.id, userId });
    for (const name of ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]) {
      const publisher = await seedGlobal(name);
      await seedBooks({ count: 1, publisherId: publisher.id, userId });
    }
    await seedBook({ prisma, publisherId: null, userId });

    const res = await getSummary(accessToken);

    expect(res.body.topFiveBooksCoveragePercent).toBeCloseTo(85.714285714, 8);
  });

  it("reports zero when every book lacks a publisher", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedBook({ prisma, publisherId: null, userId });

    const res = await getSummary(accessToken);

    expect(res.body.topFiveBooksCoveragePercent).toBe(0);
  });
});

describe("GET /api/publishers/library/summary most represented publisher", () => {
  it("picks the publisher with the most books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const small = await seedGlobal("Alpha");
    const big = await seedGlobal("Zulu");
    await seedBooks({ count: 1, publisherId: small.id, userId });
    await seedBooks({ count: 3, publisherId: big.id, userId });

    const res = await getSummary(accessToken);

    expect(res.body.mostRepresentedPublisher).toEqual({ booksCount: 3, id: big.id, name: "Zulu" });
  });

  it("breaks a books-count tie by name ascending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bravo = await seedGlobal("Bravo");
    const alpha = await seedGlobal("Alpha");
    await seedBooks({ count: 2, publisherId: bravo.id, userId });
    await seedBooks({ count: 2, publisherId: alpha.id, userId });

    const res = await getSummary(accessToken);

    expect(res.body.mostRepresentedPublisher).toEqual({
      booksCount: 2,
      id: alpha.id,
      name: "Alpha",
    });
  });

  it("breaks a books-count and name tie by id ascending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const sameLocalName = [{ isPrimary: true, locale: "uk", name: "Twin", normalizedName: "twin" }];
    const first = await seedPublisher({
      name: "Twin One",
      names: sameLocalName,
      normalizedName: "twin one",
      prisma,
      userId: null,
    });
    const second = await seedPublisher({
      name: "Twin Two",
      names: sameLocalName,
      normalizedName: "twin two",
      prisma,
      userId: null,
    });
    await seedBooks({ count: 1, publisherId: first.id, userId });
    await seedBooks({ count: 1, publisherId: second.id, userId });
    const expectedId = [first.id, second.id].sort()[0];

    const res = await getSummary(accessToken);

    expect(res.body.mostRepresentedPublisher).toEqual({
      booksCount: 1,
      id: expectedId,
      name: "Twin",
    });
  });
});

describe("GET /api/publishers/library/summary plans", () => {
  it("counts publishers with want-to-buy books and the attributed want-to-buy books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await seedGlobal("First");
    const second = await seedGlobal("Second");
    const owned = await seedGlobal("Owned");
    await seedBook({ ownershipStatus: "want_to_buy", prisma, publisherId: first.id, userId });
    await seedBook({ ownershipStatus: "want_to_buy", prisma, publisherId: first.id, userId });
    await seedBook({ ownershipStatus: "want_to_buy", prisma, publisherId: second.id, userId });
    await seedBook({ ownershipStatus: "owned", prisma, publisherId: owned.id, userId });
    await seedBook({ ownershipStatus: "want_to_buy", prisma, publisherId: null, userId });

    const res = await getSummary(accessToken);

    expect(res.body).toMatchObject({
      booksToBuyWithPublisherCount: 3,
      publishersInPlansCount: 2,
      wantToBuyBooksCount: 4,
    });
  });
});

describe("GET /api/publishers/library/summary most read publisher", () => {
  it("counts a rereading book as read", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const finished = await seedGlobal("Alpha");
    const rereading = await seedGlobal("Bravo");
    await seedBooks({ count: 1, publisherId: finished.id, readingStatus: "finished", userId });
    await seedBooks({ count: 1, publisherId: rereading.id, readingStatus: "rereading", userId });
    await seedBooks({ count: 1, publisherId: rereading.id, readingStatus: "finished", userId });

    const res = await getSummary(accessToken);

    expect(res.body.mostReadPublisher).toEqual({ id: rereading.id, name: "Bravo", readCount: 2 });
  });

  it("breaks a read-count tie by name ascending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const bravo = await seedGlobal("Bravo");
    const alpha = await seedGlobal("Alpha");
    await seedBooks({ count: 1, publisherId: bravo.id, readingStatus: "finished", userId });
    await seedBooks({ count: 1, publisherId: alpha.id, readingStatus: "finished", userId });

    const res = await getSummary(accessToken);

    expect(res.body.mostReadPublisher).toEqual({ id: alpha.id, name: "Alpha", readCount: 1 });
  });

  it("is null when no attributed book is read", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobal("Alpha");
    await seedBooks({ count: 2, publisherId: publisher.id, readingStatus: "reading", userId });
    await seedBook({ prisma, publisherId: null, readingStatus: "finished", userId });

    const res = await getSummary(accessToken);

    expect(res.body.mostReadPublisher).toBeNull();
  });
});

describe("GET /api/publishers/library/summary unread publishers", () => {
  it("ranks by unread count then name, skips fully read publishers and keeps three", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const most = await seedGlobal("Zulu");
    const charlie = await seedGlobal("Charlie");
    const alpha = await seedGlobal("Alpha");
    const bravo = await seedGlobal("Bravo");
    const fullyRead = await seedGlobal("Aardvark");
    await seedBooks({ count: 3, publisherId: most.id, userId });
    await seedBooks({ count: 1, publisherId: charlie.id, userId });
    await seedBooks({ count: 1, publisherId: alpha.id, userId });
    await seedBooks({ count: 1, publisherId: alpha.id, readingStatus: "finished", userId });
    await seedBooks({ count: 1, publisherId: bravo.id, userId });
    await seedBooks({ count: 2, publisherId: fullyRead.id, readingStatus: "rereading", userId });

    const res = await getSummary(accessToken);

    expect(res.body.unreadPublishers).toEqual([
      { id: most.id, name: "Zulu", unreadCount: 3 },
      { id: alpha.id, name: "Alpha", unreadCount: 1 },
      { id: bravo.id, name: "Bravo", unreadCount: 1 },
    ]);
  });
});

describe("GET /api/publishers/library/summary best rated publishers", () => {
  it("excludes a publisher with fewer than three rated books however high its rating", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const twoRatings = await seedGlobal("Two Ratings");
    const threeRatings = await seedGlobal("Three Ratings");
    await seedRatedBooks({ publisherId: twoRatings.id, ratings: [10, 10], userId });
    await seedBook({ prisma, publisherId: twoRatings.id, rating: null, userId });
    await seedRatedBooks({ publisherId: threeRatings.id, ratings: [5, 6, 7], userId });

    const res = await getSummary(accessToken);

    expect(res.body.bestRatedPublishers).toEqual([
      { averageRating: 6, id: threeRatings.id, name: "Three Ratings", ratedBooksCount: 3 },
    ]);
  });

  it("ranks by average rating, then rated books count, then name, and keeps three", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const top = await seedGlobal("Top");
    const moreRated = await seedGlobal("Zeta");
    const alpha = await seedGlobal("Alpha");
    const bravo = await seedGlobal("Bravo");
    await seedRatedBooks({ publisherId: top.id, ratings: [8, 8, 7], userId });
    await seedRatedBooks({ publisherId: moreRated.id, ratings: [7, 7, 7, 7], userId });
    await seedRatedBooks({ publisherId: alpha.id, ratings: [7, 7, 7], userId });
    await seedRatedBooks({ publisherId: bravo.id, ratings: [7, 7, 7], userId });

    const res = await getSummary(accessToken);

    expect(res.body.bestRatedPublishers).toEqual([
      { averageRating: 7.67, id: top.id, name: "Top", ratedBooksCount: 3 },
      { averageRating: 7, id: moreRated.id, name: "Zeta", ratedBooksCount: 4 },
      { averageRating: 7, id: alpha.id, name: "Alpha", ratedBooksCount: 3 },
    ]);
  });
});

describe("GET /api/publishers/library/summary locale", () => {
  async function seedBilingualPublisher(userId: string): Promise<{ id: string }> {
    const publisher = await seedPublisher({
      name: "Stary Lev",
      names: [
        { isPrimary: true, locale: "en", name: "Stary Lev", normalizedName: "stary lev" },
        { isPrimary: true, locale: "uk", name: "Старий Лев", normalizedName: "старий лев" },
      ],
      normalizedName: "stary lev",
      prisma,
      userId: null,
    });
    await seedBook({ prisma, publisherId: publisher.id, readingStatus: "finished", userId });
    await seedBook({ prisma, publisherId: publisher.id, userId });
    return publisher;
  }

  it("resolves insight names to the Ukrainian name by default", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedBilingualPublisher(userId);

    const res = await getSummary(accessToken);

    expect(res.body.mostRepresentedPublisher.name).toBe("Старий Лев");
    expect(res.body.mostReadPublisher.name).toBe("Старий Лев");
    expect(res.body.unreadPublishers[0].name).toBe("Старий Лев");
  });

  it("resolves insight names to the requested locale", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedBilingualPublisher(userId);

    const res = await getSummaryWithQuery(accessToken, "locale=en");

    expect(res.body.mostRepresentedPublisher.name).toBe("Stary Lev");
    expect(res.body.mostReadPublisher.name).toBe("Stary Lev");
    expect(res.body.unreadPublishers[0].name).toBe("Stary Lev");
  });

  it("rejects an unsupported locale with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getSummaryWithQuery(accessToken, "locale=fr");

    expect(res.status).toBe(400);
  });
});

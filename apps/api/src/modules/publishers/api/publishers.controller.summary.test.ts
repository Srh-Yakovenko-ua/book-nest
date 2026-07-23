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
      booksWithoutPublisherCount: 0,
      booksWithPublisherCount: 0,
      expectedPriceTotals: [],
      publishersCount: 0,
      ratedBooksCount: 0,
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

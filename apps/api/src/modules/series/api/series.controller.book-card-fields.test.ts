import type { Nullable } from "@app/shared";
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

type SeriesBookResponse = {
  activeDelivery: Nullable<{ expectedDeliveryDate: Nullable<string>; status: string }>;
  finishedAt: Nullable<string>;
  id: string;
  loanInfo: Nullable<{ loanType: string; personName: string }>;
  publisher: Nullable<{ id: string; name: string }>;
  startedAt: Nullable<string>;
};

function getSeries(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/series/${id}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/series/:id book card fields", () => {
  it("exposes reading dates, publisher, loan and delivery data on each book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const publisher = await prisma.publisher.create({
      data: { name: "Vivat", normalizedName: "vivat", userId },
    });
    const series = await prisma.series.create({
      data: { name: "Empyrean", normalizedName: "empyrean", userId },
    });

    const finished = await prisma.book.create({
      data: {
        partNumber: 1,
        publisherId: publisher.id,
        readingStatus: "finished",
        seriesId: series.id,
        title: "Fourth Wing",
        userId,
      },
    });
    await prisma.bookReadingProgress.create({
      data: {
        bookId: finished.id,
        finishedAt: new Date("2026-01-20T00:00:00.000Z"),
        rating: 9,
        startedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    });

    const reading = await prisma.book.create({
      data: {
        partNumber: 2,
        readingStatus: "reading",
        seriesId: series.id,
        title: "Iron Flame",
        userId,
      },
    });
    await prisma.bookReadingProgress.create({
      data: {
        bookId: reading.id,
        currentPage: 120,
        startedAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    });

    const unread = await prisma.book.create({
      data: {
        partNumber: 3,
        readingStatus: "not_started",
        seriesId: series.id,
        title: "Onyx Storm",
        userId,
      },
    });

    const lent = await prisma.book.create({
      data: {
        ownershipStatus: "lent_to_someone",
        partNumber: 4,
        seriesId: series.id,
        title: "The Lent One",
        userId,
      },
    });
    await prisma.bookLoan.create({
      data: {
        bookId: lent.id,
        expectedReturnDate: new Date("2026-07-01T00:00:00.000Z"),
        personName: "Olena",
        status: "active",
        type: "lent_to_someone",
        userId,
      },
    });

    const inTransit = await prisma.book.create({
      data: {
        ownershipStatus: "in_transit",
        partNumber: 5,
        seriesId: series.id,
        title: "The Incoming One",
        userId,
      },
    });
    await prisma.bookDelivery.create({
      data: {
        bookId: inTransit.id,
        expectedDeliveryDate: new Date("2026-06-10T00:00:00.000Z"),
        status: "in_transit",
        userId,
      },
    });
    await prisma.bookDelivery.create({
      data: {
        bookId: inTransit.id,
        cancelledAt: new Date("2026-05-01T00:00:00.000Z"),
        status: "cancelled",
        userId,
      },
    });

    const res = await getSeries(accessToken, series.id);

    expect(res.status).toBe(200);
    const byId = new Map<string, SeriesBookResponse>(
      res.body.books.map((book: SeriesBookResponse) => [book.id, book]),
    );

    expect(byId.get(finished.id)).toMatchObject({
      finishedAt: "2026-01-20",
      publisher: { id: publisher.id, name: "Vivat" },
      startedAt: "2026-01-02",
    });

    const readingBook = byId.get(reading.id);
    expect(readingBook?.startedAt).toBe("2026-02-01");
    expect(readingBook?.finishedAt).toBeNull();
    expect(readingBook?.publisher).toBeNull();

    const unreadBook = byId.get(unread.id);
    expect(unreadBook?.startedAt).toBeNull();
    expect(unreadBook?.finishedAt).toBeNull();
    expect(unreadBook?.loanInfo).toBeNull();
    expect(unreadBook?.activeDelivery).toBeNull();

    expect(byId.get(lent.id)?.loanInfo).toMatchObject({
      loanType: "lent_to_someone",
      personName: "Olena",
    });

    expect(byId.get(inTransit.id)?.activeDelivery).toMatchObject({
      expectedDeliveryDate: "2026-06-10",
      status: "in_transit",
    });
  });
});

import type { INestApplication } from "@nestjs/common";

import { isEqual, parseISO, subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { SeriesModule } from "../../series/series.module.js";
import { PublishersModule } from "../publishers.module.js";
import { seedBook, seedPublisher, seedSeries } from "./publisher-library.fixtures.js";

const BASE_DATE = new Date("2026-05-01T10:00:00.000Z");

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, PublishersModule, BooksModule, SeriesModule]);
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

type ArchiveItem = { id: string; stats: { booksCount: number; wantToBuyCount: number } };

async function archiveStats(
  accessToken: string,
  publisherId: string,
): Promise<ArchiveItem["stats"] | undefined> {
  const res = await authed(accessToken, "/api/publishers/library?pageSize=50");
  expect(res.status).toBe(200);
  const items: ArchiveItem[] = res.body.items;
  return items.find((item) => item.id === publisherId)?.stats;
}

function authed(accessToken: string, path: string): request.Test {
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

async function booksSummary(accessToken: string, publisherId: string) {
  const res = await authed(accessToken, `/api/books/overview?publisher=${publisherId}`);
  expect(res.status).toBe(200);
  return res.body.summary;
}

async function booksTotal(accessToken: string, query: string): Promise<number> {
  const res = await authed(accessToken, `/api/books?${query}`);
  expect(res.status).toBe(200);
  return res.body.totalCount;
}

async function detailStats(accessToken: string, publisherId: string) {
  const res = await authed(accessToken, `/api/publishers/${publisherId}/library-detail`);
  expect(res.status).toBe(200);
  return res.body.stats;
}

async function publisherOverview(accessToken: string, publisherId: string) {
  const res = await authed(accessToken, `/api/publishers/${publisherId}/library-overview`);
  expect(res.status).toBe(200);
  return res.body;
}

async function seedMixedKsdLibrary() {
  const owner = await context.registerVerifyAndLogin();
  const stranger = await context.registerVerifyAndLogin({
    email: "stranger@example.com",
    nickname: "stranger",
  });
  const { ksd, vivat } = await seedTwoPublishers();
  const userId = owner.userId;
  const oldest = await seedBook({
    createdAt: subDays(BASE_DATE, 9),
    ownershipStatus: "want_to_buy",
    prisma,
    publisherId: ksd.id,
    title: "Kobzar",
    userId,
  });
  const newest = await seedBook({
    createdAt: BASE_DATE,
    ownershipStatus: "owned",
    prisma,
    publisherId: ksd.id,
    readingStatus: "finished",
    title: "Zakhar Berkut",
    userId,
  });
  await seedBook({
    createdAt: subDays(BASE_DATE, 4),
    ownershipStatus: "want_to_buy",
    prisma,
    publisherId: ksd.id,
    readingStatus: "reading",
    title: "Lisova pisnia",
    userId,
  });
  await seedBook({
    createdAt: subDays(BASE_DATE, 2),
    prisma,
    publisherId: ksd.id,
    readingStatus: "rereading",
    title: "Tini zabutykh predkiv",
    userId,
  });
  const trashed = await seedBook({
    createdAt: subDays(BASE_DATE, 1),
    ownershipStatus: "want_to_buy",
    prisma,
    publisherId: ksd.id,
    title: "Trashed",
    userId,
  });
  await prisma.book.update({
    data: { deletedAt: BASE_DATE, purgeAt: BASE_DATE },
    where: { id: trashed.id },
  });
  await seedBook({
    createdAt: subDays(BASE_DATE, 1),
    ownershipStatus: "want_to_buy",
    prisma,
    publisherId: ksd.id,
    title: "Stranger copy",
    userId: stranger.userId,
  });
  await seedBook({
    createdAt: subDays(BASE_DATE, 3),
    ownershipStatus: "want_to_buy",
    prisma,
    publisherId: vivat.id,
    title: "Vivat book",
    userId,
  });
  await seedBook({ ownershipStatus: "want_to_buy", prisma, title: "No publisher", userId });
  return { accessToken: owner.accessToken, ksd, newest, oldest, vivat };
}

async function seedTwoPublishers(): Promise<{ ksd: { id: string }; vivat: { id: string } }> {
  const ksd = await seedPublisher({ name: "KSD", normalizedName: "ksd", prisma, userId: null });
  const vivat = await seedPublisher({
    name: "Vivat",
    normalizedName: "vivat",
    prisma,
    userId: null,
  });
  return { ksd, vivat };
}

function send(
  accessToken: string,
  method: "delete" | "patch" | "post",
  path: string,
  body: object = {},
): request.Test {
  return request(app.getHttpServer())
    [method](path)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("publisher cross-contract invariants on a mixed library", () => {
  it("agrees on the book count across archive, detail, books list and books overview", async () => {
    const { accessToken, ksd } = await seedMixedKsdLibrary();

    const archive = await archiveStats(accessToken, ksd.id);
    const detail = await detailStats(accessToken, ksd.id);
    const listTotal = await booksTotal(accessToken, `publisher=${ksd.id}`);
    const summary = await booksSummary(accessToken, ksd.id);

    expect([archive?.booksCount, detail.booksCount, listTotal, summary.total]).toEqual([
      4, 4, 4, 4,
    ]);
  });

  it("agrees on the want-to-buy count across detail, books overview and the owner-filtered list", async () => {
    const { accessToken, ksd } = await seedMixedKsdLibrary();

    const detail = await detailStats(accessToken, ksd.id);
    const summary = await booksSummary(accessToken, ksd.id);
    const listTotal = await booksTotal(accessToken, `publisher=${ksd.id}&owner=want_to_buy`);

    expect([detail.wantToBuyCount, summary.wantToBuy, listTotal]).toEqual([2, 2, 2]);
  });

  it("points the overview latest book at the head of the created_desc list and the detail lastBookAddedAt", async () => {
    const { accessToken, ksd, newest } = await seedMixedKsdLibrary();

    const overview = await publisherOverview(accessToken, ksd.id);
    const list = await authed(accessToken, `/api/books?publisher=${ksd.id}&sort=created_desc`);
    const detail = await detailStats(accessToken, ksd.id);

    expect(overview.latestBook.id).toBe(newest.id);
    expect(list.body.items[0].id).toBe(newest.id);
    expect(isEqual(parseISO(overview.latestBook.createdAt), BASE_DATE)).toBe(true);
    expect(isEqual(parseISO(detail.lastBookAddedAt), BASE_DATE)).toBe(true);
  });
});

describe("publisher cross-contract invariants after mutations", () => {
  it("moves a book from KSD to Vivat on the archive, detail and books list counts", async () => {
    const { accessToken, ksd, oldest, vivat } = await seedMixedKsdLibrary();

    const moved = await send(accessToken, "patch", `/api/books/${oldest.id}`, {
      publisherId: vivat.id,
    });

    expect(moved.status).toBe(200);
    const counts = {
      ksd: [
        (await archiveStats(accessToken, ksd.id))?.booksCount,
        (await detailStats(accessToken, ksd.id)).booksCount,
        await booksTotal(accessToken, `publisher=${ksd.id}`),
      ],
      vivat: [
        (await archiveStats(accessToken, vivat.id))?.booksCount,
        (await detailStats(accessToken, vivat.id)).booksCount,
        await booksTotal(accessToken, `publisher=${vivat.id}`),
      ],
    };
    expect(counts).toEqual({ ksd: [3, 3, 3], vivat: [2, 2, 2] });
  });

  it("moves a want-to-buy book to owned across detail, books overview, lists and the wishlist block", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { ksd } = await seedTwoPublishers();
    const book = await seedBook({
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: ksd.id,
      userId,
    });

    const bought = await send(accessToken, "post", `/api/books/${book.id}/ownership/mark-bought`);

    expect(bought.status).toBeLessThan(300);
    expect({
      archiveWantToBuy: (await archiveStats(accessToken, ksd.id))?.wantToBuyCount,
      detailWantToBuy: (await detailStats(accessToken, ksd.id)).wantToBuyCount,
      ownedTotal: await booksTotal(accessToken, `publisher=${ksd.id}&owner=owned`),
      summaryWantToBuy: (await booksSummary(accessToken, ksd.id)).wantToBuy,
      wantToBuyTotal: await booksTotal(accessToken, `publisher=${ksd.id}&owner=want_to_buy`),
      wishlist: (await publisherOverview(accessToken, ksd.id)).wishlist,
    }).toEqual({
      archiveWantToBuy: 0,
      detailWantToBuy: 0,
      ownedTotal: 1,
      summaryWantToBuy: 0,
      wantToBuyTotal: 0,
      wishlist: [],
    });
  });

  it("tracks a store-link price being added and removed on the wishlist price stats", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { ksd } = await seedTwoPublishers();
    const book = await seedBook({
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: ksd.id,
      userId,
    });
    const snapshot = async () => ({
      bestOffer: (await publisherOverview(accessToken, ksd.id)).wishlist[0].bestOffer,
      withoutPrice: (await detailStats(accessToken, ksd.id)).wishlistWithoutPriceCount,
    });

    const before = await snapshot();
    const link = await send(accessToken, "post", `/api/books/${book.id}/store-links`, {
      currency: "UAH",
      price: 250,
      storeName: "Yakaboo",
      url: "https://example.org/kobzar",
    });
    const withLink = await snapshot();
    const removed = await send(
      accessToken,
      "delete",
      `/api/books/${book.id}/store-links/${link.body.id}`,
    );
    const after = await snapshot();

    expect(link.status).toBe(201);
    expect(removed.status).toBeLessThan(300);
    expect([before, withLink, after]).toEqual([
      { bestOffer: null, withoutPrice: 1 },
      { bestOffer: { currency: "UAH", price: 250 }, withoutPrice: 0 },
      { bestOffer: null, withoutPrice: 1 },
    ]);
  });

  it("reflects a series rename and status change in the overview series block", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { ksd } = await seedTwoPublishers();
    const series = await seedSeries({ name: "Saga", prisma, userId });
    await seedBook({ partNumber: 1, prisma, publisherId: ksd.id, seriesId: series.id, userId });

    const updated = await send(accessToken, "patch", `/api/series/${series.id}`, {
      name: "Renamed Saga",
      status: "completed",
    });

    expect(updated.status).toBe(200);
    const overview = await publisherOverview(accessToken, ksd.id);
    expect(overview.series).toEqual([
      { booksCount: 1, id: series.id, name: "Renamed Saga", readCount: 0, status: "completed" },
    ]);
  });

  it("drops a soft-deleted series from the overview block and the detail seriesCount but keeps its books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { ksd } = await seedTwoPublishers();
    const series = await seedSeries({ name: "Saga", prisma, userId });
    await seedBook({ partNumber: 1, prisma, publisherId: ksd.id, seriesId: series.id, userId });
    const before = await detailStats(accessToken, ksd.id);

    const deleted = await send(accessToken, "delete", `/api/series/${series.id}`);

    expect(deleted.status).toBe(200);
    const after = await detailStats(accessToken, ksd.id);
    expect({
      afterBooks: after.booksCount,
      afterSeries: after.seriesCount,
      beforeSeries: before.seriesCount,
      overviewSeries: (await publisherOverview(accessToken, ksd.id)).series,
    }).toEqual({ afterBooks: 1, afterSeries: 0, beforeSeries: 1, overviewSeries: [] });
  });
});

describe("global books list search and quick filters next to publisher scoping", () => {
  it("matches books by publisher name in the global search by default", async () => {
    const { accessToken } = await seedMixedKsdLibrary();

    const total = await booksTotal(accessToken, "q=KSD");

    expect(total).toBe(4);
  });

  it("stops matching by publisher name when searchPublisher is false inside a publisher scope", async () => {
    const { accessToken, ksd } = await seedMixedKsdLibrary();

    const total = await booksTotal(accessToken, `q=KSD&publisher=${ksd.id}&searchPublisher=false`);

    expect(total).toBe(0);
  });

  it("keeps the finished status filter free of rereading books", async () => {
    const { accessToken, ksd, newest } = await seedMixedKsdLibrary();

    const res = await authed(accessToken, `/api/books?status=finished&publisher=${ksd.id}`);

    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([newest.id]);
  });
});

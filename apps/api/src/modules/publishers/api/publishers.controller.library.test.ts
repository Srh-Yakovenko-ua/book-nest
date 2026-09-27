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

function listLibrary(accessToken: string, query = ""): request.Test {
  const path = query === "" ? "/api/publishers/library" : `/api/publishers/library?${query}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

function namesOf(body: { items: { name: string }[] }): string[] {
  return body.items.map((item) => item.name);
}

describe("GET /api/publishers/library authentication", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/publishers/library");

    expect(res.status).toBe(401);
  });
});

describe("GET /api/publishers/library visibility", () => {
  it("includes a global publisher and the caller's own custom publisher that have the caller's books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const penguin = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    const myPress = await seedPublisher({
      name: "My Press",
      normalizedName: "my press",
      prisma,
      userId,
    });
    await seedBook({ prisma, publisherId: penguin.id, userId });
    await seedBook({ prisma, publisherId: myPress.id, userId });

    const res = await listLibrary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
    expect(namesOf(res.body)).toEqual(expect.arrayContaining(["Penguin", "My Press"]));
  });

  it("excludes a visible publisher that has none of the caller's books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const penguin = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    await seedPublisher({ name: "Vintage", normalizedName: "vintage", prisma, userId: null });
    await seedBook({ prisma, publisherId: penguin.id, userId });

    const res = await listLibrary(accessToken);

    expect(res.body.totalCount).toBe(1);
    expect(namesOf(res.body)).toEqual(["Penguin"]);
  });

  it("excludes another user's custom publisher even when the caller's book points at it", async () => {
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

    const res = await listLibrary(owner.accessToken);

    expect(res.body.totalCount).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  it("does not count another user's books toward a shared global publisher", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const penguin = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    await seedBook({ prisma, publisherId: penguin.id, userId: stranger.userId });

    const res = await listLibrary(owner.accessToken);

    expect(res.body.totalCount).toBe(0);
  });
});

describe("GET /api/publishers/library stats", () => {
  it("counts books by reading status, ownership, queue membership and distinct series", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    const seriesA = await seedSeries({ name: "Series A", prisma, userId });
    const seriesB = await seedSeries({ name: "Series B", prisma, userId });
    await seedBook({
      partNumber: 1,
      prisma,
      publisherId: publisher.id,
      readingStatus: "finished",
      seriesId: seriesA.id,
      userId,
    });
    await seedBook({
      partNumber: 2,
      prisma,
      publisherId: publisher.id,
      readingStatus: "finished",
      seriesId: seriesA.id,
      userId,
    });
    await seedBook({
      partNumber: 1,
      prisma,
      publisherId: publisher.id,
      readingStatus: "reading",
      seriesId: seriesB.id,
      userId,
    });
    await seedBook({
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: publisher.id,
      readingStatus: "want_to_read",
      userId,
    });
    await seedBook({ prisma, publisherId: publisher.id, queuePosition: 5, userId });

    const res = await listLibrary(accessToken);

    expect(res.body.items[0].stats).toMatchObject({
      booksCount: 5,
      queueCount: 1,
      readCount: 2,
      readingCount: 1,
      seriesCount: 2,
      wantToBuyCount: 1,
      wantToReadCount: 1,
    });
  });

  it("averages only the non-null ratings and reports the rated books count", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    await seedBook({ prisma, publisherId: publisher.id, rating: 5, userId });
    await seedBook({ prisma, publisherId: publisher.id, rating: 4, userId });
    await seedBook({ prisma, publisherId: publisher.id, rating: null, userId });

    const res = await listLibrary(accessToken);

    expect(res.body.items[0].stats).toMatchObject({
      averageRating: 4.5,
      booksCount: 3,
      ratedBooksCount: 2,
    });
  });

  it("reports a null average rating when the publisher has no rated books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    await seedBook({ prisma, publisherId: publisher.id, userId });

    const res = await listLibrary(accessToken);

    expect(res.body.items[0].stats.averageRating).toBeNull();
    expect(res.body.items[0].stats.ratedBooksCount).toBe(0);
  });

  it("serializes the latest finished date as a midnight UTC ISO string", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    await seedBook({
      finishedAt: new Date("2026-01-10"),
      prisma,
      publisherId: publisher.id,
      userId,
    });
    await seedBook({
      finishedAt: new Date("2026-01-20"),
      prisma,
      publisherId: publisher.id,
      userId,
    });

    const res = await listLibrary(accessToken);

    expect(res.body.items[0].stats.lastBookReadAt).toBe("2026-01-20T00:00:00.000Z");
  });

  it("recomputes a publisher's stats after a book moves to a different publisher", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const alpha = await seedPublisher({
      name: "Alpha",
      normalizedName: "alpha",
      prisma,
      userId: null,
    });
    const beta = await seedPublisher({
      name: "Beta",
      normalizedName: "beta",
      prisma,
      userId: null,
    });
    const moved = await seedBook({ prisma, publisherId: alpha.id, userId });
    await seedBook({ prisma, publisherId: beta.id, userId });

    await prisma.book.update({ data: { publisherId: beta.id }, where: { id: moved.id } });

    const res = await listLibrary(accessToken);

    const byName = new Map(
      res.body.items.map((item: { name: string; stats: { booksCount: number } }) => [
        item.name,
        item.stats.booksCount,
      ]),
    );
    expect(byName.get("Alpha")).toBeUndefined();
    expect(byName.get("Beta")).toBe(2);
  });
});

describe("GET /api/publishers/library geography filter", () => {
  async function seedGeographySet(userId: string): Promise<void> {
    const ua = await seedPublisher({
      countryCode: "UA",
      name: "Ukrainian",
      normalizedName: "ukrainian",
      prisma,
      userId: null,
    });
    const foreign = await seedPublisher({
      countryCode: "GB",
      name: "British",
      normalizedName: "british",
      prisma,
      userId: null,
    });
    const unknown = await seedPublisher({
      countryCode: null,
      name: "Unknown",
      normalizedName: "unknown",
      prisma,
      userId: null,
    });
    await seedBook({ prisma, publisherId: ua.id, userId });
    await seedBook({ prisma, publisherId: foreign.id, userId });
    await seedBook({ prisma, publisherId: unknown.id, userId });
  }

  it("returns only Ukrainian publishers", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGeographySet(userId);

    const res = await listLibrary(accessToken, "geography=ua");

    expect(namesOf(res.body)).toEqual(["Ukrainian"]);
  });

  it("returns only foreign publishers with a known non-Ukrainian country", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGeographySet(userId);

    const res = await listLibrary(accessToken, "geography=foreign");

    expect(namesOf(res.body)).toEqual(["British"]);
  });

  it("returns only publishers with an unknown country", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGeographySet(userId);

    const res = await listLibrary(accessToken, "geography=unknown");

    expect(namesOf(res.body)).toEqual(["Unknown"]);
  });
});

describe("GET /api/publishers/library source filter", () => {
  async function seedSourceSet(userId: string): Promise<void> {
    const global = await seedPublisher({
      name: "Global Seed",
      normalizedName: "global seed",
      prisma,
      userId: null,
    });
    const custom = await seedPublisher({
      name: "Custom Press",
      normalizedName: "custom press",
      prisma,
      userId,
    });
    await seedBook({ prisma, publisherId: global.id, userId });
    await seedBook({ prisma, publisherId: custom.id, userId });
  }

  it("returns only global publishers when source is global", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSourceSet(userId);

    const res = await listLibrary(accessToken, "source=global");

    expect(namesOf(res.body)).toEqual(["Global Seed"]);
    expect(res.body.items[0].isCustom).toBe(false);
  });

  it("returns only custom publishers when source is custom", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSourceSet(userId);

    const res = await listLibrary(accessToken, "source=custom");

    expect(namesOf(res.body)).toEqual(["Custom Press"]);
    expect(res.body.items[0].isCustom).toBe(true);
  });
});

describe("GET /api/publishers/library having filters", () => {
  it("keeps only publishers with at least one want-to-buy book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const wishlist = await seedPublisher({
      name: "Wishlist Press",
      normalizedName: "wishlist press",
      prisma,
      userId: null,
    });
    const plain = await seedPublisher({
      name: "Plain Press",
      normalizedName: "plain press",
      prisma,
      userId: null,
    });
    await seedBook({ ownershipStatus: "want_to_buy", prisma, publisherId: wishlist.id, userId });
    await seedBook({ ownershipStatus: "owned", prisma, publisherId: plain.id, userId });

    const res = await listLibrary(accessToken, "hasBooksToBuy=true");

    expect(namesOf(res.body)).toEqual(["Wishlist Press"]);
  });

  it("keeps only publishers with at least one series book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const withSeries = await seedPublisher({
      name: "Series Press",
      normalizedName: "series press",
      prisma,
      userId: null,
    });
    const withoutSeries = await seedPublisher({
      name: "Solo Press",
      normalizedName: "solo press",
      prisma,
      userId: null,
    });
    const series = await seedSeries({ name: "Series", prisma, userId });
    await seedBook({
      partNumber: 1,
      prisma,
      publisherId: withSeries.id,
      seriesId: series.id,
      userId,
    });
    await seedBook({ prisma, publisherId: withoutSeries.id, userId });

    const res = await listLibrary(accessToken, "hasSeries=true");

    expect(namesOf(res.body)).toEqual(["Series Press"]);
  });

  it("keeps only publishers with at least one rated book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const rated = await seedPublisher({
      name: "Rated Press",
      normalizedName: "rated press",
      prisma,
      userId: null,
    });
    const unrated = await seedPublisher({
      name: "Unrated Press",
      normalizedName: "unrated press",
      prisma,
      userId: null,
    });
    await seedBook({ prisma, publisherId: rated.id, rating: 7, userId });
    await seedBook({ prisma, publisherId: unrated.id, rating: null, userId });

    const res = await listLibrary(accessToken, "hasRatedBooks=true");

    expect(namesOf(res.body)).toEqual(["Rated Press"]);
  });

  it("combines geography, source and having filters with AND semantics", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const match = await seedPublisher({
      countryCode: "UA",
      name: "Match",
      normalizedName: "match",
      prisma,
      userId,
    });
    const wrongCountry = await seedPublisher({
      countryCode: "GB",
      name: "WrongCountry",
      normalizedName: "wrongcountry",
      prisma,
      userId,
    });
    const wrongSource = await seedPublisher({
      countryCode: "UA",
      name: "WrongSource",
      normalizedName: "wrongsource",
      prisma,
      userId: null,
    });
    await seedBook({ ownershipStatus: "want_to_buy", prisma, publisherId: match.id, userId });
    await seedBook({
      ownershipStatus: "want_to_buy",
      prisma,
      publisherId: wrongCountry.id,
      userId,
    });
    await seedBook({ ownershipStatus: "want_to_buy", prisma, publisherId: wrongSource.id, userId });

    const res = await listLibrary(accessToken, "geography=ua&source=custom&hasBooksToBuy=true");

    expect(namesOf(res.body)).toEqual(["Match"]);
  });
});

describe("GET /api/publishers/library search", () => {
  it("matches a publisher by its canonical name case-insensitively", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const penguin = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    const vintage = await seedPublisher({
      name: "Vintage",
      normalizedName: "vintage",
      prisma,
      userId: null,
    });
    await seedBook({ prisma, publisherId: penguin.id, userId });
    await seedBook({ prisma, publisherId: vintage.id, userId });

    const res = await listLibrary(accessToken, "search=PENGUIN");

    expect(namesOf(res.body)).toEqual(["Penguin"]);
  });

  it("matches a publisher by a localized alias held in its search text", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const staryLev = await seedPublisher({
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
      searchText: "vydavnytstvo stary lev видавництво старого лева",
      userId: null,
    });
    await seedBook({ prisma, publisherId: staryLev.id, userId });

    const res = await listLibrary(accessToken, `search=${encodeURIComponent("Старого")}`);

    expect(namesOf(res.body)).toEqual(["Видавництво Старого Лева"]);
  });

  it("resolves the display name to the requested locale", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const staryLev = await seedPublisher({
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
      searchText: "vydavnytstvo stary lev видавництво старого лева",
      userId: null,
    });
    await seedBook({ prisma, publisherId: staryLev.id, userId });

    const ukrainian = await listLibrary(accessToken, "locale=uk");
    const english = await listLibrary(accessToken, "locale=en");

    expect(ukrainian.body.items[0].name).toBe("Видавництво Старого Лева");
    expect(english.body.items[0].name).toBe("Vydavnytstvo Stary Lev");
  });
});

describe("GET /api/publishers/library sorting", () => {
  it("sorts by books count descending by default", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const many = await seedPublisher({
      name: "Many",
      normalizedName: "many",
      prisma,
      userId: null,
    });
    const few = await seedPublisher({ name: "Few", normalizedName: "few", prisma, userId: null });
    await seedBook({ prisma, publisherId: many.id, userId });
    await seedBook({ prisma, publisherId: many.id, userId });
    await seedBook({ prisma, publisherId: few.id, userId });

    const res = await listLibrary(accessToken);

    expect(namesOf(res.body)).toEqual(["Many", "Few"]);
  });

  it("orders publishers with no average rating last when sorting by average rating descending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const high = await seedPublisher({
      name: "High",
      normalizedName: "high",
      prisma,
      userId: null,
    });
    const low = await seedPublisher({ name: "Low", normalizedName: "low", prisma, userId: null });
    const none = await seedPublisher({
      name: "None",
      normalizedName: "none",
      prisma,
      userId: null,
    });
    await seedBook({ prisma, publisherId: high.id, rating: 9, userId });
    await seedBook({ prisma, publisherId: low.id, rating: 3, userId });
    await seedBook({ prisma, publisherId: none.id, rating: null, userId });

    const res = await listLibrary(accessToken, "sort=averageRating&order=desc");

    expect(namesOf(res.body)).toEqual(["High", "Low", "None"]);
  });

  it("breaks ties by name and stays stable across page boundaries", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    for (const name of ["Bravo", "Alpha", "Charlie"]) {
      const publisher = await seedPublisher({
        name,
        normalizedName: name.toLowerCase(),
        prisma,
        userId: null,
      });
      await seedBook({ prisma, publisherId: publisher.id, userId });
    }

    const res = await listLibrary(accessToken, "sort=booksCount&order=desc");

    expect(namesOf(res.body)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });
});

describe("GET /api/publishers/library pagination", () => {
  async function seedThree(userId: string): Promise<void> {
    for (const [index, name] of ["Press A", "Press B", "Press C"].entries()) {
      const publisher = await seedPublisher({
        name,
        normalizedName: name.toLowerCase(),
        prisma,
        userId: null,
      });
      for (let count = 0; count <= index; count += 1) {
        await seedBook({ prisma, publisherId: publisher.id, userId });
      }
    }
  }

  it("reports the database-level total independent of the page size", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedThree(userId);

    const res = await listLibrary(accessToken, "pageNumber=1&pageSize=2");

    expect(res.body).toMatchObject({ page: 1, pagesCount: 2, pageSize: 2, totalCount: 3 });
    expect(res.body.items).toHaveLength(2);
  });

  it("returns the remaining publisher on the trailing page", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedThree(userId);

    const res = await listLibrary(accessToken, "pageNumber=2&pageSize=2");

    expect(res.body).toMatchObject({ page: 2, totalCount: 3 });
    expect(res.body.items).toHaveLength(1);
  });

  it("returns an empty page shape when the caller has no represented publishers", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLibrary(accessToken);

    expect(res.body).toMatchObject({ page: 1, pagesCount: 0, totalCount: 0 });
    expect(res.body.items).toEqual([]);
  });
});

describe("GET /api/publishers/library validation", () => {
  it("rejects an unknown geography value with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLibrary(accessToken, "geography=mars");

    expect(res.status).toBe(400);
  });

  it("rejects an unknown sort value with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLibrary(accessToken, "sort=unknown");

    expect(res.status).toBe(400);
  });

  it("rejects a non-boolean having flag with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLibrary(accessToken, "hasSeries=maybe");

    expect(res.status).toBe(400);
  });
});

function seedGlobal(name: string): Promise<{ id: string }> {
  return seedPublisher({ name, normalizedName: name.toLowerCase(), prisma, userId: null });
}

async function seedTrashedSeries(userId: string, name: string): Promise<{ id: string }> {
  const series = await seedSeries({ name, prisma, userId });
  await prisma.series.update({ data: TRASH_RETENTION.stamp(), where: { id: series.id } });
  return series;
}

function sortedNamesOf(body: { items: { name: string }[] }): string[] {
  return namesOf(body).sort();
}

describe("GET /api/publishers/library read and reading semantics", () => {
  it("counts a rereading book toward both readCount and readingCount", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobal("Penguin");
    await seedBook({ prisma, publisherId: publisher.id, readingStatus: "finished", userId });
    await seedBook({ prisma, publisherId: publisher.id, readingStatus: "reading", userId });
    await seedBook({ prisma, publisherId: publisher.id, readingStatus: "rereading", userId });

    const res = await listLibrary(accessToken);

    expect(res.body.items[0].stats).toMatchObject({ booksCount: 3, readCount: 2, readingCount: 2 });
  });

  it("excludes a book in a soft-deleted series from seriesCount", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobal("Penguin");
    const active = await seedSeries({ name: "Active Saga", prisma, userId });
    const trashed = await seedTrashedSeries(userId, "Trashed Saga");
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

    const res = await listLibrary(accessToken);

    expect(res.body.items[0].stats).toMatchObject({ booksCount: 2, seriesCount: 1 });
  });

  it("does not keep a publisher whose only series is soft-deleted under hasSeries", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedGlobal("Trashed Series Press");
    const trashed = await seedTrashedSeries(userId, "Trashed Saga");
    await seedBook({
      partNumber: 1,
      prisma,
      publisherId: publisher.id,
      seriesId: trashed.id,
      userId,
    });

    const res = await listLibrary(accessToken, "hasSeries=true");

    expect(res.body).toMatchObject({ items: [], totalCount: 0 });
  });
});

describe("GET /api/publishers/library quick filter", () => {
  async function seedQuickFilterLibrary(userId: string): Promise<void> {
    const reading = await seedGlobal("Reading Press");
    const rereading = await seedGlobal("Rereading Press");
    const finished = await seedGlobal("Finished Press");
    const wishlist = await seedGlobal("Wishlist Press");
    const activeSeries = await seedGlobal("Active Series Press");
    const trashedSeries = await seedGlobal("Trashed Series Press");
    const saga = await seedSeries({ name: "Saga", prisma, userId });
    const trashedSaga = await seedTrashedSeries(userId, "Trashed Saga");
    await seedBook({ prisma, publisherId: reading.id, readingStatus: "reading", userId });
    await seedBook({ prisma, publisherId: rereading.id, readingStatus: "rereading", userId });
    await seedBook({ prisma, publisherId: finished.id, readingStatus: "finished", userId });
    await seedBook({ ownershipStatus: "want_to_buy", prisma, publisherId: wishlist.id, userId });
    await seedBook({
      partNumber: 1,
      prisma,
      publisherId: activeSeries.id,
      seriesId: saga.id,
      userId,
    });
    await seedBook({
      partNumber: 1,
      prisma,
      publisherId: trashedSeries.id,
      seriesId: trashedSaga.id,
      userId,
    });
  }

  it("returns every represented publisher when filter is all", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQuickFilterLibrary(userId);

    const res = await listLibrary(accessToken, "filter=all");

    expect(res.body.totalCount).toBe(6);
    expect(res.body.items).toHaveLength(6);
  });

  it("keeps publishers with a reading or rereading book when filter is reading", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQuickFilterLibrary(userId);

    const res = await listLibrary(accessToken, "filter=reading");

    expect(sortedNamesOf(res.body)).toEqual(["Reading Press", "Rereading Press"]);
    expect(res.body.totalCount).toBe(2);
  });

  it("keeps publishers with a finished or rereading book when filter is read", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQuickFilterLibrary(userId);

    const res = await listLibrary(accessToken, "filter=read");

    expect(sortedNamesOf(res.body)).toEqual(["Finished Press", "Rereading Press"]);
    expect(res.body.totalCount).toBe(2);
  });

  it("keeps only publishers with a want-to-buy book when filter is to_buy", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQuickFilterLibrary(userId);

    const res = await listLibrary(accessToken, "filter=to_buy");

    expect(namesOf(res.body)).toEqual(["Wishlist Press"]);
    expect(res.body.totalCount).toBe(1);
  });

  it("keeps only publishers with a book in an active series when filter is series", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQuickFilterLibrary(userId);

    const res = await listLibrary(accessToken, "filter=series");

    expect(namesOf(res.body)).toEqual(["Active Series Press"]);
    expect(res.body.totalCount).toBe(1);
  });

  it("combines the quick filter with an advanced flag using AND semantics", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const queuedReader = await seedGlobal("Queued Reader Press");
    const unqueuedReader = await seedGlobal("Unqueued Reader Press");
    const queuedUnread = await seedGlobal("Queued Unread Press");
    await seedBook({
      prisma,
      publisherId: queuedReader.id,
      queuePosition: 1,
      readingStatus: "finished",
      userId,
    });
    await seedBook({ prisma, publisherId: unqueuedReader.id, readingStatus: "finished", userId });
    await seedBook({ prisma, publisherId: queuedUnread.id, queuePosition: 2, userId });

    const res = await listLibrary(accessToken, "filter=read&hasQueue=true");

    expect(namesOf(res.body)).toEqual(["Queued Reader Press"]);
    expect(res.body.totalCount).toBe(1);
  });

  it("rejects an unknown quick filter value with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLibrary(accessToken, "filter=unread");

    expect(res.status).toBe(400);
  });
});

describe("GET /api/publishers/library advanced flags", () => {
  async function seedWantToReadLibrary(userId: string): Promise<void> {
    const wanted = await seedGlobal("Wanted Press");
    const started = await seedGlobal("Started Press");
    await seedBook({ prisma, publisherId: wanted.id, readingStatus: "want_to_read", userId });
    await seedBook({ prisma, publisherId: started.id, readingStatus: "reading", userId });
  }

  async function seedQueueLibrary(userId: string): Promise<void> {
    const queued = await seedGlobal("Queued Press");
    const idle = await seedGlobal("Idle Press");
    await seedBook({ prisma, publisherId: queued.id, queuePosition: 1, userId });
    await seedBook({ prisma, publisherId: idle.id, userId });
  }

  it("keeps only publishers with a want-to-read book when hasWantToRead is true", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedWantToReadLibrary(userId);

    const res = await listLibrary(accessToken, "hasWantToRead=true");

    expect(namesOf(res.body)).toEqual(["Wanted Press"]);
    expect(res.body.totalCount).toBe(1);
  });

  it("keeps publishers without a want-to-read book when hasWantToRead is false", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedWantToReadLibrary(userId);

    const res = await listLibrary(accessToken, "hasWantToRead=false");

    expect(sortedNamesOf(res.body)).toEqual(["Started Press", "Wanted Press"]);
  });

  it("keeps only publishers with a queued book when hasQueue is true", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQueueLibrary(userId);

    const res = await listLibrary(accessToken, "hasQueue=true");

    expect(namesOf(res.body)).toEqual(["Queued Press"]);
    expect(res.body.totalCount).toBe(1);
  });

  it("keeps publishers without a queued book when hasQueue is false", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQueueLibrary(userId);

    const res = await listLibrary(accessToken, "hasQueue=false");

    expect(sortedNamesOf(res.body)).toEqual(["Idle Press", "Queued Press"]);
  });

  it("keeps an unrated publisher when hasRatedBooks is false", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const unrated = await seedGlobal("Unrated Press");
    await seedBook({ prisma, publisherId: unrated.id, rating: null, userId });

    const res = await listLibrary(accessToken, "hasRatedBooks=false");

    expect(namesOf(res.body)).toEqual(["Unrated Press"]);
  });
});

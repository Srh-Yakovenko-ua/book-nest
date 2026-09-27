import type { LibraryPublishersQuickCounts, LibraryPublishersQuickFilter } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import {
  LibraryPublishersQuickCountsSchema,
  LibraryPublishersQuickFilterSchema,
} from "@app/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

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

const TotalCountSchema = z.object({ totalCount: z.number() });

const ZERO_COUNTS: LibraryPublishersQuickCounts = {
  all: 0,
  read: 0,
  reading: 0,
  series: 0,
  to_buy: 0,
};

function authorized(path: string, accessToken: string): request.Test {
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

async function listTotal(accessToken: string, query: string): Promise<number> {
  const res = await authorized(`/api/publishers/library?${query}`, accessToken);
  expect(res.status).toBe(200);
  return TotalCountSchema.parse(res.body).totalCount;
}

async function quickCounts(accessToken: string, query = ""): Promise<LibraryPublishersQuickCounts> {
  const res = await authorized(
    query === ""
      ? "/api/publishers/library/quick-counts"
      : `/api/publishers/library/quick-counts?${query}`,
    accessToken,
  );
  expect(res.status).toBe(200);
  return LibraryPublishersQuickCountsSchema.parse(res.body);
}

function seedGlobal({
  countryCode = null,
  name,
}: {
  countryCode?: null | string;
  name: string;
}): Promise<{ id: string }> {
  return seedPublisher({
    countryCode,
    name,
    normalizedName: name.toLowerCase(),
    prisma,
    userId: null,
  });
}

async function seedQuickCountLibrary(userId: string): Promise<void> {
  const reading = await seedGlobal({ countryCode: "UA", name: "Reading Press" });
  const finished = await seedGlobal({ countryCode: "UA", name: "Finished Press" });
  const wishlist = await seedGlobal({ countryCode: "GB", name: "Wishlist Press" });
  const saga = await seedGlobal({ countryCode: "GB", name: "Saga Press" });
  const custom = await seedPublisher({
    countryCode: null,
    name: "Home Press",
    normalizedName: "home press",
    prisma,
    userId,
  });
  const series = await seedSeries({ name: "Saga", prisma, userId });

  await seedBook({ prisma, publisherId: reading.id, readingStatus: "reading", userId });
  await seedBook({ prisma, publisherId: reading.id, readingStatus: "finished", userId });
  await seedBook({ prisma, publisherId: finished.id, readingStatus: "finished", userId });
  await seedBook({ ownershipStatus: "want_to_buy", prisma, publisherId: wishlist.id, userId });
  await seedBook({ partNumber: 1, prisma, publisherId: saga.id, seriesId: series.id, userId });
  await seedBook({ prisma, publisherId: custom.id, readingStatus: "rereading", userId });
  await seedBook({ ownershipStatus: "want_to_buy", prisma, publisherId: custom.id, userId });
}

describe("GET /api/publishers/library/quick-counts authentication", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/publishers/library/quick-counts");

    expect(res.status).toBe(401);
  });
});

describe("GET /api/publishers/library/quick-counts", () => {
  it("returns zero for every key when the caller has no represented publishers", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    expect(await quickCounts(accessToken)).toEqual(ZERO_COUNTS);
  });

  it("counts the publishers every chip would show over the whole library", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQuickCountLibrary(userId);

    expect(await quickCounts(accessToken)).toEqual({
      all: 5,
      read: 3,
      reading: 2,
      series: 1,
      to_buy: 2,
    });
  });

  it("follows the search", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQuickCountLibrary(userId);

    expect(await quickCounts(accessToken, "search=home")).toEqual({
      all: 1,
      read: 1,
      reading: 1,
      series: 0,
      to_buy: 1,
    });
  });

  it("follows the geography filter", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQuickCountLibrary(userId);

    expect(await quickCounts(accessToken, "geography=ua")).toEqual({
      all: 2,
      read: 2,
      reading: 1,
      series: 0,
      to_buy: 0,
    });
  });

  it("follows the source filter", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQuickCountLibrary(userId);

    expect(await quickCounts(accessToken, "source=global")).toEqual({
      all: 4,
      read: 2,
      reading: 1,
      series: 1,
      to_buy: 1,
    });
  });

  it("follows the advanced having flags", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQuickCountLibrary(userId);

    expect(await quickCounts(accessToken, "hasBooksToBuy=true")).toEqual({
      all: 2,
      read: 1,
      reading: 1,
      series: 0,
      to_buy: 2,
    });
  });

  it("ignores the selected quick filter, paging and sort", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQuickCountLibrary(userId);

    const unfiltered = await quickCounts(accessToken);
    const withQuickFilter = await quickCounts(
      accessToken,
      "filter=series&pageNumber=2&pageSize=1&sort=name&order=asc",
    );

    expect(withQuickFilter).toEqual(unfiltered);
  });

  it("rejects an unknown geography with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authorized(
      "/api/publishers/library/quick-counts?geography=mars",
      accessToken,
    );

    expect(res.status).toBe(400);
  });

  it("does not count another user's books or custom publishers", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedQuickCountLibrary(stranger.userId);

    expect(await quickCounts(owner.accessToken)).toEqual(ZERO_COUNTS);
  });

  it("leaves out a publisher whose only books are in the trash, like the list does", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const kept = await seedGlobal({ name: "Kept Press" });
    const trashed = await seedGlobal({ name: "Trashed Press" });
    await seedBook({ prisma, publisherId: kept.id, readingStatus: "finished", userId });
    const trashedBook = await seedBook({
      prisma,
      publisherId: trashed.id,
      readingStatus: "finished",
      userId,
    });
    await prisma.book.update({ data: TRASH_RETENTION.stamp(), where: { id: trashedBook.id } });

    const counts = await quickCounts(accessToken);

    expect(counts).toEqual({ all: 1, read: 1, reading: 0, series: 0, to_buy: 0 });
    expect(await listTotal(accessToken, "filter=read")).toBe(counts.read);
  });
});

describe("GET /api/publishers/library/quick-counts matches the list total", () => {
  const CASES: string[] = [
    "",
    "search=press",
    "geography=ua",
    "geography=foreign&source=global",
    "source=custom",
    "hasBooksToBuy=true",
    "hasSeries=true&geography=foreign",
  ];

  it.each(CASES)("for every chip under params %j", async (params) => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedQuickCountLibrary(userId);

    const counts = await quickCounts(accessToken, params);

    const expected = await Promise.all(
      LibraryPublishersQuickFilterSchema.options.map(
        async (key: LibraryPublishersQuickFilter) =>
          [key, await listTotal(accessToken, withQuickFilter(params, key))] as const,
      ),
    );
    expect(counts).toEqual(Object.fromEntries(expected));
  });
});

function withQuickFilter(params: string, key: LibraryPublishersQuickFilter): string {
  const search = new URLSearchParams(params);
  search.set("filter", key);
  return search.toString();
}

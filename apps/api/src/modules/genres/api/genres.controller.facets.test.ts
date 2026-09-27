import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { GenresModule } from "../genres.module.js";

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

function getFacets(accessToken: string, query = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/genres/facets${query === "" ? "" : `?${query}`}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function seedBook(input: {
  genres: string[];
  ownershipStatus?: string;
  queuePosition?: number;
  readingStatus?: string;
  userId: string;
}): Promise<unknown> {
  return prisma.book.create({
    data: {
      genres: input.genres,
      ownershipStatus: input.ownershipStatus ?? "none",
      queuePosition: input.queuePosition,
      readingStatus: input.readingStatus ?? "not_started",
      title: "Untitled",
      userId: input.userId,
    },
  });
}

async function seedCatalog(): Promise<void> {
  await seedGenre({
    groupKey: "fiction",
    groupName: "Художня",
    key: "fantasy",
    name: "Фентезі",
    sortOrder: 1,
  });
  await seedGenre({
    groupKey: "fiction",
    groupName: "Художня",
    key: "romance",
    name: "Романтика",
    sortOrder: 2,
  });
  await seedGenre({
    groupKey: "nonfiction",
    groupName: "Нехудожня",
    key: "history",
    name: "Історія",
    sortOrder: 10,
  });
  await seedGenre({
    groupKey: "kids",
    groupName: "Дитяча",
    key: "fairy-tale",
    name: "Казка",
    sortOrder: 20,
  });
}

function seedGenre(input: {
  groupKey: string;
  groupName: string;
  key: string;
  name: string;
  sortOrder: number;
}): Promise<unknown> {
  return prisma.genre.create({
    data: {
      ...input,
      isDefault: true,
      normalizedName: input.name.toLowerCase(),
      userId: null,
    },
  });
}

describe("GET /api/genres/facets", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/genres/facets");

    expect(res.status).toBe(401);
  });

  it("returns zero counts and no groups for an empty library", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCatalog();

    const res = await getFacets(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      groups: [],
      quickCounts: { all: 0, finished: 0, in_queue: 0, unread: 0, want_to_buy: 0 },
    });
  });

  it("counts overlapping quick filters and lists only groups the user uses", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedCatalog();
    await seedBook({ genres: ["fantasy"], readingStatus: "finished", userId });
    await seedBook({ genres: ["fantasy", "history"], queuePosition: 1, userId });
    await seedBook({ genres: ["romance"], ownershipStatus: "want_to_buy", userId });

    const res = await getFacets(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      groups: [
        { key: "fiction", label: "Художня" },
        { key: "nonfiction", label: "Нехудожня" },
      ],
      quickCounts: { all: 3, finished: 1, in_queue: 2, unread: 3, want_to_buy: 1 },
    });
  });

  it("narrows quick counts by search and advanced filters while keeping groups stable", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedCatalog();
    await seedBook({ genres: ["fantasy"], readingStatus: "finished", userId });
    await seedBook({ genres: ["fantasy", "history"], queuePosition: 1, userId });

    const bySearch = await getFacets(accessToken, `q=${encodeURIComponent("історія")}`);
    const byGroup = await getFacets(accessToken, "group=fiction&booksMin=2");

    expect(bySearch.body.quickCounts).toEqual({
      all: 1,
      finished: 0,
      in_queue: 1,
      unread: 1,
      want_to_buy: 0,
    });
    expect(byGroup.body.quickCounts).toEqual({
      all: 1,
      finished: 1,
      in_queue: 1,
      unread: 1,
      want_to_buy: 0,
    });
    expect(byGroup.body.groups).toEqual(bySearch.body.groups);
    expect(byGroup.body.groups).toHaveLength(2);
  });

  it("ignores list-only parameters such as the quick filter and sort", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedCatalog();
    await seedBook({ genres: ["fantasy"], readingStatus: "finished", userId });
    await seedBook({ genres: ["romance"], userId });

    const res = await getFacets(accessToken, "filter=finished&sort=name_asc");

    expect(res.status).toBe(200);
    expect(res.body.quickCounts.all).toBe(2);
  });

  it("rejects a rating range where the minimum exceeds the maximum", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getFacets(accessToken, "ratingMin=9&ratingMax=5");

    expect(res.status).toBe(400);
  });

  it("ignores another user's books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    await seedCatalog();
    await seedBook({ genres: ["fantasy"], userId: owner.userId });
    await seedBook({ genres: ["history"], readingStatus: "finished", userId: stranger.userId });
    await seedBook({ genres: ["fantasy"], queuePosition: 1, userId: stranger.userId });
    await seedBook({
      genres: ["fairy-tale"],
      ownershipStatus: "want_to_buy",
      userId: stranger.userId,
    });

    const res = await getFacets(owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      groups: [{ key: "fiction", label: "Художня" }],
      quickCounts: { all: 1, finished: 0, in_queue: 0, unread: 1, want_to_buy: 0 },
    });
  });
});

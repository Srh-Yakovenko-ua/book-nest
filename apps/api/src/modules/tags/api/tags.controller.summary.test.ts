import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";
import type { TagsUsageFixtures } from "./tags-usage.fixtures.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { TagsModule } from "../tags.module.js";
import { createTagsUsageFixtures } from "./tags-usage.fixtures.js";

let context: AuthTestContext;
let app: INestApplication;
let seed: TagsUsageFixtures;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, TagsModule]);
  app = context.app;
  seed = createTagsUsageFixtures(app.get(PrismaService));
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

const HIDDEN_AT = new Date("2026-01-15T00:00:00.000Z");

function getSummary(accessToken: string, query = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/tags/summary${query === "" ? "" : `?${query}`}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

async function seedLibrary(userId: string): Promise<void> {
  const dune = await seed.book({ title: "Dune", userId });
  const messiah = await seed.book({ title: "Messiah", userId });
  await seed.book({ title: "Untagged", userId });
  const trashed = await seed.book({ deletedAt: HIDDEN_AT, title: "Trashed", userId });
  const paul = await seed.character({ name: "Paul", userId });
  const twist = await seed.character({ hideProfileAsSpoiler: true, name: "Twist", userId });
  await seed.character({ name: "Untagged", userId });
  const archived = await seed.character({ archivedAt: HIDDEN_AT, name: "Archived", userId });
  const deleted = await seed.character({ deletedAt: HIDDEN_AT, name: "Deleted", userId });
  await seed.appearIn({ bookIds: [dune.id, messiah.id], characterId: paul.id });

  const desert = await seed.tag({ color: "honey", name: "desert", type: "atmosphere", userId });
  await seed.tagBooks({ bookIds: [dune.id, messiah.id, trashed.id], tagId: desert.id });

  const chosen = await seed.tag({ color: null, name: "chosen one", type: "trope", userId });
  await seed.tagBooks({ bookIds: [dune.id], tagId: chosen.id });
  await seed.tagCharacters({ characterIds: [paul.id, twist.id], tagId: chosen.id });

  const mentor = await seed.tag({ color: "#A96E47", name: "mentor", type: "character", userId });
  await seed.tagCharacters({ characterIds: [paul.id, archived.id, deleted.id], tagId: mentor.id });

  await seed.tag({ color: "sage", name: "unused", type: "trope", userId });
}

function sumOf(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

describe("GET /api/tags/summary", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/tags/summary");

    expect(res.status).toBe(401);
  });

  it("B-SUM-01 ignores catalog search, filter and pagination params", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedLibrary(userId);

    const baseline = await getSummary(accessToken);
    const withCatalogParams = await getSummary(
      accessToken,
      "q=nothing-matches&filter=unused&type=format&color=rose&pageSize=1",
    );

    expect(withCatalogParams.status).toBe(200);
    expect(withCatalogParams.body).toEqual(baseline.body);
    expect(withCatalogParams.body.totalTagsCount).toBe(4);
  });

  it("B-SUM-02 counts only the caller's own tags in totalTagsCount", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedLibrary(owner.userId);
    await seedLibrary(stranger.userId);
    await seed.tag({ name: "stranger only", userId: stranger.userId });

    const res = await getSummary(owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalTagsCount).toBe(4);
  });

  it("B-SUM-03 counts unique active tagged books and excludes trashed books from both totals", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedLibrary(userId);

    const res = await getSummary(accessToken);

    expect(res.body).toMatchObject({ taggedBooksCount: 2, totalBooksCount: 3 });
  });

  it("B-SUM-04 counts unique visible tagged characters, including spoiler-hidden ones", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedLibrary(userId);

    const res = await getSummary(accessToken);

    expect(res.body).toMatchObject({ taggedCharactersCount: 2, totalCharactersCount: 3 });
  });

  it("B-SUM-05 counts a tagged character that appears in several books once", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const books = [await seed.book({ userId }), await seed.book({ userId })];
    const paul = await seed.character({ name: "Paul", userId });
    await seed.appearIn({ bookIds: books.map((book) => book.id), characterId: paul.id });
    const tag = await seed.tag({ name: "chosen one", userId });
    await seed.tagCharacters({ characterIds: [paul.id], tagId: tag.id });

    const res = await getSummary(accessToken);

    expect(res.body.taggedCharactersCount).toBe(1);
    expect(res.body.mostUsed).toMatchObject({ usageCount: 1 });
  });

  it("B-SUM-06 returns mostUsed null when every tag's links point at hidden entities", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const trashed = await seed.book({ deletedAt: HIDDEN_AT, userId });
    const archived = await seed.character({ archivedAt: HIDDEN_AT, name: "Archived", userId });
    const tag = await seed.tag({ name: "forgotten", userId });
    await seed.tagBooks({ bookIds: [trashed.id], tagId: tag.id });
    await seed.tagCharacters({ characterIds: [archived.id], tagId: tag.id });
    await seed.tag({ name: "never used", userId });

    const res = await getSummary(accessToken);

    expect(res.body.totalTagsCount).toBe(2);
    expect(res.body.mostUsed).toBeNull();
  });

  it("B-SUM-06 returns mostUsed null when the caller has no tags", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mostUsed: null, totalTagsCount: 0 });
  });

  it("B-SUM-07 reports the full tie size and the first two leaders by name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const book = await seed.book({ userId });
    const character = await seed.character({ name: "Paul", userId });
    const gamma = await seed.tag({ name: "gamma", userId });
    const alpha = await seed.tag({ name: "alpha", userId });
    const beta = await seed.tag({ name: "beta", userId });
    await seed.tagBooks({ bookIds: [book.id], tagId: gamma.id });
    await seed.tagCharacters({ characterIds: [character.id], tagId: alpha.id });
    await seed.tagBooks({ bookIds: [book.id], tagId: beta.id });
    await seed.tag({ name: "aardvark", userId });

    const res = await getSummary(accessToken);

    expect(res.body.mostUsed).toEqual({
      leaders: [
        { booksCount: 0, charactersCount: 1, id: alpha.id, name: "alpha" },
        { booksCount: 1, charactersCount: 0, id: beta.id, name: "beta" },
      ],
      leadersCount: 3,
      usageCount: 1,
    });
  });

  it("B-SUM-07 picks the single highest-usage tag as the only leader", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedLibrary(userId);

    const res = await getSummary(accessToken);

    expect(res.body.mostUsed).toMatchObject({
      leaders: [{ booksCount: 1, charactersCount: 2, name: "chosen one" }],
      leadersCount: 1,
      usageCount: 3,
    });
  });

  it("B-SUM-08 / B-SUM-11 keeps every type key and partitions totalTagsCount", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedLibrary(userId);

    const res = await getSummary(accessToken);

    expect(res.body.typeCounts).toEqual({
      atmosphere: 1,
      character: 1,
      custom: 0,
      format: 0,
      theme: 0,
      trope: 2,
    });
    expect(sumOf(res.body.typeCounts)).toBe(res.body.totalTagsCount);
  });

  it("B-SUM-09 / B-SUM-10 / B-SUM-12 folds null and legacy colors into parchment", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedLibrary(userId);

    const res = await getSummary(accessToken);

    expect(res.body.colorCounts).toEqual({
      forest: 0,
      honey: 1,
      lavender: 0,
      parchment: 2,
      rose: 0,
      sage: 1,
      sky: 0,
      terracotta: 0,
    });
    expect(sumOf(res.body.colorCounts)).toBe(res.body.totalTagsCount);
  });

  it("B-SUM-13 splits tags into exclusive visible-usage buckets", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedLibrary(userId);

    const res = await getSummary(accessToken);

    expect(res.body.usageDistribution).toEqual({
      booksOnly: 1,
      both: 1,
      charactersOnly: 1,
      unused: 1,
    });
  });
});

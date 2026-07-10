import type { ChangelogCategory, Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ChangelogModule } from "../changelog.module.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PUBLISHED_A = new Date("2026-01-01T00:00:00.000Z");
const PUBLISHED_B = new Date("2026-02-01T00:00:00.000Z");
const PUBLISHED_C = new Date("2026-03-01T00:00:00.000Z");
const FUTURE = new Date("2999-01-01T00:00:00.000Z");

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, ChangelogModule]);
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

function getChangelog(options: { query?: string; token?: string } = {}): request.Test {
  const path = options.query === undefined ? "/api/changelog" : `/api/changelog?${options.query}`;
  const req = request(app.getHttpServer()).get(path);
  return options.token === undefined ? req : req.set("Authorization", `Bearer ${options.token}`);
}

function markSeen(token?: string): request.Test {
  const req = request(app.getHttpServer()).post("/api/changelog/seen");
  return token === undefined ? req : req.set("Authorization", `Bearer ${token}`);
}

function seedEntry(input: {
  body?: string;
  bodyEn?: string;
  bodyUk?: string;
  category?: ChangelogCategory;
  publishedAt: Nullable<Date>;
  slug: string;
  title?: string;
  titleEn?: string;
  titleUk?: string;
  version?: Nullable<string>;
}): Promise<{ id: string }> {
  const body = input.body ?? "Details about the change";
  const title = input.title ?? input.slug;
  return prisma.changelogEntry.create({
    data: {
      bodyEn: input.bodyEn ?? body,
      bodyUk: input.bodyUk ?? body,
      category: input.category ?? "feature",
      publishedAt: input.publishedAt,
      slug: input.slug,
      titleEn: input.titleEn ?? title,
      titleUk: input.titleUk ?? title,
      version: input.version ?? null,
    },
    select: { id: true },
  });
}

function seedLocalizedEntry(slug: string, publishedAt: Date): Promise<{ id: string }> {
  return seedEntry({
    bodyEn: "We sped up search",
    bodyUk: "Ми пришвидшили пошук",
    publishedAt,
    slug,
    titleEn: "Faster search",
    titleUk: "Швидший пошук",
    version: "2.1.0",
  });
}

async function seedThreePublished(): Promise<void> {
  await seedEntry({ publishedAt: PUBLISHED_A, slug: "a" });
  await seedEntry({ publishedAt: PUBLISHED_C, slug: "c" });
  await seedEntry({ publishedAt: PUBLISHED_B, slug: "b" });
}

const TIE_SHARED = new Date("2026-06-01T00:00:00.000Z");

type WalkResult = {
  nextCursors: Nullable<string>[];
  pages: string[][];
  unreadCounts: number[];
};

async function seedCursorWalkEntries(): Promise<void> {
  await seedEntry({ publishedAt: new Date("2026-01-15T00:00:00.000Z"), slug: "w1" });
  await seedEntry({ publishedAt: new Date("2026-02-15T00:00:00.000Z"), slug: "w2" });
  await seedEntry({ publishedAt: new Date("2026-03-15T00:00:00.000Z"), slug: "w3" });
  await seedEntry({ publishedAt: new Date("2026-04-15T00:00:00.000Z"), slug: "w4" });
  await seedEntry({ publishedAt: new Date("2026-05-15T00:00:00.000Z"), slug: "w5" });
  await seedEntry({ publishedAt: TIE_SHARED, slug: "w6-tie" });
  await seedEntry({ publishedAt: TIE_SHARED, slug: "w7-tie" });
}

function slugsOf(body: { entries: { slug: string }[] }): string[] {
  return body.entries.map((entry) => entry.slug);
}

async function walkPages({ limit, token }: { limit: number; token?: string }): Promise<WalkResult> {
  const nextCursors: Nullable<string>[] = [];
  const pages: string[][] = [];
  const unreadCounts: number[] = [];
  let cursor: string | undefined;

  for (let guard = 0; guard < 20; guard += 1) {
    const query = cursor === undefined ? `limit=${limit}` : `limit=${limit}&cursor=${cursor}`;
    const res = await getChangelog({ query, token });
    expect(res.status).toBe(200);

    const nextCursor: Nullable<string> = res.body.nextCursor;
    pages.push(slugsOf(res.body));
    nextCursors.push(nextCursor);
    unreadCounts.push(res.body.unreadCount);

    if (nextCursor === null) {
      break;
    }
    cursor = nextCursor;
  }

  return { nextCursors, pages, unreadCounts };
}

describe("GET /api/changelog anonymous", () => {
  it("returns only published entries ordered by published date descending", async () => {
    await seedThreePublished();
    await seedEntry({ publishedAt: null, slug: "draft" });
    await seedEntry({ publishedAt: FUTURE, slug: "future" });

    const res = await getChangelog();

    expect(res.status).toBe(200);
    expect(slugsOf(res.body)).toEqual(["c", "b", "a"]);
  });

  it("reports an unread count of zero for an anonymous caller", async () => {
    await seedThreePublished();

    const res = await getChangelog();

    expect(res.body.unreadCount).toBe(0);
  });

  it("returns each entry in the changelog view shape without internal fields", async () => {
    await seedEntry({
      body: "Release notes",
      category: "improvement",
      publishedAt: PUBLISHED_A,
      slug: "release",
      title: "Release",
      version: "1.0.0",
    });

    const res = await getChangelog();

    expect(res.body.entries[0]).toEqual({
      body: "Release notes",
      category: "improvement",
      id: expect.stringMatching(UUID),
      publishedAt: PUBLISHED_A.toISOString(),
      slug: "release",
      title: "Release",
      version: "1.0.0",
    });
  });
});

describe("GET /api/changelog limit", () => {
  it("returns only the most recent entry when limit is 1", async () => {
    await seedThreePublished();

    const res = await getChangelog({ query: "limit=1" });

    expect(res.status).toBe(200);
    expect(slugsOf(res.body)).toEqual(["c"]);
  });

  it("returns 400 when limit exceeds the maximum", async () => {
    const res = await getChangelog({ query: "limit=99" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when limit is zero", async () => {
    const res = await getChangelog({ query: "limit=0" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when limit is negative", async () => {
    const res = await getChangelog({ query: "limit=-1" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when limit is not numeric", async () => {
    const res = await getChangelog({ query: "limit=abc" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/changelog locale resolution", () => {
  it("resolves title and body to the English fields when locale is en", async () => {
    await seedLocalizedEntry("faster-search", PUBLISHED_A);

    const res = await getChangelog({ query: "locale=en" });

    expect(res.status).toBe(200);
    expect(res.body.entries[0]).toMatchObject({
      body: "We sped up search",
      title: "Faster search",
    });
  });

  it("resolves title and body to the Ukrainian fields when locale is uk", async () => {
    await seedLocalizedEntry("faster-search", PUBLISHED_A);

    const res = await getChangelog({ query: "locale=uk" });

    expect(res.status).toBe(200);
    expect(res.body.entries[0]).toMatchObject({
      body: "Ми пришвидшили пошук",
      title: "Швидший пошук",
    });
  });

  it("defaults to the Ukrainian fields when locale is omitted", async () => {
    await seedLocalizedEntry("faster-search", PUBLISHED_A);

    const res = await getChangelog();

    expect(res.status).toBe(200);
    expect(res.body.entries[0]).toMatchObject({
      body: "Ми пришвидшили пошук",
      title: "Швидший пошук",
    });
  });

  it("returns the resolved view shape without the raw localized columns", async () => {
    await seedLocalizedEntry("faster-search", PUBLISHED_A);

    const res = await getChangelog({ query: "locale=en" });

    expect(res.body.entries[0]).toEqual({
      body: "We sped up search",
      category: "feature",
      id: expect.stringMatching(UUID),
      publishedAt: PUBLISHED_A.toISOString(),
      slug: "faster-search",
      title: "Faster search",
      version: "2.1.0",
    });
    expect(Object.keys(res.body.entries[0])).not.toEqual(
      expect.arrayContaining(["bodyEn", "bodyUk", "titleEn", "titleUk"]),
    );
  });
});

describe("GET /api/changelog locale validation", () => {
  it("returns 400 when locale is an unsupported language", async () => {
    const res = await getChangelog({ query: "locale=fr" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when locale is uppercased", async () => {
    const res = await getChangelog({ query: "locale=EN" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when locale is an empty string", async () => {
    const res = await getChangelog({ query: "locale=" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/changelog authenticated unread count", () => {
  it("counts every published entry when the user has never marked the changelog seen", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedThreePublished();
    await seedEntry({ publishedAt: null, slug: "draft" });
    await seedEntry({ publishedAt: FUTURE, slug: "future" });

    const res = await getChangelog({ token: accessToken });

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(3);
    expect(res.body.unreadCount).toBe(3);
  });

  it("drops the unread count to zero after the caller marks the changelog seen", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedThreePublished();

    const seenRes = await markSeen(accessToken);
    const res = await getChangelog({ token: accessToken });

    expect(seenRes.status).toBe(204);
    expect(res.body.unreadCount).toBe(0);
  });

  it("treats a malformed bearer token as anonymous instead of throwing", async () => {
    await seedThreePublished();

    const res = await getChangelog({ token: "not-a-valid-token" });

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(3);
    expect(res.body.unreadCount).toBe(0);
  });

  it("reports the same unread count regardless of the requested locale", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedThreePublished();

    const enRes = await getChangelog({ query: "locale=en", token: accessToken });
    const ukRes = await getChangelog({ query: "locale=uk", token: accessToken });

    expect(enRes.body.unreadCount).toBe(3);
    expect(ukRes.body.unreadCount).toBe(3);
  });
});

describe("GET /api/changelog cursor pagination", () => {
  it("walks every entry across pages without duplicates or gaps in a stable order", async () => {
    await seedCursorWalkEntries();
    const full = await getChangelog();
    const fullOrder = slugsOf(full.body);

    const { nextCursors, pages } = await walkPages({ limit: 3 });

    expect(pages.map((page) => page.length)).toEqual([3, 3, 1]);
    expect(pages.flat()).toEqual(fullOrder);
    expect(new Set(pages.flat()).size).toBe(fullOrder.length);
    expect(nextCursors.at(-1)).toBeNull();
  });

  it("keeps both entries that share a published date on stable, non-overlapping pages", async () => {
    await seedCursorWalkEntries();
    const full = await getChangelog();
    const fullOrder = slugsOf(full.body);

    const { pages } = await walkPages({ limit: 3 });
    const walked = pages.flat();

    expect(walked.filter((slug) => slug === "w6-tie")).toHaveLength(1);
    expect(walked.filter((slug) => slug === "w7-tie")).toHaveLength(1);
    expect(walked).toEqual(fullOrder);
  });

  it("exposes the id of the last entry on the page as the next cursor", async () => {
    await seedCursorWalkEntries();

    const firstPage = await getChangelog({ query: "limit=3" });
    const lastEntryId = firstPage.body.entries[2].id;

    expect(firstPage.body.nextCursor).toBe(lastEntryId);
  });

  it("does not shift the remaining pages when a newer entry lands mid-walk", async () => {
    await seedCursorWalkEntries();
    const full = await getChangelog();
    const fullOrder = slugsOf(full.body);

    const firstPage = await getChangelog({ query: "limit=3" });
    const expectedRemainder = fullOrder.slice(3);

    await seedEntry({ publishedAt: subDays(new Date(), 1), slug: "inserted-newer" });

    const secondPage = await getChangelog({
      query: `limit=3&cursor=${firstPage.body.nextCursor}`,
    });
    const thirdPage = await getChangelog({
      query: `limit=3&cursor=${secondPage.body.nextCursor}`,
    });

    expect([...slugsOf(secondPage.body), ...slugsOf(thirdPage.body)]).toEqual(expectedRemainder);
    expect(slugsOf(secondPage.body)).not.toContain("inserted-newer");
    expect(slugsOf(thirdPage.body)).not.toContain("inserted-newer");
  });

  it("returns every remaining entry after the cursor when no limit is supplied", async () => {
    await seedCursorWalkEntries();
    const full = await getChangelog();
    const fullOrder = slugsOf(full.body);
    const firstId = full.body.entries[0].id;

    const res = await getChangelog({ query: `cursor=${firstId}` });

    expect(res.status).toBe(200);
    expect(slugsOf(res.body)).toEqual(fullOrder.slice(1));
    expect(res.body.nextCursor).toBeNull();
  });

  it("returns an empty page with a null next cursor for a nonexistent cursor uuid", async () => {
    await seedCursorWalkEntries();

    const res = await getChangelog({
      query: "limit=3&cursor=00000000-0000-0000-0000-000000000000",
    });

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(0);
    expect(res.body.nextCursor).toBeNull();
  });

  it("returns 400 when the cursor is not a uuid", async () => {
    await seedCursorWalkEntries();

    const res = await getChangelog({ query: "limit=3&cursor=not-a-uuid" });

    expect(res.status).toBe(400);
  });

  it("reports the same unread count on every page of a walk", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedCursorWalkEntries();

    const { unreadCounts } = await walkPages({ limit: 3, token: accessToken });

    expect(unreadCounts).toEqual([7, 7, 7]);
  });

  it("resolves the locale on every page of a walk", async () => {
    await seedLocalizedEntry("localized-a", PUBLISHED_A);
    await seedLocalizedEntry("localized-b", PUBLISHED_B);

    const firstPage = await getChangelog({ query: "limit=1&locale=en" });
    const secondPage = await getChangelog({
      query: `limit=1&locale=en&cursor=${firstPage.body.nextCursor}`,
    });

    expect(firstPage.body.entries[0]).toMatchObject({
      body: "We sped up search",
      title: "Faster search",
    });
    expect(secondPage.body.entries[0]).toMatchObject({
      body: "We sped up search",
      title: "Faster search",
    });
  });

  it("excludes drafts and future-dated entries from a cursor walk", async () => {
    await seedCursorWalkEntries();
    await seedEntry({ publishedAt: null, slug: "draft" });
    await seedEntry({ publishedAt: FUTURE, slug: "future" });

    const { pages } = await walkPages({ limit: 3 });
    const walked = pages.flat();

    expect(walked).not.toContain("draft");
    expect(walked).not.toContain("future");
    expect(walked).toHaveLength(7);
  });
});

describe("POST /api/changelog/seen", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await markSeen();

    expect(res.status).toBe(401);
  });

  it("returns 204 and creates the caller's read marker", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const res = await markSeen(accessToken);

    expect(res.status).toBe(204);
    const marker = await prisma.changelogRead.findUnique({ where: { userId } });
    expect(marker).not.toBeNull();
  });

  it("keeps a single read marker when called repeatedly", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    await markSeen(accessToken);
    const secondRes = await markSeen(accessToken);

    expect(secondRes.status).toBe(204);
    const markerCount = await prisma.changelogRead.count({ where: { userId } });
    expect(markerCount).toBe(1);
  });

  it("writes the read marker for the token's user and ignores body and query input", async () => {
    const caller = await context.registerVerifyAndLogin();
    const other = await context.registerVerifyAndLogin();

    const res = await markSeen(caller.accessToken)
      .query({ userId: other.userId })
      .send({ userId: other.userId });

    expect(res.status).toBe(204);
    const callerMarker = await prisma.changelogRead.findUnique({
      where: { userId: caller.userId },
    });
    const otherMarker = await prisma.changelogRead.findUnique({ where: { userId: other.userId } });
    expect(callerMarker).not.toBeNull();
    expect(otherMarker).toBeNull();
  });
});

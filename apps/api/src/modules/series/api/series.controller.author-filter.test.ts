import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { SeriesModule } from "../series.module.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

function createAuthor(userId: string, name: string): Promise<{ id: string; name: string }> {
  return prisma.author.create({
    data: { name, normalizedName: name.toLowerCase(), userId },
    select: { id: true, name: true },
  });
}

function createSeries(userId: string, name: string, authorIds: string[]): Promise<{ id: string }> {
  return prisma.series.create({
    data: {
      authors: { create: authorIds.map((authorId) => ({ authorId })) },
      name,
      normalizedName: name.toLowerCase(),
      userId,
    },
    select: { id: true },
  });
}

function createSeriesBook(
  userId: string,
  seriesId: string,
  partNumber: number,
  authorIds: string[],
): Promise<{ id: string }> {
  return prisma.book.create({
    data: {
      authors: { create: authorIds.map((authorId, index) => ({ authorId, position: index })) },
      partNumber,
      seriesId,
      title: `Book ${partNumber}`,
      userId,
    },
    select: { id: true },
  });
}

function itemIds(body: { items: { id: string }[] }): string[] {
  return body.items.map((item) => item.id);
}

function searchSeries(accessToken: string, queryString = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/series${queryString}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/series?authorIds", () => {
  it("returns the author's booked series while excluding author-less and other authors' series", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const authorA = await createAuthor(userId, "Author A");
    const authorB = await createAuthor(userId, "Author B");
    const linkedToA = await createSeries(userId, "Linked To A", [authorA.id]);
    const linkedToB = await createSeries(userId, "Linked To B", [authorB.id]);
    const authorless = await createSeries(userId, "No Author", []);

    const res = await searchSeries(accessToken, `?authorIds=${authorA.id}`);

    expect(res.status).toBe(200);
    const ids = itemIds(res.body);
    expect(ids).toContain(linkedToA.id);
    expect(ids).not.toContain(authorless.id);
    expect(ids).not.toContain(linkedToB.id);
  });

  it("matches a series with no declared authors by the authors of its books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const authorA = await createAuthor(userId, "Author A");
    const authorB = await createAuthor(userId, "Author B");
    const derived = await createSeries(userId, "Derived", []);
    await createSeriesBook(userId, derived.id, 1, [authorA.id]);
    const otherAuthorSeries = await createSeries(userId, "Other", []);
    await createSeriesBook(userId, otherAuthorSeries.id, 1, [authorB.id]);

    const res = await searchSeries(accessToken, `?authorIds=${authorA.id}`);

    expect(res.status).toBe(200);
    const ids = itemIds(res.body);
    expect(ids).toContain(derived.id);
    expect(ids).not.toContain(otherAuthorSeries.id);
  });

  it("exposes the book authors deduped and ordered for a series with no declared authors", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const authorA = await createAuthor(userId, "Author A");
    const authorB = await createAuthor(userId, "Author B");
    const derived = await createSeries(userId, "Derived", []);
    await createSeriesBook(userId, derived.id, 1, [authorB.id, authorA.id]);
    await createSeriesBook(userId, derived.id, 2, [authorA.id]);

    const res = await searchSeries(accessToken, `?authorIds=${authorA.id}`);

    expect(res.status).toBe(200);
    const item = res.body.items.find((entry: { id: string }) => entry.id === derived.id);
    expect(item.authors).toEqual([
      { id: authorB.id, name: "Author B" },
      { id: authorA.id, name: "Author A" },
    ]);
  });

  it("returns both author-linked and author-less series when no authorIds filter is given", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const authorA = await createAuthor(userId, "Author A");
    const linked = await createSeries(userId, "Linked", [authorA.id]);
    const authorless = await createSeries(userId, "Unlinked", []);

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
    expect(itemIds(res.body)).toEqual(expect.arrayContaining([linked.id, authorless.id]));
  });

  it("scopes the authorIds filter to the caller and excludes another user's matching series", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const sharedAuthor = await createAuthor(owner.userId, "Shared Author");
    const strangerAuthor = await createAuthor(stranger.userId, "Stranger Author");
    const ownSeries = await createSeries(owner.userId, "Own Series", [sharedAuthor.id]);
    await createSeries(stranger.userId, "Stranger Series", [strangerAuthor.id]);

    const res = await searchSeries(owner.accessToken, `?authorIds=${sharedAuthor.id}`);

    expect(res.status).toBe(200);
    expect(itemIds(res.body)).toEqual([ownSeries.id]);
  });

  it("combines the authorIds filter with a case-insensitive name filter", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const authorA = await createAuthor(userId, "Author A");
    await createSeries(userId, "Throne of Glass", [authorA.id]);
    await createSeries(userId, "A Court of Thorns", [authorA.id]);
    await createSeries(userId, "Unrelated", []);

    const res = await searchSeries(accessToken, `?authorIds=${authorA.id}&search=throne`);

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { name: string }) => item.name)).toEqual(["Throne of Glass"]);
  });
});

describe("GET /api/series authors view shape", () => {
  it("exposes an empty authors array for an author-less series", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createSeries(userId, "No Author", []);

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0].authors).toEqual([]);
  });

  it("exposes the linked authors with id and name for a multi-author series", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const authorA = await createAuthor(userId, "Author A");
    const authorB = await createAuthor(userId, "Author B");
    await createSeries(userId, "Two Authors", [authorA.id, authorB.id]);

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    const authors = res.body.items[0].authors as { id: string; name: string }[];
    expect(authors).toHaveLength(2);
    for (const author of authors) {
      expect(author.id).toMatch(UUID);
    }
    expect(authors.map((author) => author.name).sort()).toEqual(["Author A", "Author B"]);
  });
});

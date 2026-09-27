import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule]);
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

type CreateBookInput = {
  genres?: string[];
  isFavorite?: boolean;
  ownershipStatus?: string;
  queuePosition?: null | number;
  seriesId?: null | string;
  title: string;
  userId: string;
};

async function createAuthor(userId: string, name: string): Promise<string> {
  const author = await prisma.author.create({
    data: { name, normalizedName: name.toLowerCase(), userId },
  });
  return author.id;
}

async function createBook({
  genres,
  isFavorite,
  ownershipStatus,
  queuePosition,
  seriesId,
  title,
  userId,
}: CreateBookInput): Promise<string> {
  const book = await prisma.book.create({
    data: {
      firstAuthorName: "",
      genres: genres ?? [],
      isFavorite: isFavorite ?? false,
      ownershipStatus: ownershipStatus ?? "none",
      queuePosition: queuePosition ?? null,
      readingStatus: "not_started",
      seriesId: seriesId ?? null,
      title,
      userId,
    },
  });
  return book.id;
}

async function createGenre(key: string, name: string): Promise<void> {
  await prisma.genre.create({
    data: {
      groupKey: "fiction",
      groupName: "Fiction",
      isDefault: true,
      key,
      name,
      normalizedName: name.toLowerCase(),
      userId: null,
    },
  });
}

async function createSeries(userId: string, name: string): Promise<string> {
  const series = await prisma.series.create({
    data: { name, normalizedName: name.toLowerCase(), userId },
  });
  return series.id;
}

function getFacets(accessToken: string, scope: string, q?: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/books/facets")
    .query(q === undefined ? { scope } : { q, scope })
    .set("Authorization", `Bearer ${accessToken}`);
}

async function linkAuthor(bookId: string, authorId: string): Promise<void> {
  await prisma.bookAuthor.create({ data: { authorId, bookId, position: 0 } });
}

async function trashBook(bookId: string): Promise<void> {
  await prisma.book.update({ data: TRASH_RETENTION.stamp(), where: { id: bookId } });
}

describe("GET /api/books/facets access", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/books/facets").query({ scope: "all" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for an unknown scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getFacets(accessToken, "everything");

    expect(res.status).toBe(400);
  });

  it("returns 400 when the scope is missing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await request(app.getHttpServer())
      .get("/api/books/facets")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  it("returns empty facets for a user without books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getFacets(accessToken, "all");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authors: [], genres: [] });
  });
});

describe("GET /api/books/facets counting", () => {
  it("counts the books of every author and orders them by count", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const beckett = await createAuthor(userId, "Simon Beckett");
    const gibson = await createAuthor(userId, "William Gibson");
    const first = await createBook({ title: "Whispers", userId });
    const second = await createBook({ title: "Written in bone", userId });
    const third = await createBook({ title: "Neuromancer", userId });
    await linkAuthor(first, beckett);
    await linkAuthor(second, beckett);
    await linkAuthor(third, gibson);

    const res = await getFacets(accessToken, "all");

    expect(res.body.authors).toEqual([
      { count: 2, id: beckett, name: "Simon Beckett" },
      { count: 1, id: gibson, name: "William Gibson" },
    ]);
  });

  it("counts a book once per genre it carries and resolves the genre names", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createGenre("fantasy", "Fantasy");
    await createGenre("thriller", "Thriller");
    await createBook({ genres: ["fantasy", "thriller"], title: "Dune", userId });
    await createBook({ genres: ["fantasy"], title: "Solaris", userId });

    const res = await getFacets(accessToken, "all");

    expect(res.body.genres).toEqual([
      { count: 2, key: "fantasy", name: "Fantasy" },
      { count: 1, key: "thriller", name: "Thriller" },
    ]);
  });

  it("falls back to the raw key for a genre without a catalog entry", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createBook({ genres: ["homegrown"], title: "Dune", userId });

    const res = await getFacets(accessToken, "all");

    expect(res.body.genres).toEqual([{ count: 1, key: "homegrown", name: "homegrown" }]);
  });

  it("leaves out trashed books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await createAuthor(userId, "Simon Beckett");
    const kept = await createBook({ genres: ["fantasy"], title: "Whispers", userId });
    const trashed = await createBook({ genres: ["fantasy"], title: "Chemistry", userId });
    await linkAuthor(kept, author);
    await linkAuthor(trashed, author);
    await trashBook(trashed);

    const res = await getFacets(accessToken, "all");

    expect(res.body.authors).toEqual([{ count: 1, id: author, name: "Simon Beckett" }]);
    expect(res.body.genres).toEqual([{ count: 1, key: "fantasy", name: "fantasy" }]);
  });

  it("leaves out the books of another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const foreignAuthor = await createAuthor(stranger.userId, "William Gibson");
    const foreignBook = await createBook({
      genres: ["cyberpunk"],
      title: "Neuromancer",
      userId: stranger.userId,
    });
    await linkAuthor(foreignBook, foreignAuthor);

    const res = await getFacets(owner.accessToken, "all");

    expect(res.body).toEqual({ authors: [], genres: [] });
  });
});

describe("GET /api/books/facets scopes", () => {
  it("keeps only favorites in the favorites scope", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createBook({ genres: ["fantasy"], isFavorite: true, title: "Dune", userId });
    await createBook({ genres: ["thriller"], title: "Solaris", userId });

    const res = await getFacets(accessToken, "favorites");

    expect(res.body.genres).toEqual([{ count: 1, key: "fantasy", name: "fantasy" }]);
  });

  it("keeps only physically owned books in the my scope", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createBook({ genres: ["fantasy"], ownershipStatus: "owned", title: "Dune", userId });
    await createBook({ genres: ["thriller"], ownershipStatus: "want_to_buy", title: "S", userId });

    const res = await getFacets(accessToken, "my");

    expect(res.body.genres).toEqual([{ count: 1, key: "fantasy", name: "fantasy" }]);
  });

  it("keeps only queued books in the queue scope", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createBook({ genres: ["fantasy"], queuePosition: 1, title: "Dune", userId });
    await createBook({ genres: ["thriller"], title: "Solaris", userId });

    const res = await getFacets(accessToken, "queue");

    expect(res.body.genres).toEqual([{ count: 1, key: "fantasy", name: "fantasy" }]);
  });

  it("keeps only wishlist books in the wishlist scope", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await createBook({ genres: ["fantasy"], ownershipStatus: "want_to_buy", title: "D", userId });
    await createBook({ genres: ["thriller"], ownershipStatus: "owned", title: "Solaris", userId });

    const res = await getFacets(accessToken, "wishlist");

    expect(res.body.genres).toEqual([{ count: 1, key: "fantasy", name: "fantasy" }]);
  });

  it("keeps only books that belong to a series in the series scope", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await createSeries(userId, "Dune saga");
    await createBook({ genres: ["fantasy"], seriesId, title: "Dune", userId });
    await createBook({ genres: ["thriller"], title: "Solaris", userId });

    const res = await getFacets(accessToken, "series");

    expect(res.body.genres).toEqual([{ count: 1, key: "fantasy", name: "fantasy" }]);
  });
});

describe("GET /api/books/facets author search", () => {
  it("keeps only the authors whose name matches the term", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const beckett = await createAuthor(userId, "Simon Beckett");
    const gibson = await createAuthor(userId, "William Gibson");
    const first = await createBook({ title: "Whispers", userId });
    const second = await createBook({ title: "Neuromancer", userId });
    await linkAuthor(first, beckett);
    await linkAuthor(second, gibson);

    const res = await getFacets(accessToken, "all", "beck");

    expect(res.body.authors).toEqual([{ count: 1, id: beckett, name: "Simon Beckett" }]);
  });

  it("matches regardless of case and in the middle of a name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await createAuthor(userId, "Simon Beckett");
    const book = await createBook({ title: "Whispers", userId });
    await linkAuthor(book, author);

    const res = await getFacets(accessToken, "all", "ECKET");

    expect(res.body.authors).toHaveLength(1);
  });

  it("treats the LIKE wildcards in the term as plain characters", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const literal = await createAuthor(userId, "100% Author");
    const other = await createAuthor(userId, "Simon Beckett");
    const first = await createBook({ title: "Whispers", userId });
    const second = await createBook({ title: "Neuromancer", userId });
    await linkAuthor(first, literal);
    await linkAuthor(second, other);

    const matched = await getFacets(accessToken, "all", "100%");
    const unmatched = await getFacets(accessToken, "all", "%Beck");

    expect(matched.body.authors).toEqual([{ count: 1, id: literal, name: "100% Author" }]);
    expect(unmatched.body.authors).toEqual([]);
  });

  it("leaves the genres untouched while the authors are searched", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await createAuthor(userId, "Simon Beckett");
    const book = await createBook({ genres: ["fantasy"], title: "Whispers", userId });
    await linkAuthor(book, author);

    const res = await getFacets(accessToken, "all", "zzz");

    expect(res.body.authors).toEqual([]);
    expect(res.body.genres).toEqual([{ count: 1, key: "fantasy", name: "fantasy" }]);
  });

  it("rejects an empty search term", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getFacets(accessToken, "all", "");

    expect(res.status).toBe(400);
  });
});

describe("GET /api/books/facets publisher context", () => {
  function getPublisherFacets(
    accessToken: string,
    query: { publisher: string; q?: string; scope: string },
  ): request.Test {
    return request(app.getHttpServer())
      .get("/api/books/facets")
      .query(query)
      .set("Authorization", `Bearer ${accessToken}`);
  }

  async function seedPublisherFacets(
    userId: string,
  ): Promise<{ beckett: string; gibson: string; publisherId: string }> {
    await createGenre("fantasy", "Fantasy");
    await createGenre("thriller", "Thriller");
    const publisher = await prisma.publisher.create({
      data: { name: "Penguin", normalizedName: "penguin", searchText: "penguin", userId: null },
    });
    const beckett = await createAuthor(userId, "Simon Beckett");
    const gibson = await createAuthor(userId, "William Gibson");
    const scoped = await createBook({ genres: ["thriller"], title: "Whispers", userId });
    const unscoped = await createBook({ genres: ["fantasy"], title: "Neuromancer", userId });
    await linkAuthor(scoped, beckett);
    await linkAuthor(unscoped, gibson);
    await prisma.book.update({ data: { publisherId: publisher.id }, where: { id: scoped } });
    return { beckett, gibson, publisherId: publisher.id };
  }

  it("scopes author and genre facets to the publisher", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { beckett, publisherId } = await seedPublisherFacets(userId);

    const res = await request(app.getHttpServer())
      .get("/api/books/facets")
      .query({ publisher: publisherId, scope: "all" })
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      authors: [{ count: 1, id: beckett, name: "Simon Beckett" }],
      genres: [{ count: 1, key: "thriller", name: "Thriller" }],
    });
  });

  it("keeps every author and genre when publisher is omitted", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { beckett, gibson } = await seedPublisherFacets(userId);

    const res = await getFacets(accessToken, "all");

    expect(res.body).toEqual({
      authors: [
        { count: 1, id: beckett, name: "Simon Beckett" },
        { count: 1, id: gibson, name: "William Gibson" },
      ],
      genres: [
        { count: 1, key: "fantasy", name: "Fantasy" },
        { count: 1, key: "thriller", name: "Thriller" },
      ],
    });
  });

  it("applies the scope condition together with the publisher", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { beckett, publisherId } = await seedPublisherFacets(userId);
    const plain = await createAuthor(userId, "Plain Author");
    const unfavored = await createBook({ genres: ["fantasy"], title: "Unfavored", userId });
    await linkAuthor(unfavored, plain);
    await prisma.book.update({ data: { publisherId }, where: { id: unfavored } });
    await prisma.book.updateMany({
      data: { isFavorite: true },
      where: { title: { in: ["Whispers", "Neuromancer"] }, userId },
    });

    const res = await getPublisherFacets(accessToken, {
      publisher: publisherId,
      scope: "favorites",
    });

    expect(res.body).toEqual({
      authors: [{ count: 1, id: beckett, name: "Simon Beckett" }],
      genres: [{ count: 1, key: "thriller", name: "Thriller" }],
    });
  });

  it("applies the author search together with the publisher", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const { beckett, publisherId } = await seedPublisherFacets(userId);

    const outside = await getPublisherFacets(accessToken, {
      publisher: publisherId,
      q: "Gibson",
      scope: "all",
    });
    const inside = await getPublisherFacets(accessToken, {
      publisher: publisherId,
      q: "Beck",
      scope: "all",
    });

    expect(outside.body.authors).toEqual([]);
    expect(inside.body.authors).toEqual([{ count: 1, id: beckett, name: "Simon Beckett" }]);
  });

  it("returns 400 when publisher is not a uuid", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getPublisherFacets(accessToken, { publisher: "not-a-uuid", scope: "all" });

    expect(res.status).toBe(400);
  });
});

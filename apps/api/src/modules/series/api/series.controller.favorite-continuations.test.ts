import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { SeriesModule } from "../series.module.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

type SeedBook = {
  authorName?: string;
  currentPage?: number;
  favoriteAddedAt?: Date;
  isFavorite?: boolean;
  ownershipStatus?: string;
  pagesCount?: number;
  partNumber: null | number;
  queuePosition?: number;
  queuePriority?: string;
  readingStatus?: string;
  title: string;
};

type SeedSeries = {
  books: SeedBook[];
  name: string;
  status?: string;
  totalBooks?: number;
  userId: string;
};

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

function getContinuations(accessToken: string, limit?: number): request.Test {
  const path =
    limit === undefined
      ? "/api/series/favorite-continuations"
      : `/api/series/favorite-continuations?limit=${limit}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

async function seedSeries({
  books,
  name,
  status = "ongoing",
  totalBooks,
  userId,
}: SeedSeries): Promise<string> {
  const series = await prisma.series.create({
    data: {
      name,
      normalizedName: name.toLowerCase(),
      status,
      totalBooks: totalBooks ?? null,
      userId,
    },
  });

  for (const book of books) {
    const created = await prisma.book.create({
      data: {
        favoriteAddedAt: book.favoriteAddedAt ?? null,
        isFavorite: book.isFavorite ?? false,
        ownershipStatus: book.ownershipStatus ?? "none",
        pagesCount: book.pagesCount ?? null,
        partNumber: book.partNumber,
        queuePosition: book.queuePosition ?? null,
        queuePriority: book.queuePriority ?? null,
        readingStatus: book.readingStatus ?? "not_started",
        seriesId: series.id,
        title: book.title,
        userId,
      },
    });

    if (book.authorName !== undefined) {
      const author = await prisma.author.create({
        data: { name: book.authorName, normalizedName: book.authorName.toLowerCase(), userId },
      });
      await prisma.bookAuthor.create({
        data: { authorId: author.id, bookId: created.id, position: 0 },
      });
    }

    if (book.currentPage !== undefined) {
      await prisma.bookReadingProgress.create({
        data: { bookId: created.id, currentPage: book.currentPage },
      });
    }
  }

  return series.id;
}

describe("GET /api/series/favorite-continuations auth and routing", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/series/favorite-continuations");

    expect(res.status).toBe(401);
  });

  it("resolves the static route ahead of the :id route", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getContinuations(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], nextCursor: null, total: 0 });
  });
});

describe("GET /api/series/favorite-continuations selection", () => {
  it("excludes a solo book that belongs to no series", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.book.create({
      data: { isFavorite: true, readingStatus: "not_started", title: "Solo", userId },
    });

    const res = await getContinuations(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it("excludes a single-book series", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [{ isFavorite: true, partNumber: 1, readingStatus: "not_started", title: "Only" }],
      name: "Solo Series",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.total).toBe(0);
  });

  it("excludes a series with no favorite books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "not_started", title: "One" },
        { partNumber: 2, readingStatus: "not_started", title: "Two" },
      ],
      name: "No Favorites",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.total).toBe(0);
  });

  it("includes a qualifying series and returns its next book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "not_started", title: "First" },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Second" },
      ],
      name: "Qualifying",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].series.id).toBe(seriesId);
    expect(res.body.items[0].nextBook.title).toBe("First");
  });
});

describe("GET /api/series/favorite-continuations next-book examples", () => {
  it("returns the earlier unread book over a later favorite", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "finished", title: "One" },
        { partNumber: 2, readingStatus: "not_started", title: "Two" },
        { isFavorite: true, partNumber: 3, readingStatus: "finished", title: "Three" },
        { partNumber: 4, readingStatus: "not_started", title: "Four" },
      ],
      name: "Above the Sky",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.items[0].nextBook.seriesPosition).toBe(2);
  });

  it("skips a dnf book when choosing the next book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "finished", title: "One" },
        { partNumber: 2, readingStatus: "dnf", title: "Two" },
        { partNumber: 3, readingStatus: "not_started", title: "Three" },
        { isFavorite: true, partNumber: 4, readingStatus: "finished", title: "Four" },
      ],
      name: "Skip Dnf",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.items[0].nextBook.seriesPosition).toBe(3);
  });

  it("excludes a series when every book is closed", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { isFavorite: true, partNumber: 1, readingStatus: "finished", title: "One" },
        { partNumber: 2, readingStatus: "finished", title: "Two" },
        { partNumber: 3, readingStatus: "dnf", title: "Three" },
      ],
      name: "All Closed",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.total).toBe(0);
  });

  it("returns one item with the favorite count for multiple favorites", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { isFavorite: true, partNumber: 1, readingStatus: "finished", title: "One" },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Two" },
        { partNumber: 3, readingStatus: "not_started", title: "Three" },
      ],
      name: "Two Favorites",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].favoriteBooksCount).toBe(2);
    expect(res.body.items[0].nextBook.seriesPosition).toBe(3);
  });

  it("ranks an actively reading next book as reading", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "finished", title: "One" },
        { partNumber: 2, readingStatus: "reading", title: "Two" },
        { isFavorite: true, partNumber: 3, readingStatus: "finished", title: "Three" },
      ],
      name: "Active Reading",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.items[0].nextBook.seriesPosition).toBe(2);
    expect(res.body.items[0].rankReason).toBe("reading");
  });

  it("ranks a paused next book as paused", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "finished", title: "One" },
        { partNumber: 2, readingStatus: "paused", title: "Two" },
        { isFavorite: true, partNumber: 3, readingStatus: "finished", title: "Three" },
      ],
      name: "Paused Read",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.items[0].nextBook.seriesPosition).toBe(2);
    expect(res.body.items[0].rankReason).toBe("paused");
  });
});

describe("GET /api/series/favorite-continuations user isolation", () => {
  it("does not return another user's favorite series", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "not_started", title: "One" },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Two" },
      ],
      name: "Stranger Series",
      userId: stranger.userId,
    });

    const res = await getContinuations(owner.accessToken);

    expect(res.body.total).toBe(0);
  });

  it("returns only the caller's series when both users qualify", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const ownerSeriesId = await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "not_started", title: "Owner One" },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Owner Two" },
      ],
      name: "Owner Series",
      userId: owner.userId,
    });
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "not_started", title: "Stranger One" },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Stranger Two" },
      ],
      name: "Stranger Series",
      userId: stranger.userId,
    });

    const res = await getContinuations(owner.accessToken);

    expect(res.body.total).toBe(1);
    expect(res.body.items.map((item: { series: { id: string } }) => item.series.id)).toEqual([
      ownerSeriesId,
    ]);
  });
});

describe("GET /api/series/favorite-continuations contract", () => {
  it("returns the documented top-level shape", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "not_started", title: "One" },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Two" },
      ],
      name: "Shape",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body).toMatchObject({ nextCursor: null, total: 1 });
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("exposes the next book identity and series metadata", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const seriesId = await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "not_started", title: "Next Up" },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Done" },
      ],
      name: "Metadata Series",
      status: "ongoing",
      totalBooks: 5,
      userId,
    });

    const res = await getContinuations(accessToken);

    const item = res.body.items[0];
    expect(item.series).toMatchObject({
      id: seriesId,
      status: "ongoing",
      title: "Metadata Series",
      totalBooks: 5,
    });
    expect(item.nextBook.id).toMatch(UUID_PATTERN);
    expect(item.nextBook.title).toBe("Next Up");
    expect(item.nextBook.seriesPosition).toBe(1);
    expect(item.nextBook.ownershipStatus).toBe("none");
    expect(item.nextBook.readingStatus).toBe("not_started");
  });

  it("returns queue metadata when the next book is queued", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        {
          ownershipStatus: "owned",
          partNumber: 1,
          queuePosition: 4,
          queuePriority: "high",
          readingStatus: "not_started",
          title: "Queued",
        },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Done" },
      ],
      name: "Queued Series",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.items[0].nextBook.queue).toEqual({ position: 4, priority: "high" });
  });

  it("returns a null queue when the next book is not queued", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        {
          ownershipStatus: "owned",
          partNumber: 1,
          readingStatus: "not_started",
          title: "Unqueued",
        },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Done" },
      ],
      name: "Unqueued Series",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.items[0].nextBook.queue).toBeNull();
  });

  it("returns reading progress with a percentage for a book in progress", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        {
          currentPage: 126,
          pagesCount: 368,
          partNumber: 1,
          readingStatus: "reading",
          title: "In Progress",
        },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Done" },
      ],
      name: "Progress Series",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.items[0].nextBook.readingProgress).toEqual({
      currentPage: 126,
      percentage: 34,
      totalPages: 368,
    });
  });

  it("returns null reading progress when no current page is recorded", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "not_started", title: "No Progress" },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Done" },
      ],
      name: "No Progress Series",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.items[0].nextBook.readingProgress).toBeNull();
  });

  it("returns a null cover when the book has no cover media", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "not_started", title: "No Cover" },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Done" },
      ],
      name: "No Cover Series",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.items[0].nextBook.cover).toBeNull();
  });

  it("returns the next book authors as id and name pairs", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        {
          authorName: "Jane Author",
          partNumber: 1,
          readingStatus: "not_started",
          title: "Authored",
        },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Done" },
      ],
      name: "Authored Series",
      userId,
    });

    const res = await getContinuations(accessToken);

    const authors = res.body.items[0].nextBook.authors;
    expect(authors).toHaveLength(1);
    expect(authors[0].name).toBe("Jane Author");
    expect(authors[0].id).toMatch(UUID_PATTERN);
  });

  it("returns an empty authors array when the book has no authors", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "not_started", title: "No Author" },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Done" },
      ],
      name: "No Author Series",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.items[0].nextBook.authors).toEqual([]);
  });

  it("counts finished and closed books without treating dnf as finished", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "finished", title: "One" },
        { partNumber: 2, readingStatus: "dnf", title: "Two" },
        { isFavorite: true, partNumber: 3, readingStatus: "not_started", title: "Three" },
      ],
      name: "Progress Counts",
      userId,
    });

    const res = await getContinuations(accessToken);

    expect(res.body.items[0].progress).toEqual({ closedBooks: 2, finishedBooks: 1, totalBooks: 3 });
  });

  it("caps items by the limit while reporting the full total", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "reading", title: "Read One" },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Done One" },
      ],
      name: "First Series",
      userId,
    });
    await seedSeries({
      books: [
        { partNumber: 1, readingStatus: "paused", title: "Read Two" },
        { isFavorite: true, partNumber: 2, readingStatus: "finished", title: "Done Two" },
      ],
      name: "Second Series",
      userId,
    });

    const res = await getContinuations(accessToken, 1);

    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(1);
  });

  it("rejects a limit of 0 with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getContinuations(accessToken, 0);

    expect(res.status).toBe(400);
  });

  it("rejects a limit above the maximum with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getContinuations(accessToken, 51);

    expect(res.status).toBe(400);
  });
});

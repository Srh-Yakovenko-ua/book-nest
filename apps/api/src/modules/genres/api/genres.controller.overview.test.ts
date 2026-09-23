import type { GenresOverviewView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { subDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { addDaysToIsoDate, parseIsoDate, toIsoDate } from "../../../core/iso-date.js";
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

function daysAgo(days: number): Date {
  return parseIsoDate(addDaysToIsoDate(toIsoDate(new Date()), -days));
}

function getOverview(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/genres/overview")
    .set("Authorization", `Bearer ${accessToken}`);
}

function seedBook(input: {
  createdAt?: Date;
  finishedAt?: Date;
  genres: string[];
  lastProgressUpdateAt?: Date;
  rating?: number;
  readingStatus?: string;
  userId: string;
}): Promise<{ id: string }> {
  const hasProgress =
    input.finishedAt !== undefined ||
    input.lastProgressUpdateAt !== undefined ||
    input.rating !== undefined;
  return prisma.book.create({
    data: {
      createdAt: input.createdAt ?? daysAgo(400),
      genres: input.genres,
      readingProgress: hasProgress
        ? {
            create: {
              finishedAt: input.finishedAt,
              lastProgressUpdateAt: input.lastProgressUpdateAt,
              rating: input.rating,
            },
          }
        : undefined,
      readingStatus: input.readingStatus ?? "not_started",
      title: "Untitled",
      userId: input.userId,
    },
    select: { id: true },
  });
}

function seedGenre(key: string, name: string): Promise<unknown> {
  return prisma.genre.create({
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

describe("GET /api/genres/overview", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/genres/overview");

    expect(res.status).toBe(401);
  });

  it("returns three empty blocks for an empty library", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getOverview(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      dormantGenres: [],
      newForYouGenres: [],
      unratedFinishedGenres: [],
    } satisfies GenresOverviewView);
  });

  it("surfaces a dormant genre from progress history and hides one active through a cycle", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre("fantasy", "Фентезі");
    await seedGenre("romance", "Романтика");
    await seedBook({
      finishedAt: daysAgo(200),
      genres: ["fantasy"],
      rating: 8,
      readingStatus: "finished",
      userId,
    });
    await seedBook({ genres: ["fantasy"], userId });
    const romanceFinished = await seedBook({
      finishedAt: daysAgo(240),
      genres: ["romance"],
      rating: 9,
      readingStatus: "finished",
      userId,
    });
    await seedBook({ genres: ["romance"], userId });
    await prisma.bookReadingCycle.create({
      data: {
        bookId: romanceFinished.id,
        startedAt: daysAgo(1),
        state: "active",
        userId,
      },
    });

    const res = await getOverview(accessToken);

    expect(res.body.dormantGenres).toEqual([
      {
        booksCount: 2,
        key: "fantasy",
        label: "Фентезі",
        lastReadingActivityAt: daysAgo(200).toISOString(),
        readCount: 1,
      },
    ]);
  });

  it("offers a recently added never-started genre and hides one with reading experience", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre("space-opera", "Космічна опера");
    await seedGenre("mystery", "Містика");
    const addedAt = subDays(new Date(), 5);
    await seedBook({ createdAt: addedAt, genres: ["space-opera", "mystery"], userId });
    await seedBook({
      createdAt: addedAt,
      genres: ["mystery"],
      lastProgressUpdateAt: daysAgo(2),
      readingStatus: "reading",
      userId,
    });

    const res = await getOverview(accessToken);

    expect(res.body.newForYouGenres).toEqual([
      {
        booksCount: 1,
        firstAddedAt: addedAt.toISOString(),
        key: "space-opera",
        label: "Космічна опера",
      },
    ]);
  });

  it("does not treat an old genre as new because a book was added today", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre("fantasy", "Фентезі");
    await seedBook({ createdAt: daysAgo(300), genres: ["fantasy"], userId });
    await seedBook({ createdAt: new Date(), genres: ["fantasy"], userId });

    const res = await getOverview(accessToken);

    expect(res.body.newForYouGenres).toEqual([]);
  });

  it("counts finished books without a rating per genre", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre("thriller", "Трилер");
    await seedGenre("mystery", "Містика");
    await seedBook({
      finishedAt: daysAgo(3),
      genres: ["thriller", "mystery"],
      readingStatus: "finished",
      userId,
    });
    await seedBook({ genres: ["thriller"], readingStatus: "finished", userId });
    await seedBook({
      finishedAt: daysAgo(1),
      genres: ["mystery"],
      rating: 7,
      readingStatus: "finished",
      userId,
    });
    await seedBook({ genres: ["mystery"], readingStatus: "dnf", userId });

    const res = await getOverview(accessToken);

    expect(res.body.unratedFinishedGenres).toEqual([
      {
        key: "thriller",
        label: "Трилер",
        latestUnratedFinishedAt: daysAgo(3).toISOString(),
        unratedFinishedCount: 2,
      },
      {
        key: "mystery",
        label: "Містика",
        latestUnratedFinishedAt: daysAgo(3).toISOString(),
        unratedFinishedCount: 1,
      },
    ]);
  });

  it("ignores another user's books and reading history", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    await seedGenre("fantasy", "Фентезі");
    await seedGenre("romance", "Романтика");
    const addedAt = subDays(new Date(), 5);
    await seedBook({ createdAt: addedAt, genres: ["fantasy"], userId: owner.userId });
    await seedBook({
      createdAt: daysAgo(300),
      finishedAt: daysAgo(10),
      genres: ["fantasy"],
      lastProgressUpdateAt: daysAgo(10),
      readingStatus: "finished",
      userId: stranger.userId,
    });
    await seedBook({ createdAt: addedAt, genres: ["romance"], userId: stranger.userId });
    await seedBook({
      finishedAt: daysAgo(200),
      genres: ["romance"],
      readingStatus: "finished",
      userId: stranger.userId,
    });

    const res = await getOverview(owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      dormantGenres: [],
      newForYouGenres: [
        { booksCount: 1, firstAddedAt: addedAt.toISOString(), key: "fantasy", label: "Фентезі" },
      ],
      unratedFinishedGenres: [],
    } satisfies GenresOverviewView);
  });
});

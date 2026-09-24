import type { GenreSummaryView } from "@app/shared";
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

function getSummary(accessToken: string, query = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/genres/summary${query === "" ? "" : `?${query}`}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function seedBook(input: {
  genres: string[];
  ownershipStatus?: string;
  queuePosition?: number;
  rating?: number;
  readingStatus?: string;
  userId: string;
}): Promise<unknown> {
  return prisma.book.create({
    data: {
      genres: input.genres,
      ownershipStatus: input.ownershipStatus ?? "none",
      queuePosition: input.queuePosition,
      readingProgress:
        input.rating === undefined ? undefined : { create: { rating: input.rating } },
      readingStatus: input.readingStatus ?? "not_started",
      title: "Untitled",
      userId: input.userId,
    },
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

describe("GET /api/genres/summary", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/genres/summary");

    expect(res.status).toBe(401);
  });

  it("returns zero counts and no leaders for an empty library", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      booksWithGenresCount: 0,
      finishedBooksCount: 0,
      finishedBooksWithGenresCount: 0,
      highestRated: null,
      libraryBooksCount: 0,
      mostFrequent: null,
      mostQueued: null,
      mostRead: null,
      mostWantedToBuy: null,
      queuedBooksCount: 0,
      queuedBooksWithGenresCount: 0,
      ratedBooksCount: 0,
      ratedBooksWithGenresCount: 0,
      usedGenresCount: 0,
      wantToBuyBooksCount: 0,
      wantToBuyBooksWithGenresCount: 0,
    } satisfies GenreSummaryView);
  });

  it("separates qualifying books with and without valid system genres", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre("fantasy", "Фентезі");
    await seedBook({ genres: [], rating: 7, readingStatus: "finished", userId });
    await seedBook({ genres: ["legacy-custom"], queuePosition: 1, userId });
    await seedBook({ genres: ["fantasy"], ownershipStatus: "want_to_buy", userId });

    const res = await getSummary(accessToken);

    expect(res.body).toMatchObject({
      booksWithGenresCount: 1,
      finishedBooksCount: 1,
      finishedBooksWithGenresCount: 0,
      libraryBooksCount: 3,
      queuedBooksCount: 1,
      queuedBooksWithGenresCount: 0,
      ratedBooksCount: 1,
      ratedBooksWithGenresCount: 0,
      usedGenresCount: 1,
      wantToBuyBooksCount: 1,
      wantToBuyBooksWithGenresCount: 1,
    });
    expect(res.body.mostFrequent.leaders.map((genre: { key: string }) => genre.key)).toEqual([
      "fantasy",
    ]);
    expect(res.body.mostRead).toBeNull();
    expect(res.body.mostWantedToBuy.leadersCount).toBe(1);
  });

  it("counts a multi-genre book once and ties leaders deterministically", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre("fantasy", "Фентезі");
    await seedGenre("romance", "Романтика");
    await seedGenre("horror", "Жахи");
    await seedBook({ genres: ["fantasy", "romance", "horror"], readingStatus: "finished", userId });
    await seedBook({ genres: ["fantasy", "romance", "horror"], userId });

    const res = await getSummary(accessToken);

    expect(res.body.booksWithGenresCount).toBe(2);
    expect(res.body.usedGenresCount).toBe(3);
    expect(res.body.mostFrequent.leadersCount).toBe(3);
    expect(res.body.mostFrequent.leaders.map((genre: { key: string }) => genre.key)).toEqual([
      "horror",
      "romance",
    ]);
    expect(res.body.mostRead.leaders[0]).toEqual({
      averageRating: null,
      booksCount: 2,
      key: "horror",
      label: "Жахи",
      ratedBooksCount: 0,
      readCount: 1,
      readingQueueCount: 0,
      wantToBuyCount: 0,
    });
  });

  it("requires three rated books for the highest-rated genre", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre("fantasy", "Фентезі");
    await seedGenre("romance", "Романтика");
    await seedBook({ genres: ["fantasy"], rating: 10, userId });
    await seedBook({ genres: ["romance"], rating: 7, userId });
    await seedBook({ genres: ["romance"], rating: 8, userId });
    await seedBook({ genres: ["romance"], rating: 9, userId });

    const res = await getSummary(accessToken);

    expect(res.body.highestRated).toEqual({
      leaders: [expect.objectContaining({ averageRating: 8, key: "romance", ratedBooksCount: 3 })],
      leadersCount: 1,
    });
  });

  it("does not change with list parameters", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre("fantasy", "Фентезі");
    await seedBook({ genres: ["fantasy"], userId });

    const plain = await getSummary(accessToken);
    const withParams = await getSummary(accessToken, "q=zzz&filter=finished&sort=name_asc");

    expect(withParams.status).toBe(200);
    expect(withParams.body).toEqual(plain.body);
  });

  it("ignores another user's books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    await seedGenre("fantasy", "Фентезі");
    await seedGenre("romance", "Романтика");
    await seedBook({ genres: ["fantasy"], userId: owner.userId });
    await seedBook({
      genres: ["romance"],
      rating: 9,
      readingStatus: "finished",
      userId: stranger.userId,
    });
    await seedBook({ genres: ["romance"], queuePosition: 1, userId: stranger.userId });
    await seedBook({
      genres: ["fantasy"],
      ownershipStatus: "want_to_buy",
      userId: stranger.userId,
    });

    const res = await getSummary(owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      booksWithGenresCount: 1,
      finishedBooksCount: 0,
      highestRated: null,
      libraryBooksCount: 1,
      mostQueued: null,
      mostRead: null,
      mostWantedToBuy: null,
      queuedBooksCount: 0,
      ratedBooksCount: 0,
      usedGenresCount: 1,
      wantToBuyBooksCount: 0,
    });
    expect(res.body.mostFrequent.leaders).toEqual([
      expect.objectContaining({ booksCount: 1, key: "fantasy" }),
    ]);
  });
});

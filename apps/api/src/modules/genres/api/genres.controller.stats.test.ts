import type { GenreStatsView } from "@app/shared";
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

function getStats(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/genres/stats")
    .set("Authorization", `Bearer ${accessToken}`);
}

function seedBook(input: {
  genres: string[];
  ownershipStatus?: string;
  queuePosition?: number;
  rating?: number;
  readingStatus?: string;
  userId: string;
}): Promise<{ id: string }> {
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
    select: { id: true },
  });
}

function seedGenre(input: { key: string; name: string }): Promise<{ key: string }> {
  return prisma.genre.create({
    data: {
      groupKey: "fiction",
      groupName: "Fiction",
      isDefault: true,
      key: input.key,
      name: input.name,
      normalizedName: input.name.toLowerCase(),
      userId: null,
    },
    select: { key: true },
  });
}

describe("GET /api/genres/stats", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/genres/stats");

    expect(res.status).toBe(401);
  });

  it("returns an empty array when the user has no books with genres", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getStats(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("aggregates counts, average rating and label per genre, ordered by book count", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "fantasy", name: "Фентезі" });
    await seedGenre({ key: "romance", name: "Романтика" });
    await seedBook({
      genres: ["fantasy"],
      ownershipStatus: "owned",
      rating: 4,
      readingStatus: "finished",
      userId,
    });
    await seedBook({
      genres: ["fantasy", "romance"],
      ownershipStatus: "want_to_buy",
      queuePosition: 1,
      rating: 5,
      readingStatus: "reading",
      userId,
    });
    await seedBook({ genres: ["fantasy"], userId });

    const res = await getStats(accessToken);

    expect(res.status).toBe(200);
    const body = res.body as GenreStatsView[];
    expect(body.map((entry) => entry.key)).toEqual(["fantasy", "romance"]);

    const fantasy = body.find((entry) => entry.key === "fantasy");
    expect(fantasy).toEqual({
      averageRating: 4.5,
      booksCount: 3,
      coverUrls: [],
      key: "fantasy",
      label: "Фентезі",
      readCount: 1,
      readingQueueCount: 1,
      wantToBuyCount: 1,
    });

    const romance = body.find((entry) => entry.key === "romance");
    expect(romance).toMatchObject({
      averageRating: 5,
      booksCount: 1,
      label: "Романтика",
      readCount: 0,
      readingQueueCount: 1,
      wantToBuyCount: 1,
    });
  });

  it("falls back to the genre key when no catalog label exists", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedBook({ genres: ["mystery"], userId });

    const res = await getStats(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        averageRating: null,
        booksCount: 1,
        coverUrls: [],
        key: "mystery",
        label: "mystery",
        readCount: 0,
        readingQueueCount: 0,
        wantToBuyCount: 0,
      },
    ]);
  });

  it("does not count another user's books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedBook({ genres: ["fantasy"], userId: stranger.userId });

    const res = await getStats(owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

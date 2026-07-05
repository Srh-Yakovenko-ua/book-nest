import type { GenreView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { GenresModule } from "../genres.module.js";

const GENRE_VIEW_KEYS = ["groupKey", "groupName", "id", "isDefault", "key", "name"];

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

function getRecent(accessToken: string, query?: string): request.Test {
  const path = query === undefined ? "/api/genres/recent" : `/api/genres/recent?${query}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

function recentKeys(body: GenreView[]): string[] {
  return body.map((genre) => genre.key);
}

function seedBook(input: {
  createdAt?: Date;
  genres: string[];
  userId: string;
}): Promise<{ id: string }> {
  return prisma.book.create({
    data: {
      createdAt: input.createdAt,
      genres: input.genres,
      title: "Untitled",
      userId: input.userId,
    },
    select: { id: true },
  });
}

function seedGenre(input: {
  groupKey?: string;
  groupName?: string;
  isDefault?: boolean;
  key: string;
  name: string;
  userId?: null | string;
}): Promise<{ key: string }> {
  return prisma.genre.create({
    data: {
      groupKey: input.groupKey ?? "fiction",
      groupName: input.groupName ?? "Fiction",
      isDefault: input.isDefault ?? true,
      key: input.key,
      name: input.name,
      normalizedName: input.name.toLowerCase(),
      userId: input.userId ?? null,
    },
    select: { key: true },
  });
}

describe("GET /api/genres/recent", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/genres/recent");

    expect(res.status).toBe(401);
  });

  it("returns 401 when the access token is invalid", async () => {
    const res = await getRecent("not-a-real-token");

    expect(res.status).toBe(401);
  });

  it("returns an empty array when the user has no books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "fantasy", name: "Fantasy" });

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns each used genre as the GenreView shape", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "fantasy", name: "Fantasy" });
    await seedBook({ genres: ["fantasy"], userId });

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(Object.keys(res.body[0]).sort()).toEqual(GENRE_VIEW_KEYS);
  });

  it("orders genres so the most recently created book's genres rank first", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "history", name: "History" });
    await seedGenre({ key: "sci-fi", name: "Science Fiction" });
    await seedGenre({ key: "fantasy", name: "Fantasy" });
    await seedBook({
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      genres: ["history"],
      userId,
    });
    await seedBook({
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      genres: ["sci-fi"],
      userId,
    });
    await seedBook({
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      genres: ["fantasy"],
      userId,
    });

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(recentKeys(res.body)).toEqual(["fantasy", "sci-fi", "history"]);
  });

  it("returns a repeatedly used genre once, ranked by its most recent use", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "fantasy", name: "Fantasy" });
    await seedGenre({ key: "history", name: "History" });
    await seedBook({
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      genres: ["fantasy"],
      userId,
    });
    await seedBook({
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      genres: ["history"],
      userId,
    });
    await seedBook({
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      genres: ["fantasy"],
      userId,
    });

    const res = await getRecent(accessToken);

    expect(recentKeys(res.body)).toEqual(["fantasy", "history"]);
    expect(recentKeys(res.body).filter((key) => key === "fantasy")).toHaveLength(1);
  });

  it("defaults the limit to 8 recent genres when none is supplied", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    for (let index = 0; index < 9; index += 1) {
      const key = `genre-${index}`;
      await seedGenre({ key, name: `Genre ${index}` });
      await seedBook({
        createdAt: new Date(`2026-01-0${index + 1}T10:00:00.000Z`),
        genres: [key],
        userId,
      });
    }

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(8);
  });

  it("caps the number of returned genres to the requested limit", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    for (let index = 0; index < 5; index += 1) {
      const key = `genre-${index}`;
      await seedGenre({ key, name: `Genre ${index}` });
      await seedBook({
        createdAt: new Date(`2026-01-0${index + 1}T10:00:00.000Z`),
        genres: [key],
        userId,
      });
    }

    const res = await getRecent(accessToken, "limit=3");

    expect(res.status).toBe(200);
    expect(recentKeys(res.body)).toEqual(["genre-4", "genre-3", "genre-2"]);
  });

  it("rejects a limit above the allowed maximum with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getRecent(accessToken, "limit=21");

    expect(res.status).toBe(400);
  });

  it("rejects a limit below the allowed minimum with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getRecent(accessToken, "limit=0");

    expect(res.status).toBe(400);
  });

  it("does not return genres used only in another user's books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedGenre({ key: "fantasy", name: "Fantasy" });
    await seedGenre({ key: "sci-fi", name: "Science Fiction" });
    await seedBook({ genres: ["fantasy"], userId: owner.userId });
    await seedBook({ genres: ["sci-fi"], userId: stranger.userId });

    const res = await getRecent(owner.accessToken);

    expect(recentKeys(res.body)).toEqual(["fantasy"]);
    expect(recentKeys(res.body)).not.toContain("sci-fi");
  });

  it("silently skips a genre key that has no catalog row", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "fantasy", name: "Fantasy" });
    await seedBook({
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      genres: ["fantasy", "ghost-genre"],
      userId,
    });

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(recentKeys(res.body)).toEqual(["fantasy"]);
  });

  it("silently skips a genre key owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedGenre({ key: "fantasy", name: "Fantasy" });
    await seedGenre({
      groupKey: "custom",
      groupName: "Custom",
      isDefault: false,
      key: "stranger-secret",
      name: "Stranger Secret",
      userId: stranger.userId,
    });
    await seedBook({
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      genres: ["fantasy", "stranger-secret"],
      userId: owner.userId,
    });

    const res = await getRecent(owner.accessToken);

    expect(res.status).toBe(200);
    expect(recentKeys(res.body)).toEqual(["fantasy"]);
  });

  it("includes a custom genre the user owns and used in a book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({
      groupKey: "custom",
      groupName: "Custom",
      isDefault: false,
      key: "comfort-reads",
      name: "Comfort Reads",
      userId,
    });
    await seedBook({ genres: ["comfort-reads"], userId });

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(recentKeys(res.body)).toEqual(["comfort-reads"]);
    expect(res.body[0].isDefault).toBe(false);
  });
});

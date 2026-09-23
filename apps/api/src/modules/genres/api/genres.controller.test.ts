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

const GENRE_VIEW_KEYS = ["groupKey", "groupName", "id", "isDefault", "key", "name"];

function authed(method: "delete" | "get" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

function seedSystemGenre(key: string, name: string): Promise<unknown> {
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

describe("GET /api/genres", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/genres");

    expect(res.status).toBe(401);
  });

  it("returns only the predefined system catalog as GenreView shape", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.genre.createMany({
      data: [
        {
          groupKey: "fiction",
          groupName: "Fiction",
          isDefault: true,
          key: "fantasy",
          name: "Fantasy",
          normalizedName: "fantasy",
          userId: null,
        },
        {
          groupKey: "fiction",
          groupName: "Fiction",
          isDefault: true,
          key: "sci-fi",
          name: "Science Fiction",
          normalizedName: "science fiction",
          userId: null,
        },
        {
          groupKey: "personal",
          groupName: "Personal",
          isDefault: false,
          key: "comfort-reads",
          name: "Comfort Reads",
          normalizedName: "comfort reads",
          userId,
        },
      ],
    });

    const res = await authed("get", "/api/genres", accessToken);

    expect(res.status).toBe(200);
    const names = res.body.map((genre: { name: string }) => genre.name).sort();
    expect(names).toEqual(["Fantasy", "Science Fiction"]);
    for (const genre of res.body) {
      expect(Object.keys(genre).sort()).toEqual(GENRE_VIEW_KEYS);
    }
  });

  it("returns the same catalog regardless of genre rows owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedSystemGenre("fantasy", "Fantasy");
    await prisma.genre.create({
      data: {
        groupKey: "personal",
        groupName: "Personal",
        isDefault: false,
        key: "stranger-secret",
        name: "Stranger Secret",
        normalizedName: "stranger secret",
        userId: stranger.userId,
      },
    });

    const ownerRes = await authed("get", "/api/genres", owner.accessToken);
    const strangerRes = await authed("get", "/api/genres", stranger.accessToken);

    const ownerKeys = ownerRes.body.map((genre: { key: string }) => genre.key);
    expect(ownerKeys).toEqual(["fantasy"]);
    expect(strangerRes.body).toEqual(ownerRes.body);
  });

  it("orders by groupKey asc, then sortOrder asc, then name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await prisma.genre.createMany({
      data: [
        {
          groupKey: "nonfiction",
          groupName: "Nonfiction",
          isDefault: true,
          key: "history",
          name: "History",
          normalizedName: "history",
          sortOrder: 1,
          userId: null,
        },
        {
          groupKey: "fiction",
          groupName: "Fiction",
          isDefault: true,
          key: "fantasy",
          name: "Fantasy",
          normalizedName: "fantasy",
          sortOrder: 2,
          userId: null,
        },
        {
          groupKey: "fiction",
          groupName: "Fiction",
          isDefault: true,
          key: "sci-fi",
          name: "Science Fiction",
          normalizedName: "science fiction",
          sortOrder: 1,
          userId: null,
        },
      ],
    });

    const res = await authed("get", "/api/genres", accessToken);

    const keys = res.body.map((genre: { key: string }) => genre.key);
    expect(keys).toEqual(["sci-fi", "fantasy", "history"]);
  });
});

describe("removed custom-genre mutations", () => {
  it("no longer exposes POST /api/genres", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("post", "/api/genres", accessToken).send({ name: "Мій жанр" });

    expect(res.status).toBe(404);
    expect(await prisma.genre.count()).toBe(0);
  });

  it("no longer exposes DELETE /api/genres/:id and leaves the system genre intact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedSystemGenre("fentezi", "Фентезі");
    const seeded = await prisma.genre.findFirstOrThrow({ where: { key: "fentezi" } });

    const res = await authed("delete", `/api/genres/${seeded.id}`, accessToken);

    expect(res.status).toBe(404);
    expect(await prisma.genre.count({ where: { key: "fentezi" } })).toBe(1);
  });
});

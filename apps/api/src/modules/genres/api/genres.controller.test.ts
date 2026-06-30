import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { GenresModule } from "../genres.module.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, GenresModule, BooksModule, ListsModule]);
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

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function createGenre(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/genres")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function deleteGenre(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .delete(`/api/genres/${id}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function getBook(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books/${id}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function listGenres(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/genres")
    .set("Authorization", `Bearer ${accessToken}`);
}

function seedDefaultGenre(key: string, name: string): Promise<unknown> {
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

  it("returns global defaults and the caller's own custom genres as GenreView shape", async () => {
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

    const res = await listGenres(accessToken);

    expect(res.status).toBe(200);
    const names = res.body.map((genre: { name: string }) => genre.name).sort();
    expect(names).toEqual(["Comfort Reads", "Fantasy", "Science Fiction"]);
    for (const genre of res.body) {
      expect(Object.keys(genre).sort()).toEqual(GENRE_VIEW_KEYS);
    }
  });

  it("does not return another user's custom genres", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
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
          groupKey: "personal",
          groupName: "Personal",
          isDefault: false,
          key: "stranger-secret",
          name: "Stranger Secret",
          normalizedName: "stranger secret",
          userId: stranger.userId,
        },
      ],
    });

    const res = await listGenres(owner.accessToken);

    const names = res.body.map((genre: { name: string }) => genre.name);
    expect(names).toContain("Fantasy");
    expect(names).not.toContain("Stranger Secret");
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

    const res = await listGenres(accessToken);

    const keys = res.body.map((genre: { key: string }) => genre.key);
    expect(keys).toEqual(["sci-fi", "fantasy", "history"]);
  });
});

describe("POST /api/genres", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).post("/api/genres").send({ name: "Мій жанр" });

    expect(res.status).toBe(401);
  });

  it("creates a custom genre owned by the caller and returns the GenreView", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createGenre(accessToken, { name: "Мій жанр" });

    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(UUID);
    expect(res.body.key).toMatch(UUID);
    expect(res.body.name).toBe("Мій жанр");
    expect(res.body.isDefault).toBe(false);
    expect(res.body.groupKey).toBe("custom");
    expect(res.body.groupName).toBe("Мої жанри");
    expect(Object.keys(res.body).sort()).toEqual(GENRE_VIEW_KEYS);

    const list = await listGenres(accessToken);
    const names = list.body.map((genre: { name: string }) => genre.name);
    expect(names).toContain("Мій жанр");
  });

  it("collapses internal whitespace in the custom genre name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createGenre(accessToken, { name: "  Темне   фентезі  " });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Темне фентезі");
  });

  it("returns 409 when the caller already has a genre with the same name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createGenre(accessToken, { name: "Мій жанр" });

    const res = await createGenre(accessToken, { name: "Мій жанр" });

    expect(res.status).toBe(409);
  });

  it("returns 409 when the name collides with a global default genre", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedDefaultGenre("fentezi", "Фентезі");

    const res = await createGenre(accessToken, { name: "Фентезі" });

    expect(res.status).toBe(409);
  });

  it("returns 400 with a field error when the name is too short", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createGenre(accessToken, { name: "a" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "name" })]),
    );
  });

  it("rejects a name containing an HTML tag", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createGenre(accessToken, { name: "Жанр <script>alert(1)</script>" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "name" })]),
    );
  });
});

describe("DELETE /api/genres/:id", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).delete(`/api/genres/${MISSING_UUID}`);

    expect(res.status).toBe(401);
  });

  it("deletes the caller's own custom genre", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createGenre(accessToken, { name: "Мій жанр" });

    const res = await deleteGenre(accessToken, created.body.id);

    expect(res.status).toBe(204);
    const list = await listGenres(accessToken);
    const names = list.body.map((genre: { name: string }) => genre.name);
    expect(names).not.toContain("Мій жанр");
  });

  it("removes the deleted genre key from the caller's books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createGenre(accessToken, { name: "Мій жанр" });
    const genreKey = created.body.key;

    const book = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      genres: [genreKey],
      title: "Dune",
    });
    expect(book.status).toBe(201);
    expect(book.body.genres).toEqual([genreKey]);

    const deleted = await deleteGenre(accessToken, created.body.id);
    expect(deleted.status).toBe(204);

    const refetched = await getBook(accessToken, book.body.id);
    expect(refetched.status).toBe(200);
    expect(refetched.body.genres).toEqual([]);
  });

  it("returns 404 when deleting a global default genre", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedDefaultGenre("fentezi", "Фентезі");
    const seeded = await prisma.genre.findFirstOrThrow({ where: { key: "fentezi" } });

    const res = await deleteGenre(accessToken, seeded.id);

    expect(res.status).toBe(404);
    const list = await listGenres(accessToken);
    const keys = list.body.map((genre: { key: string }) => genre.key);
    expect(keys).toContain("fentezi");
  });

  it("returns 404 for a non-existent genre id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await deleteGenre(accessToken, MISSING_UUID);

    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting another user's custom genre and leaves it intact", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerGenre = await createGenre(stranger.accessToken, { name: "Чужий жанр" });

    const res = await deleteGenre(owner.accessToken, strangerGenre.body.id);

    expect(res.status).toBe(404);
    const list = await listGenres(stranger.accessToken);
    const names = list.body.map((genre: { name: string }) => genre.name);
    expect(names).toContain("Чужий жанр");
  });
});

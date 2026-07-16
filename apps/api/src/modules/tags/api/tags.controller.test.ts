import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { TagsModule } from "../tags.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, TagsModule]);
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

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

function createTag(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/tags")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function deleteTag(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .delete(`/api/tags/${id}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function searchTags(accessToken: string, search?: string): request.Test {
  const path = search === undefined ? "/api/tags" : `/api/tags?search=${search}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

function tagStats(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/tags/stats")
    .set("Authorization", `Bearer ${accessToken}`);
}

function updateTag(accessToken: string, id: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/tags/${id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("POST /api/tags", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).post("/api/tags").send({ name: "slow burn" });

    expect(res.status).toBe(401);
  });

  it("creates a tag and returns the enriched catalog view with the default type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createTag(accessToken, { name: "Slow Burn" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      color: null,
      description: null,
      name: "Slow Burn",
      normalizedName: "slow burn",
      type: "custom",
    });
    expect(Object.keys(res.body).sort()).toEqual([
      "color",
      "createdAt",
      "description",
      "id",
      "lastUsedAt",
      "name",
      "normalizedName",
      "type",
      "updatedAt",
    ]);
  });

  it("persists type, color and description", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createTag(accessToken, {
      color: "#A96E47",
      description: "moody university vibes",
      name: "dark academia",
      type: "atmosphere",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      color: "#A96E47",
      description: "moody university vibes",
      type: "atmosphere",
    });
  });

  it("rejects a name shorter than two characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createTag(accessToken, { name: "a" });

    expect(res.status).toBe(400);
  });

  it("rejects a name longer than 40 characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createTag(accessToken, { name: "x".repeat(41) });

    expect(res.status).toBe(400);
  });

  it("rejects a description longer than 300 characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createTag(accessToken, { description: "d".repeat(301), name: "cozy" });

    expect(res.status).toBe(400);
  });

  it("returns 409 for a duplicate normalized name for the same user", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createTag(accessToken, { name: "Slow Burn" });

    const res = await createTag(accessToken, { name: "  slow   burn " });

    expect(res.status).toBe(409);
  });

  it("lets a different user create a tag with the same normalized name", async () => {
    const owner = await context.registerVerifyAndLogin();
    const other = await context.registerVerifyAndLogin({
      email: "other@example.com",
      nickname: "other",
    });
    await createTag(owner.accessToken, { name: "slow burn" });

    const res = await createTag(other.accessToken, { name: "slow burn" });

    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/tags/:id", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/tags/${MISSING_UUID}`)
      .send({ name: "renamed" });

    expect(res.status).toBe(401);
  });

  it("renames an owned tag and returns the updated catalog view", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const tag = await prisma.tag.create({
      data: { name: "dark academia", normalizedName: "dark academia", userId },
    });

    const res = await updateTag(accessToken, tag.id, { name: "Cozy Mystery", type: "trope" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "Cozy Mystery",
      normalizedName: "cozy mystery",
      type: "trope",
    });
  });

  it("clears color and description when set to null", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const tag = await prisma.tag.create({
      data: {
        color: "#A96E47",
        description: "old",
        name: "dark academia",
        normalizedName: "dark academia",
        userId,
      },
    });

    const res = await updateTag(accessToken, tag.id, { color: null, description: null });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ color: null, description: null });
  });

  it("returns 409 when the rename collides with another tag of the same user", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.tag.create({
      data: { name: "slow burn", normalizedName: "slow burn", userId },
    });
    const tag = await prisma.tag.create({
      data: { name: "dark academia", normalizedName: "dark academia", userId },
    });

    const res = await updateTag(accessToken, tag.id, { name: "Slow Burn" });

    expect(res.status).toBe(409);
  });

  it("allows a case-only rename of the same tag", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const tag = await prisma.tag.create({
      data: { name: "dark academia", normalizedName: "dark academia", userId },
    });

    const res = await updateTag(accessToken, tag.id, { name: "Dark Academia" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Dark Academia", normalizedName: "dark academia" });
  });

  it("returns 404 and keeps the tag when editing another user's tag", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerTag = await prisma.tag.create({
      data: { name: "secret tag", normalizedName: "secret tag", userId: stranger.userId },
    });

    const res = await updateTag(owner.accessToken, strangerTag.id, { name: "stolen" });

    expect(res.status).toBe(404);
    const unchanged = await prisma.tag.findUnique({ where: { id: strangerTag.id } });
    expect(unchanged?.name).toBe("secret tag");
  });
});

describe("GET /api/tags/stats", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/tags/stats");

    expect(res.status).toBe(401);
  });

  it("returns each owned tag with its book count and enriched fields", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await prisma.author.create({
      data: { name: "Frank Herbert", normalizedName: "frank herbert", userId },
    });
    const book = await prisma.book.create({
      data: {
        authors: { create: [{ authorId: author.id, position: 0 }] },
        title: "Dune",
        userId,
      },
    });
    const usedTag = await prisma.tag.create({
      data: {
        color: "#A96E47",
        name: "dark academia",
        normalizedName: "dark academia",
        type: "atmosphere",
        userId,
      },
    });
    await prisma.tag.create({
      data: { name: "unused", normalizedName: "unused", userId },
    });
    await prisma.bookTag.create({ data: { bookId: book.id, tagId: usedTag.id } });

    const res = await tagStats(accessToken);

    expect(res.status).toBe(200);
    const byName = new Map(res.body.map((entry: { name: string }) => [entry.name, entry]));
    expect(byName.get("dark academia")).toMatchObject({
      booksCount: 1,
      color: "#A96E47",
      type: "atmosphere",
    });
    expect(byName.get("unused")).toMatchObject({ booksCount: 0 });
    expect(Object.keys(byName.get("unused") as object).sort()).toEqual([
      "booksCount",
      "color",
      "id",
      "lastUsedAt",
      "name",
      "normalizedName",
      "type",
    ]);
  });

  it("does not include another user's tags", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await prisma.tag.create({
      data: { name: "secret", normalizedName: "secret", userId: stranger.userId },
    });

    const res = await tagStats(owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/tags", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/tags");

    expect(res.status).toBe(401);
  });

  it("returns a paginator of the caller's own tags as id and name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.tag.create({
      data: { name: "dark academia", normalizedName: "dark academia", userId },
    });

    const res = await searchTags(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0]).toMatchObject({ name: "dark academia" });
    expect(Object.keys(res.body.items[0]).sort()).toEqual(["id", "name"]);
  });

  it("filters by a case-insensitive search term", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.tag.createMany({
      data: [
        { name: "dark academia", normalizedName: "dark academia", userId },
        { name: "slow burn", normalizedName: "slow burn", userId },
      ],
    });

    const res = await searchTags(accessToken, "DARK");

    const names = res.body.items.map((tag: { name: string }) => tag.name);
    expect(names).toEqual(["dark academia"]);
  });

  it("does not return another user's tags", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await prisma.tag.create({
      data: { name: "secret tag", normalizedName: "secret tag", userId: stranger.userId },
    });

    const res = await searchTags(owner.accessToken);

    expect(res.body.totalCount).toBe(0);
    expect(res.body.items).toHaveLength(0);
  });

  it("paginates results across pages", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.tag.createMany({
      data: [
        { name: "tag a", normalizedName: "tag a", userId },
        { name: "tag b", normalizedName: "tag b", userId },
        { name: "tag c", normalizedName: "tag c", userId },
      ],
    });

    const firstPage = await searchTags(accessToken).query({ pageNumber: 1, pageSize: 2 });
    const secondPage = await searchTags(accessToken).query({ pageNumber: 2, pageSize: 2 });

    expect(firstPage.body.totalCount).toBe(3);
    expect(firstPage.body.pagesCount).toBe(2);
    expect(firstPage.body.items).toHaveLength(2);
    expect(secondPage.body.items).toHaveLength(1);
  });
});

describe("DELETE /api/tags/:id", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).delete(`/api/tags/${MISSING_UUID}`);

    expect(res.status).toBe(401);
  });

  it("returns 204 and removes the tag", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const tag = await prisma.tag.create({
      data: { name: "dark academia", normalizedName: "dark academia", userId },
    });

    const res = await deleteTag(accessToken, tag.id);

    expect(res.status).toBe(204);
    expect(await prisma.tag.count({ where: { id: tag.id } })).toBe(0);
  });

  it("cascades to book_tags but leaves the book when its tag is deleted", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await prisma.author.create({
      data: { name: "Frank Herbert", normalizedName: "frank herbert", userId },
    });
    const book = await prisma.book.create({
      data: {
        authors: { create: [{ authorId: author.id, position: 0 }] },
        title: "Dune",
        userId,
      },
    });
    const tag = await prisma.tag.create({
      data: { name: "dark academia", normalizedName: "dark academia", userId },
    });
    await prisma.bookTag.create({ data: { bookId: book.id, tagId: tag.id } });

    const res = await deleteTag(accessToken, tag.id);

    expect(res.status).toBe(204);
    expect(await prisma.bookTag.count({ where: { tagId: tag.id } })).toBe(0);
    expect(await prisma.book.count({ where: { id: book.id } })).toBe(1);
  });

  it("returns 404 when the tag does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await deleteTag(accessToken, MISSING_UUID);

    expect(res.status).toBe(404);
  });

  it("returns 404 and keeps the tag when deleting another user's tag", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerTag = await prisma.tag.create({
      data: { name: "secret tag", normalizedName: "secret tag", userId: stranger.userId },
    });

    const res = await deleteTag(owner.accessToken, strangerTag.id);

    expect(res.status).toBe(404);
    expect(await prisma.tag.count({ where: { id: strangerTag.id } })).toBe(1);
  });
});

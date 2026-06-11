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

function searchTags(accessToken: string, search?: string): request.Test {
  const path = search === undefined ? "/api/tags" : `/api/tags?search=${search}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

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

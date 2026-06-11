import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../lists.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, ListsModule]);
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

function searchLists(accessToken: string, search?: string): request.Test {
  const path = search === undefined ? "/api/lists" : `/api/lists?search=${search}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/lists", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/lists");

    expect(res.status).toBe(401);
  });

  it("returns a paginator of the caller's own lists as id, name and description", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.bookList.create({
      data: { description: "cozy", name: "Autumn reads", normalizedName: "autumn reads", userId },
    });

    const res = await searchLists(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0]).toEqual({
      description: "cozy",
      id: expect.any(String),
      name: "Autumn reads",
    });
  });

  it("filters by a case-insensitive search term", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.bookList.createMany({
      data: [
        { name: "Autumn reads", normalizedName: "autumn reads", userId },
        { name: "Gifts", normalizedName: "gifts", userId },
      ],
    });

    const res = await searchLists(accessToken, "AUTUMN");

    const names = res.body.items.map((list: { name: string }) => list.name);
    expect(names).toEqual(["Autumn reads"]);
  });

  it("does not return another user's lists", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await prisma.bookList.create({
      data: { name: "Secret", normalizedName: "secret", userId: stranger.userId },
    });

    const res = await searchLists(owner.accessToken);

    expect(res.body.totalCount).toBe(0);
    expect(res.body.items).toHaveLength(0);
  });

  it("paginates results across pages", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.bookList.createMany({
      data: [
        { name: "list a", normalizedName: "list a", userId },
        { name: "list b", normalizedName: "list b", userId },
        { name: "list c", normalizedName: "list c", userId },
      ],
    });

    const firstPage = await searchLists(accessToken).query({ pageNumber: 1, pageSize: 2 });
    const secondPage = await searchLists(accessToken).query({ pageNumber: 2, pageSize: 2 });

    expect(firstPage.body.totalCount).toBe(3);
    expect(firstPage.body.pagesCount).toBe(2);
    expect(firstPage.body.items).toHaveLength(2);
    expect(secondPage.body.items).toHaveLength(1);
  });
});

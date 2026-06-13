import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { AuthorsModule } from "../authors.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, AuthorsModule]);
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

function searchAuthors(accessToken: string, search?: string): request.Test {
  const path = search === undefined ? "/api/authors" : `/api/authors?search=${search}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/authors", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/authors");

    expect(res.status).toBe(401);
  });

  it("returns a paginator with global seeds and the caller's own custom authors", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.author.create({
      data: { name: "George Orwell", normalizedName: "george orwell", userId: null },
    });
    await prisma.author.create({
      data: { name: "My Author", normalizedName: "my author", userId },
    });

    const res = await searchAuthors(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.page).toBe(1);
    const names = res.body.items.map((author: { name: string }) => author.name);
    expect(names).toEqual(expect.arrayContaining(["George Orwell", "My Author"]));
  });

  it("orders the caller's own custom authors before global seeds", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.author.create({
      data: { name: "George Orwell", normalizedName: "george orwell", userId: null },
    });
    await prisma.author.create({
      data: { name: "My Author", normalizedName: "my author", userId },
    });

    const res = await searchAuthors(accessToken);

    const names = res.body.items.map((author: { name: string }) => author.name);
    expect(names).toEqual(["My Author", "George Orwell"]);
  });

  it("marks own custom authors with isCustom true and global seeds with false", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.author.create({
      data: { name: "George Orwell", normalizedName: "george orwell", userId: null },
    });
    await prisma.author.create({
      data: { name: "My Author", normalizedName: "my author", userId },
    });

    const res = await searchAuthors(accessToken);

    const byName = new Map(
      res.body.items.map((author: { isCustom: boolean; name: string }) => [
        author.name,
        author.isCustom,
      ]),
    );
    expect(byName.get("George Orwell")).toBe(false);
    expect(byName.get("My Author")).toBe(true);
  });

  it("does not return another user's custom author", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await prisma.author.create({
      data: { name: "Secret Author", normalizedName: "secret author", userId: stranger.userId },
    });

    const res = await searchAuthors(owner.accessToken);

    const names = res.body.items.map((author: { name: string }) => author.name);
    expect(names).not.toContain("Secret Author");
  });

  it("filters by a case-insensitive search term", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await prisma.author.create({
      data: { name: "George Orwell", normalizedName: "george orwell", userId: null },
    });
    await prisma.author.create({
      data: { name: "Isaac Asimov", normalizedName: "isaac asimov", userId: null },
    });

    const res = await searchAuthors(accessToken, "orwell");

    const names = res.body.items.map((author: { name: string }) => author.name);
    expect(names).toEqual(["George Orwell"]);
  });

  it("paginates results across pages", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    for (const name of ["Author A", "Author B", "Author C"]) {
      await prisma.author.create({
        data: { name, normalizedName: name.toLowerCase(), userId: null },
      });
    }

    const firstPage = await request(app.getHttpServer())
      .get("/api/authors?pageSize=2&pageNumber=1")
      .set("Authorization", `Bearer ${accessToken}`);
    const secondPage = await request(app.getHttpServer())
      .get("/api/authors?pageSize=2&pageNumber=2")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(firstPage.body.totalCount).toBe(3);
    expect(firstPage.body.pagesCount).toBe(2);
    expect(firstPage.body.items).toHaveLength(2);
    expect(secondPage.body.items).toHaveLength(1);
  });
});

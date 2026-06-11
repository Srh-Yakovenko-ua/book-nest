import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { PublishersModule } from "../publishers.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, PublishersModule]);
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

function searchPublishers(accessToken: string, search?: string): request.Test {
  const path = search === undefined ? "/api/publishers" : `/api/publishers?search=${search}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/publishers", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/publishers");

    expect(res.status).toBe(401);
  });

  it("returns a paginator with global seeds and the caller's own custom publishers", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.publisher.create({
      data: { name: "Penguin", normalizedName: "penguin", userId: null },
    });
    await prisma.publisher.create({
      data: { name: "My Press", normalizedName: "my press", userId },
    });

    const res = await searchPublishers(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.page).toBe(1);
    const names = res.body.items.map((publisher: { name: string }) => publisher.name);
    expect(names).toEqual(expect.arrayContaining(["Penguin", "My Press"]));
  });

  it("orders the caller's own custom publishers before global seeds", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.publisher.create({
      data: { name: "Penguin", normalizedName: "penguin", userId: null },
    });
    await prisma.publisher.create({
      data: { name: "My Press", normalizedName: "my press", userId },
    });

    const res = await searchPublishers(accessToken);

    const names = res.body.items.map((publisher: { name: string }) => publisher.name);
    expect(names).toEqual(["My Press", "Penguin"]);
  });

  it("marks own custom publishers with isCustom true and global seeds with false", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.publisher.create({
      data: { name: "Penguin", normalizedName: "penguin", userId: null },
    });
    await prisma.publisher.create({
      data: { name: "My Press", normalizedName: "my press", userId },
    });

    const res = await searchPublishers(accessToken);

    const byName = new Map(
      res.body.items.map((publisher: { isCustom: boolean; name: string }) => [
        publisher.name,
        publisher.isCustom,
      ]),
    );
    expect(byName.get("Penguin")).toBe(false);
    expect(byName.get("My Press")).toBe(true);
  });

  it("does not return another user's custom publisher", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await prisma.publisher.create({
      data: { name: "Secret Press", normalizedName: "secret press", userId: stranger.userId },
    });

    const res = await searchPublishers(owner.accessToken);

    const names = res.body.items.map((publisher: { name: string }) => publisher.name);
    expect(names).not.toContain("Secret Press");
  });

  it("filters by a case-insensitive search term", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await prisma.publisher.create({
      data: { name: "Penguin", normalizedName: "penguin", userId: null },
    });
    await prisma.publisher.create({
      data: { name: "Vintage", normalizedName: "vintage", userId: null },
    });

    const res = await searchPublishers(accessToken, "PENGUIN");

    const names = res.body.items.map((publisher: { name: string }) => publisher.name);
    expect(names).toEqual(["Penguin"]);
  });

  it("paginates results across pages", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    for (const name of ["Press A", "Press B", "Press C"]) {
      await prisma.publisher.create({
        data: { name, normalizedName: name.toLowerCase(), userId: null },
      });
    }

    const firstPage = await request(app.getHttpServer())
      .get("/api/publishers?pageSize=2&pageNumber=1&sortDirection=desc")
      .set("Authorization", `Bearer ${accessToken}`);
    const secondPage = await request(app.getHttpServer())
      .get("/api/publishers?pageSize=2&pageNumber=2&sortDirection=desc")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(firstPage.body.totalCount).toBe(3);
    expect(firstPage.body.pagesCount).toBe(2);
    expect(firstPage.body.items).toHaveLength(2);
    expect(secondPage.body.items).toHaveLength(1);
  });
});

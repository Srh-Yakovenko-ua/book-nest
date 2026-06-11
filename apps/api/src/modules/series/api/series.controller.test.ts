import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { SeriesModule } from "../series.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, SeriesModule]);
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

function searchSeries(accessToken: string, search?: string): request.Test {
  const path = search === undefined ? "/api/series" : `/api/series?search=${search}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/series", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/series");

    expect(res.status).toBe(401);
  });

  it("returns only the caller's own series", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", userId },
    });

    const res = await searchSeries(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items[0]).toMatchObject({ name: "Throne of Glass", status: "unknown" });
  });

  it("does not return another user's series", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await prisma.series.create({
      data: { name: "Secret Series", normalizedName: "secret series", userId: stranger.userId },
    });

    const res = await searchSeries(owner.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(0);
  });

  it("filters by a case-insensitive search term", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", userId },
    });
    await prisma.series.create({
      data: { name: "A Court of Thorns", normalizedName: "a court of thorns", userId },
    });

    const res = await searchSeries(accessToken, "throne");

    const names = res.body.items.map((item: { name: string }) => item.name);
    expect(names).toEqual(["Throne of Glass"]);
  });
});

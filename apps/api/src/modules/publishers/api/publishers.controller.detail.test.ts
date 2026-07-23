import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { PublishersModule } from "../publishers.module.js";
import { seedBook, seedPublisher } from "./publisher-library.fixtures.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

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

function getDetail(accessToken: string, publisherId: string, query = ""): request.Test {
  const path =
    query === ""
      ? `/api/publishers/${publisherId}/library-detail`
      : `/api/publishers/${publisherId}/library-detail?${query}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/publishers/:id/library-detail authentication", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/publishers/${MISSING_ID}/library-detail`,
    );

    expect(res.status).toBe(401);
  });
});

describe("GET /api/publishers/:id/library-detail happy path", () => {
  it("returns the publisher with the caller's library stats", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      countryCode: "UA",
      foundedYear: 2001,
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
      websiteUrl: "https://example.org",
    });
    await seedBook({
      prisma,
      publisherId: publisher.id,
      rating: 8,
      readingStatus: "finished",
      userId,
    });
    await seedBook({ prisma, publisherId: publisher.id, readingStatus: "reading", userId });

    const res = await getDetail(accessToken, publisher.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      countryCode: "UA",
      foundedYear: 2001,
      id: publisher.id,
      isCustom: false,
      name: "Penguin",
      stats: { averageRating: 8, booksCount: 2, ratedBooksCount: 1, readCount: 1, readingCount: 1 },
      websiteUrl: "https://example.org",
    });
    expect(res.body.id).toMatch(UUID_PATTERN);
  });

  it("resolves the display name to the requested locale", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Vydavnytstvo Stary Lev",
      names: [
        {
          isPrimary: true,
          locale: "en",
          name: "Vydavnytstvo Stary Lev",
          normalizedName: "vydavnytstvo stary lev",
        },
        {
          isPrimary: true,
          locale: "uk",
          name: "Видавництво Старого Лева",
          normalizedName: "видавництво старого лева",
        },
      ],
      normalizedName: "vydavnytstvo stary lev",
      prisma,
      userId: null,
    });
    await seedBook({ prisma, publisherId: publisher.id, userId });

    const english = await getDetail(accessToken, publisher.id, "locale=en");

    expect(english.body.name).toBe("Vydavnytstvo Stary Lev");
  });
});

describe("GET /api/publishers/:id/library-detail not found", () => {
  it("returns 404 for a publisher the caller has no books for", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });

    const res = await getDetail(accessToken, publisher.id);

    expect(res.status).toBe(404);
  });

  it("returns 404 for another user's custom publisher without leaking its existence", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerPress = await seedPublisher({
      name: "Stranger Press",
      normalizedName: "stranger press",
      prisma,
      userId: stranger.userId,
    });
    await seedBook({ prisma, publisherId: strangerPress.id, userId: owner.userId });

    const res = await getDetail(owner.accessToken, strangerPress.id);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a publisher id that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getDetail(accessToken, MISSING_ID);

    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed publisher id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getDetail(accessToken, "not-a-uuid");

    expect(res.status).toBe(400);
  });
});

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

function deletePublisher(accessToken: string, publisherId: string): request.Test {
  return request(app.getHttpServer())
    .delete(`/api/publishers/${publisherId}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function patchPublisher(
  accessToken: string,
  publisherId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/publishers/${publisherId}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("PATCH /api/publishers/:id authentication", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/publishers/${MISSING_ID}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/publishers/:id own custom publisher", () => {
  it("renames the publisher and updates its country, website and founded year", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Old Name",
      normalizedName: "old name",
      prisma,
      userId,
    });
    await seedBook({ prisma, publisherId: publisher.id, readingStatus: "finished", userId });

    const res = await patchPublisher(accessToken, publisher.id, {
      countryCode: "ua",
      foundedYear: 1999,
      name: "New Name",
      websiteUrl: "https://newname.example",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      countryCode: "UA",
      foundedYear: 1999,
      id: publisher.id,
      isCustom: true,
      name: "New Name",
      stats: { booksCount: 1, readCount: 1 },
      websiteUrl: "https://newname.example",
    });
  });

  it("persists the renamed primary name so a later read returns the new name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Old Name",
      normalizedName: "old name",
      prisma,
      userId,
    });

    await patchPublisher(accessToken, publisher.id, { name: "Fresh Name" });

    const primaryName = await prisma.publisherName.findFirst({
      select: { name: true, normalizedName: true },
      where: { isPrimary: true, publisherId: publisher.id },
    });
    expect(primaryName).toEqual({ name: "Fresh Name", normalizedName: "fresh name" });
  });

  it("clears the country code when null is sent", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      countryCode: "UA",
      name: "Old",
      normalizedName: "old",
      prisma,
      userId,
    });

    const res = await patchPublisher(accessToken, publisher.id, { countryCode: null });

    expect(res.status).toBe(200);
    expect(res.body.countryCode).toBeNull();
  });
});

describe("PATCH /api/publishers/:id permissions", () => {
  it("returns 403 when editing a global publisher", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });

    const res = await patchPublisher(accessToken, publisher.id, { name: "Hacked" });

    expect(res.status).toBe(403);
  });

  it("returns 404 when editing another user's custom publisher", async () => {
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

    const res = await patchPublisher(owner.accessToken, strangerPress.id, { name: "Taken" });

    expect(res.status).toBe(404);
  });

  it("returns 404 when editing a publisher that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await patchPublisher(accessToken, MISSING_ID, { name: "Ghost" });

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/publishers/:id conflicts", () => {
  it("returns 409 with a duplicate-name code when the new name collides with another owned publisher", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedPublisher({ name: "Alpha", normalizedName: "alpha", prisma, userId });
    const beta = await seedPublisher({ name: "Beta", normalizedName: "beta", prisma, userId });

    const res = await patchPublisher(accessToken, beta.id, { name: "Alpha" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PUBLISHER_DUPLICATE_NAME");
  });

  it("allows renaming a publisher when only its own row matches the new name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({ name: "Solo", normalizedName: "solo", prisma, userId });

    const res = await patchPublisher(accessToken, publisher.id, { name: "Solo Press" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Solo Press");
  });
});

describe("PATCH /api/publishers/:id validation", () => {
  it("returns 400 with a field error for an invalid country code", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({ name: "Old", normalizedName: "old", prisma, userId });

    const res = await patchPublisher(accessToken, publisher.id, { countryCode: "USA" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "countryCode" })]),
    );
  });

  it("returns 400 for an invalid website url", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({ name: "Old", normalizedName: "old", prisma, userId });

    const res = await patchPublisher(accessToken, publisher.id, { websiteUrl: "not a url" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "websiteUrl" })]),
    );
  });

  it("returns 400 for a founded year below the allowed range", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({ name: "Old", normalizedName: "old", prisma, userId });

    const res = await patchPublisher(accessToken, publisher.id, { foundedYear: 1000 });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "foundedYear" })]),
    );
  });
});

describe("DELETE /api/publishers/:id authentication", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).delete(`/api/publishers/${MISSING_ID}`);

    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/publishers/:id own custom publisher", () => {
  it("returns 204 and removes the publisher with its name rows when it has no books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Doomed",
      normalizedName: "doomed",
      prisma,
      userId,
    });

    const res = await deletePublisher(accessToken, publisher.id);

    expect(res.status).toBe(204);
    const remaining = await prisma.publisher.findUnique({ where: { id: publisher.id } });
    const names = await prisma.publisherName.count({ where: { publisherId: publisher.id } });
    expect(remaining).toBeNull();
    expect(names).toBe(0);
  });

  it("returns 409 with a has-books code and keeps the publisher when it still has linked books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({ name: "Busy", normalizedName: "busy", prisma, userId });
    await seedBook({ prisma, publisherId: publisher.id, userId });

    const res = await deletePublisher(accessToken, publisher.id);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PUBLISHER_HAS_BOOKS");
    const remaining = await prisma.publisher.findUnique({ where: { id: publisher.id } });
    expect(remaining).not.toBeNull();
  });
});

describe("DELETE /api/publishers/:id permissions", () => {
  it("returns 403 when deleting a global publisher", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const publisher = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });

    const res = await deletePublisher(accessToken, publisher.id);

    expect(res.status).toBe(403);
  });

  it("returns 404 when deleting another user's custom publisher", async () => {
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

    const res = await deletePublisher(owner.accessToken, strangerPress.id);

    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting a publisher that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await deletePublisher(accessToken, MISSING_ID);

    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed publisher id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await deletePublisher(accessToken, "not-a-uuid");

    expect(res.status).toBe(400);
  });
});

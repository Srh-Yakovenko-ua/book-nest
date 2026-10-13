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
const TRASHED_AT = new Date("2026-05-01T10:00:00.000Z");

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

function mergePublisher(
  accessToken: string,
  sourcePublisherId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/publishers/${sourcePublisherId}/merge`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("POST /api/publishers/:sourcePublisherId/merge authentication", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/publishers/${MISSING_ID}/merge`)
      .send({ targetPublisherId: MISSING_ID });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/publishers/:sourcePublisherId/merge into a global publisher", () => {
  it("moves the books, deletes the source and leaves the global target untouched", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const source = await seedPublisher({
      name: "Duplicate Press",
      normalizedName: "duplicate press",
      prisma,
      userId,
    });
    const target = await seedPublisher({
      countryCode: "UA",
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    const firstBook = await seedBook({
      prisma,
      publisherId: source.id,
      title: "First",
      userId,
    });
    const secondBook = await seedBook({
      prisma,
      publisherId: source.id,
      title: "Second",
      userId,
    });
    const targetBefore = await prisma.publisher.findUnique({ where: { id: target.id } });

    const res = await mergePublisher(accessToken, source.id, { targetPublisherId: target.id });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ movedBooksCount: 2, targetPublisherId: target.id });

    const books = await prisma.book.findMany({
      orderBy: { title: "asc" },
      select: { id: true, publisherId: true },
      where: { id: { in: [firstBook.id, secondBook.id] } },
    });
    expect(books).toEqual([
      { id: firstBook.id, publisherId: target.id },
      { id: secondBook.id, publisherId: target.id },
    ]);

    const sourceAfter = await prisma.publisher.findUnique({ where: { id: source.id } });
    const targetAfter = await prisma.publisher.findUnique({ where: { id: target.id } });
    expect(sourceAfter).toBeNull();
    expect(targetAfter).toEqual(targetBefore);
  });

  it("deletes the name rows of the source publisher and keeps the ones of the target", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const source = await seedPublisher({
      name: "Duplicate Press",
      normalizedName: "duplicate press",
      prisma,
      userId,
    });
    const target = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    await seedBook({ prisma, publisherId: source.id, userId });

    const res = await mergePublisher(accessToken, source.id, { targetPublisherId: target.id });

    expect(res.status).toBe(200);
    const sourceNames = await prisma.publisherName.count({ where: { publisherId: source.id } });
    const targetNames = await prisma.publisherName.findMany({
      select: { isPrimary: true, name: true },
      where: { publisherId: target.id },
    });
    expect(sourceNames).toBe(0);
    expect(targetNames).toEqual([{ isPrimary: true, name: "Penguin" }]);
  });

  it("moves trashed books onto the target as well", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const source = await seedPublisher({
      name: "Duplicate Press",
      normalizedName: "duplicate press",
      prisma,
      userId,
    });
    const target = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    const activeBook = await seedBook({ prisma, publisherId: source.id, title: "Active", userId });
    const trashedBook = await seedBook({
      prisma,
      publisherId: source.id,
      title: "Trashed",
      userId,
    });
    await prisma.book.update({
      data: { deletedAt: TRASHED_AT, purgeAt: TRASHED_AT },
      where: { id: trashedBook.id },
    });

    const res = await mergePublisher(accessToken, source.id, { targetPublisherId: target.id });

    expect(res.status).toBe(200);
    expect(res.body.movedBooksCount).toBe(2);
    const trashedAfter = await prisma.book.findUnique({
      select: { deletedAt: true, publisherId: true },
      where: { id: trashedBook.id },
    });
    const activeAfter = await prisma.book.findUnique({
      select: { publisherId: true },
      where: { id: activeBook.id },
    });
    expect(trashedAfter).toEqual({ deletedAt: TRASHED_AT, publisherId: target.id });
    expect(activeAfter).toEqual({ publisherId: target.id });
  });

  it("succeeds with zero moved books when the source publisher has none", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const source = await seedPublisher({ name: "Empty", normalizedName: "empty", prisma, userId });
    const target = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });

    const res = await mergePublisher(accessToken, source.id, { targetPublisherId: target.id });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ movedBooksCount: 0, targetPublisherId: target.id });
    const sourceAfter = await prisma.publisher.findUnique({ where: { id: source.id } });
    expect(sourceAfter).toBeNull();
  });
});

describe("POST /api/publishers/:sourcePublisherId/merge into another custom publisher", () => {
  it("moves the books onto the other publisher of the same user", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const source = await seedPublisher({
      name: "Duplicate Press",
      normalizedName: "duplicate press",
      prisma,
      userId,
    });
    const target = await seedPublisher({
      name: "Kept Press",
      normalizedName: "kept press",
      prisma,
      userId,
    });
    const book = await seedBook({ prisma, publisherId: source.id, userId });
    const existingBook = await seedBook({ prisma, publisherId: target.id, userId });

    const res = await mergePublisher(accessToken, source.id, { targetPublisherId: target.id });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ movedBooksCount: 1, targetPublisherId: target.id });
    const booksOnTarget = await prisma.book.count({ where: { publisherId: target.id } });
    expect(booksOnTarget).toBe(2);
    const moved = await prisma.book.findUnique({
      select: { publisherId: true },
      where: { id: book.id },
    });
    const untouched = await prisma.book.findUnique({
      select: { publisherId: true },
      where: { id: existingBook.id },
    });
    expect(moved).toEqual({ publisherId: target.id });
    expect(untouched).toEqual({ publisherId: target.id });
  });
});

describe("POST /api/publishers/:sourcePublisherId/merge permissions", () => {
  it("returns 403 when the source publisher is global", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const globalSource = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    const target = await seedPublisher({ name: "Mine", normalizedName: "mine", prisma, userId });
    const book = await seedBook({ prisma, publisherId: globalSource.id, userId });

    const res = await mergePublisher(accessToken, globalSource.id, {
      targetPublisherId: target.id,
    });

    expect(res.status).toBe(403);
    const survivor = await prisma.publisher.findUnique({ where: { id: globalSource.id } });
    const untouched = await prisma.book.findUnique({
      select: { publisherId: true },
      where: { id: book.id },
    });
    expect(survivor).not.toBeNull();
    expect(untouched).toEqual({ publisherId: globalSource.id });
  });

  it("answers a source owned by another user exactly like a source that does not exist", async () => {
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
    const target = await seedPublisher({
      name: "Mine",
      normalizedName: "mine",
      prisma,
      userId: owner.userId,
    });

    const foreign = await mergePublisher(owner.accessToken, strangerPress.id, {
      targetPublisherId: target.id,
    });
    const missing = await mergePublisher(owner.accessToken, MISSING_ID, {
      targetPublisherId: target.id,
    });

    expect(foreign.status).toBe(missing.status);
    expect(foreign.status).toBe(404);
    expect(foreign.body.message).toBe(missing.body.message);
    expect(foreign.body.code).toBe(missing.body.code);
    expect(JSON.stringify(foreign.body)).not.toContain("Stranger Press");
    const survivor = await prisma.publisher.findUnique({ where: { id: strangerPress.id } });
    expect(survivor).not.toBeNull();
  });

  it("answers a target owned by another user exactly like a target that does not exist", async () => {
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
    const source = await seedPublisher({
      name: "Mine",
      normalizedName: "mine",
      prisma,
      userId: owner.userId,
    });
    const book = await seedBook({ prisma, publisherId: source.id, userId: owner.userId });

    const foreign = await mergePublisher(owner.accessToken, source.id, {
      targetPublisherId: strangerPress.id,
    });
    const missing = await mergePublisher(owner.accessToken, source.id, {
      targetPublisherId: MISSING_ID,
    });

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body.message).toBe(missing.body.message);
    expect(JSON.stringify(foreign.body)).not.toContain("Stranger Press");
    const sourceAfter = await prisma.publisher.findUnique({ where: { id: source.id } });
    const bookAfter = await prisma.book.findUnique({
      select: { publisherId: true },
      where: { id: book.id },
    });
    expect(sourceAfter).not.toBeNull();
    expect(bookAfter).toEqual({ publisherId: source.id });
  });

  it("leaves a book of another user pointing at the same publisher alone", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const source = await seedPublisher({
      name: "Shared",
      normalizedName: "shared",
      prisma,
      userId: owner.userId,
    });
    const target = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      prisma,
      userId: null,
    });
    const ownBook = await seedBook({ prisma, publisherId: source.id, userId: owner.userId });
    const strangerBook = await seedBook({
      prisma,
      publisherId: source.id,
      userId: stranger.userId,
    });

    const res = await mergePublisher(owner.accessToken, source.id, {
      targetPublisherId: target.id,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PUBLISHER_HAS_BOOKS");
    const strangerBookAfter = await prisma.book.findUnique({
      select: { publisherId: true },
      where: { id: strangerBook.id },
    });
    const ownBookAfter = await prisma.book.findUnique({
      select: { publisherId: true },
      where: { id: ownBook.id },
    });
    const sourceAfter = await prisma.publisher.findUnique({ where: { id: source.id } });
    const sourceNames = await prisma.publisherName.count({ where: { publisherId: source.id } });
    expect(strangerBookAfter).toEqual({ publisherId: source.id });
    expect(ownBookAfter).toEqual({ publisherId: source.id });
    expect(sourceAfter).not.toBeNull();
    expect(sourceNames).toBe(1);
  });
});

describe("POST /api/publishers/:sourcePublisherId/merge validation", () => {
  it("returns 400 when the source and the target are the same publisher", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const source = await seedPublisher({ name: "Solo", normalizedName: "solo", prisma, userId });
    const book = await seedBook({ prisma, publisherId: source.id, userId });

    const res = await mergePublisher(accessToken, source.id, { targetPublisherId: source.id });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("PUBLISHER_MERGE_SAME_PUBLISHER");
    const survivor = await prisma.publisher.findUnique({ where: { id: source.id } });
    const untouched = await prisma.book.findUnique({
      select: { publisherId: true },
      where: { id: book.id },
    });
    expect(survivor).not.toBeNull();
    expect(untouched).toEqual({ publisherId: source.id });
  });

  it("returns 400 for a malformed source publisher id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await mergePublisher(accessToken, "not-a-uuid", { targetPublisherId: MISSING_ID });

    expect(res.status).toBe(400);
  });

  it("returns 400 with a field error for a malformed target publisher id", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const source = await seedPublisher({ name: "Solo", normalizedName: "solo", prisma, userId });

    const res = await mergePublisher(accessToken, source.id, { targetPublisherId: "not-a-uuid" });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "targetPublisherId" })]),
    );
  });

  it("returns 400 when the target publisher id is missing from the body", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const source = await seedPublisher({ name: "Solo", normalizedName: "solo", prisma, userId });

    const res = await mergePublisher(accessToken, source.id, {});

    expect(res.status).toBe(400);
  });
});

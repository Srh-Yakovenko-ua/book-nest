import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { PublishersService } from "../application/publishers.service.js";
import { PublishersModule } from "../publishers.module.js";
import { seedPublisher } from "./publisher-library.fixtures.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let publishersService: PublishersService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, PublishersModule]);
  app = context.app;
  prisma = app.get(PrismaService);
  publishersService = app.get(PublishersService);
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

function duplicateCandidates(accessToken: string, query: Record<string, string>): request.Test {
  return request(app.getHttpServer())
    .get("/api/publishers/duplicate-candidates")
    .query(query)
    .set("Authorization", `Bearer ${accessToken}`);
}

function seedVivatWithAlias(): Promise<{ id: string }> {
  return seedPublisher({
    name: "Видавництво Vivat",
    names: [
      {
        isPrimary: true,
        locale: "uk",
        name: "Видавництво Vivat",
        normalizedName: "видавництво vivat",
      },
      { isPrimary: false, locale: "uk", name: "Vivat", normalizedName: "vivat" },
      { isPrimary: false, locale: "ru", name: "Виват", normalizedName: "виват" },
    ],
    normalizedName: "видавництво vivat",
    prisma,
    searchText: "видавництво vivat vivat виват",
    userId: null,
  });
}

describe("GET /api/publishers/duplicate-candidates authentication", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/publishers/duplicate-candidates")
      .query({ name: "Vivat" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/publishers/duplicate-candidates classification", () => {
  it("classifies an identical name as exact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const vivat = await seedPublisher({
      name: "Vivat",
      normalizedName: "vivat",
      prisma,
      userId: null,
    });

    const res = await duplicateCandidates(accessToken, { name: "  VIVAT  " });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: vivat.id, isCustom: false, matchedName: "Vivat", matchKind: "exact", name: "Vivat" },
    ]);
  });

  it("classifies a name that only exists as an alias as alias", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const vivat = await seedVivatWithAlias();

    const res = await duplicateCandidates(accessToken, { name: "Vivat" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: vivat.id,
        isCustom: false,
        matchedName: "Vivat",
        matchKind: "alias",
        name: "Видавництво Vivat",
      },
    ]);
  });

  it("classifies a wrapped catalog name as a strong suggestion", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const laboratory = await seedPublisher({
      name: "Laboratory (publishing)",
      names: [
        {
          isPrimary: true,
          locale: "uk",
          name: "Лабораторія (видавництво)",
          normalizedName: "лабораторія (видавництво)",
        },
        {
          isPrimary: true,
          locale: "en",
          name: "Laboratory (publishing)",
          normalizedName: "laboratory (publishing)",
        },
      ],
      normalizedName: "laboratory (publishing)",
      prisma,
      searchText: "laboratory (publishing) лабораторія (видавництво)",
      userId: null,
    });

    const res = await duplicateCandidates(accessToken, { name: "Лабораторія" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: laboratory.id,
        isCustom: false,
        matchedName: null,
        matchKind: "strong",
        name: "Лабораторія (видавництво)",
      },
    ]);
  });

  it("surfaces a transliterated catalog name as a strong suggestion", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const vivat = await seedPublisher({
      name: "Vivat",
      normalizedName: "vivat",
      prisma,
      userId: null,
    });

    const res = await duplicateCandidates(accessToken, { name: "Віват" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: vivat.id, isCustom: false, matchedName: null, matchKind: "strong", name: "Vivat" },
    ]);
  });

  it("does not suggest publishers that merely look alike", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedPublisher({ name: "Основа", normalizedName: "основа", prisma, userId: null });
    await seedPublisher({
      name: "Penguin Random House",
      normalizedName: "penguin random house",
      prisma,
      userId: null,
    });

    const osnovy = await duplicateCandidates(accessToken, { name: "Основи" });
    const penguin = await duplicateCandidates(accessToken, { name: "Penguin Books" });

    expect(osnovy.body).toEqual([]);
    expect(penguin.body).toEqual([]);
  });
});

describe("GET /api/publishers/duplicate-candidates matched name", () => {
  async function seedLaboratoryWithLocalizedAlias(): Promise<{ id: string }> {
    return seedPublisher({
      name: "Видавництво Лабораторія",
      names: [
        {
          isPrimary: true,
          locale: "uk",
          name: "Видавництво Лабораторія",
          normalizedName: "видавництво лабораторія",
        },
        { isPrimary: true, locale: "en", name: "Laboratory", normalizedName: "laboratory" },
        { isPrimary: false, locale: "uk", name: "LABORATORY", normalizedName: "laboratory" },
      ],
      normalizedName: "видавництво лабораторія",
      prisma,
      searchText: "видавництво лабораторія laboratory",
      userId: null,
    });
  }

  it("picks the requested locale when one publisher holds the matched name twice", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedLaboratoryWithLocalizedAlias();

    const ukrainian = await duplicateCandidates(accessToken, {
      locale: "uk",
      name: "Laboratory",
    });
    const english = await duplicateCandidates(accessToken, { locale: "en", name: "Laboratory" });

    expect(ukrainian.body[0]).toMatchObject({
      matchedName: "LABORATORY",
      matchKind: "alias",
      name: "Видавництво Лабораторія",
    });
    expect(english.body[0]).toMatchObject({
      matchedName: "Laboratory",
      matchKind: "alias",
      name: "Laboratory",
    });
  });
});

describe("GET /api/publishers/duplicate-candidates ordering and exclusion", () => {
  it("returns exact, then alias, then strong", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const exact = await seedPublisher({
      name: "Vivat",
      normalizedName: "vivat",
      prisma,
      userId: null,
    });
    const alias = await seedVivatWithAlias();
    const strong = await seedPublisher({
      name: "Vivat Publishing House",
      normalizedName: "vivat publishing house",
      prisma,
      userId: null,
    });

    const res = await duplicateCandidates(accessToken, { name: "Vivat" });

    expect(res.body.map((candidate: { id: string }) => candidate.id)).toEqual([
      exact.id,
      alias.id,
      strong.id,
    ]);
    expect(res.body.map((candidate: { matchKind: string }) => candidate.matchKind)).toEqual([
      "exact",
      "alias",
      "strong",
    ]);
  });

  it("drops the publisher named by excludePublisherId", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const exact = await seedPublisher({
      name: "Vivat",
      normalizedName: "vivat",
      prisma,
      userId: null,
    });
    const alias = await seedVivatWithAlias();

    const res = await duplicateCandidates(accessToken, {
      excludePublisherId: exact.id,
      name: "Vivat",
    });

    expect(res.body.map((candidate: { id: string }) => candidate.id)).toEqual([alias.id]);
  });

  it("resolves the display name to the requested locale", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedPublisher({
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

    const res = await duplicateCandidates(accessToken, {
      locale: "en",
      name: "Vydavnytstvo Stary Lev",
    });

    expect(res.body[0].name).toBe("Vydavnytstvo Stary Lev");
  });

  it("rejects a name that is too short to be a publisher name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await duplicateCandidates(accessToken, { name: "v" });

    expect(res.status).toBe(400);
  });
});

describe("PublishersService.resolveOrCreate against the database", () => {
  it("reuses the publisher that carries the typed name as an alias instead of cloning it", async () => {
    const { userId } = await context.registerVerifyAndLogin();
    const vivat = await seedVivatWithAlias();

    const resolvedId = await publishersService.resolveOrCreate(userId, { name: "vivat" });

    expect(resolvedId).toBe(vivat.id);
    expect(await prisma.publisher.count({ where: { userId } })).toBe(0);
  });

  it("reuses the exactly matching publisher without creating a custom clone", async () => {
    const { userId } = await context.registerVerifyAndLogin();
    const vivat = await seedPublisher({
      name: "Vivat",
      normalizedName: "vivat",
      prisma,
      userId: null,
    });

    const resolvedId = await publishersService.resolveOrCreate(userId, { name: "  VIVAT  " });

    expect(resolvedId).toBe(vivat.id);
    expect(await prisma.publisher.count({ where: { userId } })).toBe(0);
  });

  it("creates a custom publisher when nothing reliable matches", async () => {
    const { userId } = await context.registerVerifyAndLogin();
    await seedPublisher({ name: "Основа", normalizedName: "основа", prisma, userId: null });

    const resolvedId = await publishersService.resolveOrCreate(userId, { name: "Основи" });

    const created = await prisma.publisher.findFirst({ where: { userId } });
    expect(created?.id).toBe(resolvedId);
    expect(created?.name).toBe("Основи");
  });

  it("refuses to pick when several publishers reliably match the same name", async () => {
    const { userId } = await context.registerVerifyAndLogin();
    const exact = await seedPublisher({
      name: "Vivat",
      normalizedName: "vivat",
      prisma,
      userId: null,
    });
    const alias = await seedVivatWithAlias();

    const failure = publishersService.resolveOrCreate(userId, { name: "Vivat" });

    await expect(failure).rejects.toMatchObject({
      code: "PUBLISHER_AMBIGUOUS_NAME",
      details: { publisherIds: expect.arrayContaining([exact.id, alias.id]) },
      status: 409,
    });
    expect(await prisma.publisher.count({ where: { userId } })).toBe(0);
  });

  it("keeps honouring an explicit id even when the name alone would be ambiguous", async () => {
    const { userId } = await context.registerVerifyAndLogin();
    const exact = await seedPublisher({
      name: "Vivat",
      normalizedName: "vivat",
      prisma,
      userId: null,
    });
    await seedVivatWithAlias();

    const resolvedId = await publishersService.resolveOrCreate(userId, {
      id: exact.id,
      name: "Vivat",
    });

    expect(resolvedId).toBe(exact.id);
  });
});

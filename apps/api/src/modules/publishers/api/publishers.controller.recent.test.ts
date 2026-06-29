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

function getRecent(accessToken: string, query?: string): request.Test {
  const path = query === undefined ? "/api/publishers/recent" : `/api/publishers/recent?${query}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

function seedAuthor(input: { name: string; userId: string }): Promise<{ id: string }> {
  return prisma.author.create({
    data: { name: input.name, normalizedName: input.name.toLowerCase(), userId: input.userId },
    select: { id: true },
  });
}

function seedBook(input: {
  authorId: string;
  createdAt?: Date;
  publisherId: string;
  userId: string;
}): Promise<{ id: string }> {
  return prisma.book.create({
    data: {
      authorId: input.authorId,
      createdAt: input.createdAt,
      publisherId: input.publisherId,
      title: "Untitled",
      userId: input.userId,
    },
    select: { id: true },
  });
}

function seedPublisher(input: {
  name: string;
  names?: { isPrimary: boolean; locale: string; name: string; normalizedName: string }[];
  normalizedName: string;
  searchText?: string;
  userId?: null | string;
}): Promise<{ id: string }> {
  return prisma.publisher.create({
    data: {
      name: input.name,
      names: {
        create: input.names ?? [
          { isPrimary: true, locale: "uk", name: input.name, normalizedName: input.normalizedName },
        ],
      },
      normalizedName: input.normalizedName,
      searchText: input.searchText ?? input.normalizedName,
      userId: input.userId ?? null,
    },
    select: { id: true },
  });
}

describe("GET /api/publishers/recent", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/publishers/recent");

    expect(res.status).toBe(401);
  });

  it("returns an empty array when the user has no books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedPublisher({ name: "Penguin", normalizedName: "penguin", userId: null });

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns distinct publishers ordered by the recency of the books that use them", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const penguin = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      userId: null,
    });
    const vintage = await seedPublisher({
      name: "Vintage",
      normalizedName: "vintage",
      userId: null,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      publisherId: penguin.id,
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      publisherId: vintage.id,
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      publisherId: penguin.id,
      userId,
    });

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.map((publisher: { name: string }) => publisher.name)).toEqual([
      "Penguin",
      "Vintage",
    ]);
  });

  it("caps the number of returned publishers to the requested limit", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    for (const [index, name] of ["Press A", "Press B", "Press C"].entries()) {
      const publisher = await seedPublisher({
        name,
        normalizedName: name.toLowerCase(),
        userId: null,
      });
      await seedBook({
        authorId: author.id,
        createdAt: new Date(`2026-0${index + 1}-01T10:00:00.000Z`),
        publisherId: publisher.id,
        userId,
      });
    }

    const res = await getRecent(accessToken, "limit=2");

    expect(res.body.map((publisher: { name: string }) => publisher.name)).toEqual([
      "Press C",
      "Press B",
    ]);
  });

  it("does not return publishers used only in another user's books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const penguin = await seedPublisher({
      name: "Penguin",
      normalizedName: "penguin",
      userId: null,
    });
    const strangerAuthor = await seedAuthor({ name: "Stranger Author", userId: stranger.userId });
    await seedBook({
      authorId: strangerAuthor.id,
      publisherId: penguin.id,
      userId: stranger.userId,
    });

    const res = await getRecent(owner.accessToken);

    expect(res.body).toEqual([]);
  });

  it("resolves the display name to the requested locale", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
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
      searchText: "vydavnytstvo stary lev видавництво старого лева",
      userId: null,
    });
    await seedBook({ authorId: author.id, publisherId: publisher.id, userId });

    const ukrainian = await getRecent(accessToken, "locale=uk");
    const english = await getRecent(accessToken, "locale=en");

    expect(ukrainian.body[0].name).toBe("Видавництво Старого Лева");
    expect(english.body[0].name).toBe("Vydavnytstvo Stary Lev");
  });

  it("rejects a limit above the allowed maximum", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getRecent(accessToken, "limit=50");

    expect(res.status).toBe(400);
  });
});

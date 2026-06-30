import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { AuthorsModule } from "../authors.module.js";

type SeedAuthorName = { isPrimary: boolean; locale: string; name: string; normalizedName: string };

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

function getRecent(accessToken: string, query?: string): request.Test {
  const path = query === undefined ? "/api/authors/recent" : `/api/authors/recent?${query}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

function recentNames(body: { name: string }[]): string[] {
  return body.map((author) => author.name);
}

function seedAuthor(input: {
  name: string;
  names?: SeedAuthorName[];
  userId?: null | string;
}): Promise<{ id: string; name: string }> {
  return prisma.author.create({
    data: {
      name: input.name,
      names: input.names === undefined ? undefined : { create: input.names },
      normalizedName: input.name.toLowerCase(),
      userId: input.userId ?? null,
    },
    select: { id: true, name: true },
  });
}

function seedBook(input: {
  authorIds: string[];
  createdAt?: Date;
  userId: string;
}): Promise<{ id: string }> {
  return prisma.book.create({
    data: {
      authors: {
        create: input.authorIds.map((authorId, position) => ({ authorId, position })),
      },
      createdAt: input.createdAt,
      title: "Untitled",
      userId: input.userId,
    },
    select: { id: true },
  });
}

describe("GET /api/authors/recent", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/authors/recent");

    expect(res.status).toBe(401);
  });

  it("returns an empty array when the user has no books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedAuthor({ name: "Unused Author", userId: null });

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns distinct authors ordered by the recency of the books that use them", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const alpha = await seedAuthor({ name: "Alpha Author", userId });
    const beta = await seedAuthor({ name: "Beta Author", userId });
    await seedBook({
      authorIds: [alpha.id],
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      userId,
    });
    await seedBook({
      authorIds: [beta.id],
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      userId,
    });
    await seedBook({
      authorIds: [alpha.id],
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      userId,
    });

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(recentNames(res.body)).toEqual(["Alpha Author", "Beta Author"]);
  });

  it("counts a co-author so every distinct author of a book is recent", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const first = await seedAuthor({ name: "First Author", userId });
    const second = await seedAuthor({ name: "Second Author", userId });
    await seedBook({ authorIds: [first.id, second.id], userId });

    const res = await getRecent(accessToken);

    expect(recentNames(res.body).sort()).toEqual(["First Author", "Second Author"]);
  });

  it("caps the number of returned authors to the requested limit", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    for (const [index, name] of ["Author A", "Author B", "Author C"].entries()) {
      const author = await seedAuthor({ name, userId });
      await seedBook({
        authorIds: [author.id],
        createdAt: new Date(`2026-0${index + 1}-01T10:00:00.000Z`),
        userId,
      });
    }

    const res = await getRecent(accessToken, "limit=2");

    expect(recentNames(res.body)).toEqual(["Author C", "Author B"]);
  });

  it("excludes an author used only in another user's books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerAuthor = await seedAuthor({ name: "Owner Author", userId: owner.userId });
    const strangerGlobal = await seedAuthor({ name: "Stranger Global", userId: null });
    await seedBook({ authorIds: [ownerAuthor.id], userId: owner.userId });
    await seedBook({ authorIds: [strangerGlobal.id], userId: stranger.userId });

    const res = await getRecent(owner.accessToken);

    expect(recentNames(res.body)).toEqual(["Owner Author"]);
  });

  it("includes a global author that the user used and marks it not custom", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const global = await seedAuthor({ name: "George Orwell", userId: null });
    await seedBook({ authorIds: [global.id], userId });

    const res = await getRecent(accessToken);

    expect(recentNames(res.body)).toEqual(["George Orwell"]);
    expect(res.body[0].isCustom).toBe(false);
  });

  it("resolves the display name to the requested locale", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const global = await seedAuthor({
      name: "Taras Shevchenko",
      names: [
        {
          isPrimary: true,
          locale: "en",
          name: "Taras Shevchenko",
          normalizedName: "taras shevchenko",
        },
        {
          isPrimary: true,
          locale: "uk",
          name: "Тарас Шевченко",
          normalizedName: "тарас шевченко",
        },
      ],
      userId: null,
    });
    await seedBook({ authorIds: [global.id], userId });

    const ukrainian = await getRecent(accessToken, "locale=uk");
    const english = await getRecent(accessToken, "locale=en");

    expect(ukrainian.body[0].name).toBe("Тарас Шевченко");
    expect(english.body[0].name).toBe("Taras Shevchenko");
  });

  it("rejects a limit above the allowed maximum", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getRecent(accessToken, "limit=50");

    expect(res.status).toBe(400);
  });
});

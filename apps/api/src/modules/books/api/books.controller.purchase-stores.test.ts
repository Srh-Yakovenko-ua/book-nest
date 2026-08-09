import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../books.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule]);
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

type SeedBookInput = {
  authorId: string;
  createdAt?: Date;
  deletedAt?: Date;
  storeName?: Nullable<string>;
  userId: string;
};

type SeedStoreLinkInput = {
  bookId: string;
  createdAt?: Date;
  storeName: string;
  url: string;
  userId: string;
};

function getPurchaseStores(accessToken: string, limit?: number): request.Test {
  const path =
    limit === undefined
      ? "/api/books/purchase-stores"
      : `/api/books/purchase-stores?limit=${limit}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

function seedAuthor(input: { name: string; userId: string }): Promise<{ id: string }> {
  return prisma.author.create({
    data: { name: input.name, normalizedName: input.name.toLowerCase(), userId: input.userId },
    select: { id: true },
  });
}

function seedBook(input: SeedBookInput): Promise<{ id: string }> {
  return prisma.book.create({
    data: {
      authors: { create: [{ authorId: input.authorId, position: 0 }] },
      createdAt: input.createdAt,
      purchaseInfo:
        input.storeName === undefined
          ? undefined
          : { create: { createdAt: input.createdAt, storeName: input.storeName } },
      title: "Untitled",
      userId: input.userId,
      ...(input.deletedAt === undefined ? {} : TRASH_RETENTION.stamp(input.deletedAt)),
    },
    select: { id: true },
  });
}

function seedStoreLink(input: SeedStoreLinkInput): Promise<{ id: string }> {
  return prisma.bookStoreLink.create({
    data: {
      bookId: input.bookId,
      createdAt: input.createdAt,
      storeName: input.storeName,
      url: input.url,
      userId: input.userId,
    },
    select: { id: true },
  });
}

describe("GET /api/books/purchase-stores", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/books/purchase-stores");

    expect(res.status).toBe(401);
  });

  it("returns an empty array when the user has no books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getPurchaseStores(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns distinct store names ordered by when each name was entered", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      storeName: "Yakaboo",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      storeName: "Knyharnya Ye",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      storeName: "Yakaboo",
      userId,
    });

    const res = await getPurchaseStores(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(["Yakaboo", "Knyharnya Ye"]);
  });

  it("returns a store name that exists only in the purchase info", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, storeName: "Bukva", userId });

    const res = await getPurchaseStores(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(["Bukva"]);
  });

  it("returns a store name that exists only in the store links", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedBook({ authorId: author.id, userId });
    await seedStoreLink({
      bookId: book.id,
      storeName: "Knyholove",
      url: "https://knyholove.ua/dune",
      userId,
    });

    const res = await getPurchaseStores(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(["Knyholove"]);
  });

  it("returns a store name present in both tables exactly once", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      storeName: "Yakaboo",
      userId,
    });
    const wanted = await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      userId,
    });
    await seedStoreLink({
      bookId: wanted.id,
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/dune",
      userId,
    });

    const res = await getPurchaseStores(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(["Yakaboo"]);
  });

  it("collapses spellings that differ only by case, keeping the most recent one", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      storeName: "yakaboo",
      userId,
    });
    const wanted = await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      userId,
    });
    await seedStoreLink({
      bookId: wanted.id,
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      storeName: "YAKABOO",
      url: "https://yakaboo.ua/dune",
      userId,
    });
    await seedStoreLink({
      bookId: wanted.id,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      storeName: "Yakaboo",
      url: "https://yakaboo.ua/solaris",
      userId,
    });

    const res = await getPurchaseStores(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(["Yakaboo"]);
  });

  it("ignores the purchase info and store links of a soft-deleted book", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const trashed = await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      deletedAt: new Date("2026-03-02T10:00:00.000Z"),
      storeName: "Trashed Purchase Store",
      userId,
    });
    await seedStoreLink({
      bookId: trashed.id,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      storeName: "Trashed Link Store",
      url: "https://trashed.ua/dune",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      storeName: "Bukva",
      userId,
    });

    const res = await getPurchaseStores(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(["Bukva"]);
  });

  it("ignores null and empty store names", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, storeName: null, userId });
    await seedBook({ authorId: author.id, storeName: "", userId });
    await seedBook({ authorId: author.id, userId });
    await seedBook({ authorId: author.id, storeName: "Bukva", userId });

    const res = await getPurchaseStores(accessToken);

    expect(res.body).toEqual(["Bukva"]);
  });

  it("does not return store names from another user's books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerAuthor = await seedAuthor({ name: "Stranger Author", userId: stranger.userId });
    const strangerBook = await seedBook({
      authorId: strangerAuthor.id,
      storeName: "Secret Store",
      userId: stranger.userId,
    });
    await seedStoreLink({
      bookId: strangerBook.id,
      storeName: "Secret Link Store",
      url: "https://secret.ua/dune",
      userId: stranger.userId,
    });

    const res = await getPurchaseStores(owner.accessToken);

    expect(res.body).toEqual([]);
  });

  it("caps the number of returned store names to the requested limit", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    for (const [index, name] of ["Store A", "Store B", "Store C"].entries()) {
      await seedBook({
        authorId: author.id,
        createdAt: new Date(`2026-0${index + 1}-01T10:00:00.000Z`),
        storeName: name,
        userId,
      });
    }

    const res = await getPurchaseStores(accessToken, 2);

    expect(res.body).toEqual(["Store C", "Store B"]);
  });

  it("caps the union of both sources to the requested limit", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      storeName: "Store A",
      userId,
    });
    const wanted = await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      userId,
    });
    await seedStoreLink({
      bookId: wanted.id,
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      storeName: "Store B",
      url: "https://store-b.ua/dune",
      userId,
    });
    await seedStoreLink({
      bookId: wanted.id,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      storeName: "Store C",
      url: "https://store-c.ua/dune",
      userId,
    });

    const res = await getPurchaseStores(accessToken, 2);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(["Store C", "Store B"]);
  });

  it("rejects a limit above the allowed maximum", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getPurchaseStores(accessToken, 50);

    expect(res.status).toBe(400);
  });
});

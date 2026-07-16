import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
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

type DedicationBook = {
  dedication: string;
  id: string;
  isFavoriteDedication: boolean;
  title: string;
};

type SeedBookInput = {
  authorId: string;
  dedication?: null | string;
  genres?: string[];
  isFavoriteDedication?: boolean;
  readingStatus?: string;
  title?: string;
  userId: string;
};

function getDedications(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/books/dedications")
    .set("Authorization", `Bearer ${accessToken}`);
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
      dedication: input.dedication === undefined ? null : input.dedication,
      genres: input.genres ?? [],
      isFavoriteDedication: input.isFavoriteDedication ?? false,
      readingStatus: input.readingStatus ?? "not_started",
      title: input.title ?? "Untitled",
      userId: input.userId,
    },
    select: { id: true },
  });
}

describe("GET /api/books/dedications", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/books/dedications");

    expect(res.status).toBe(401);
  });

  it("resolves the static dedications route instead of the :id handler", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getDedications(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      books: [],
      summary: {
        favoriteCount: 0,
        finishedCount: 0,
        topAuthor: null,
        topGenre: null,
        totalCount: 0,
        unfinishedCount: 0,
      },
    });
  });

  it("returns only books with a real dedication and a correct summary", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const herbert = await seedAuthor({ name: "Frank Herbert", userId });
    const asimov = await seedAuthor({ name: "Isaac Asimov", userId });

    await seedBook({
      authorId: herbert.id,
      dedication: "For my mother",
      genres: ["memoir", "history"],
      readingStatus: "finished",
      title: "Finished dedication",
      userId,
    });
    await seedBook({
      authorId: asimov.id,
      dedication: "To the reader",
      genres: ["memoir"],
      isFavoriteDedication: true,
      readingStatus: "reading",
      title: "Favorite dedication",
      userId,
    });
    await seedBook({ authorId: herbert.id, dedication: null, title: "No dedication", userId });
    await seedBook({ authorId: herbert.id, dedication: "", title: "Empty dedication", userId });

    await request(app.getHttpServer())
      .post("/api/books")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        authors: [{ name: "Frank Herbert" }],
        dedication: "   ",
        title: "Whitespace dedication",
      });

    const res = await getDedications(accessToken);

    expect(res.status).toBe(200);
    const books: DedicationBook[] = res.body.books;
    expect(books.map((book) => book.title).sort()).toEqual([
      "Favorite dedication",
      "Finished dedication",
    ]);

    const favorite = books.find((book) => book.title === "Favorite dedication");
    const finished = books.find((book) => book.title === "Finished dedication");
    expect(favorite?.isFavoriteDedication).toBe(true);
    expect(favorite?.dedication).toBe("To the reader");
    expect(finished?.isFavoriteDedication).toBe(false);
    expect(finished?.dedication).toBe("For my mother");

    expect(res.body.summary).toEqual({
      favoriteCount: 1,
      finishedCount: 1,
      topAuthor: { count: 1, name: "Frank Herbert" },
      topGenre: { count: 2, genre: "memoir" },
      totalCount: 2,
      unfinishedCount: 1,
    });
  });

  it("never leaks another user's dedications", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerAuthor = await seedAuthor({ name: "Frank Herbert", userId: owner.userId });
    const strangerAuthor = await seedAuthor({ name: "Isaac Asimov", userId: stranger.userId });
    await seedBook({
      authorId: ownerAuthor.id,
      dedication: "For my readers",
      title: "Owner Dedication",
      userId: owner.userId,
    });
    await seedBook({
      authorId: strangerAuthor.id,
      dedication: "Not yours",
      title: "Stranger Dedication",
      userId: stranger.userId,
    });

    const res = await getDedications(owner.accessToken);

    expect(res.status).toBe(200);
    const titles = res.body.books.map((book: DedicationBook) => book.title);
    expect(titles).toEqual(["Owner Dedication"]);
  });
});

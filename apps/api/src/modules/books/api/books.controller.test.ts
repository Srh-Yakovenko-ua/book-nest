import type { INestApplication } from "@nestjs/common";

import { BOOK_SERIES_PART_NUMBER_TAKEN_CODE } from "@app/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MISSING_UUID = "00000000-0000-4000-8000-000000000000";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule]);
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

type SeedGenre = { isDefault?: boolean; key: string; name: string; userId?: null | string };

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function seedGenres(genres: SeedGenre[]): Promise<unknown> {
  return prisma.genre.createMany({
    data: genres.map((genre) => ({
      groupKey: "fiction",
      groupName: "Fiction",
      isDefault: genre.isDefault ?? true,
      key: genre.key,
      name: genre.name,
      normalizedName: genre.name.toLowerCase(),
      userId: genre.userId ?? null,
    })),
  });
}

describe("POST /api/books", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/books")
      .send({ authors: [{ name: "Frank Herbert" }], title: "Dune" });

    expect(res.status).toBe(401);
  });

  it("creates a book with a custom author and publisher and returns the nested view", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      publisherName: "Penguin",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(UUID);
    expect(res.body.title).toBe("Dune");
    expect(res.body.userId).toBe(userId);
    expect(res.body.authors[0]).toMatchObject({ name: "Frank Herbert" });
    expect(res.body.authors[0].id).toMatch(UUID);
    expect(res.body.publisher).toMatchObject({ name: "Penguin" });
    expect(res.body.publisher.id).toMatch(UUID);
    expect(res.body.readingStatus).toBe("not_started");
    expect(res.body.ownershipStatus).toBe("none");
  });

  it("collapses internal whitespace in the title and the custom author name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Сара Дж.  Маас" }],
      description: "Line one\n\nLine   two",
      title: "  The   Assassin's    Blade  ",
    });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("The Assassin's Blade");
    expect(res.body.authors[0].name).toBe("Сара Дж. Маас");
    expect(res.body.description).toBe("Line one\n\nLine two");
  });

  it("rejects a title containing an HTML tag but accepts a bare less-than sign", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const tagged = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune <script>alert(1)</script>",
    });
    expect(tagged.status).toBe(400);
    expect(tagged.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "title" })]),
    );

    const bareLessThan = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Book <3 forever",
    });
    expect(bareLessThan.status).toBe(201);
    expect(bareLessThan.body.title).toBe("Book <3 forever");
  });

  it("creates a book with genres, a non-default language and age category and echoes them back", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedGenres([
      { key: "fentezi", name: "Фентезі" },
      { key: "romantyka", name: "Романтика" },
    ]);

    const res = await createBook(accessToken, {
      ageCategory: "16_plus",
      authors: [{ name: "Frank Herbert" }],
      genres: ["fentezi", "romantyka"],
      language: "english",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.genres).toEqual(["fentezi", "romantyka"]);
    expect(res.body.language).toBe("english");
    expect(res.body.ageCategory).toBe("16_plus");
  });

  it("applies classification defaults when genres, language and age category are omitted", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.genres).toEqual([]);
    expect(res.body.formats).toEqual([]);
    expect(res.body.language).toBe("ukrainian");
    expect(res.body.ageCategory).toBe("not_specified");
  });

  it("creates a book with formats and echoes them back", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      formats: ["paper", "ebook"],
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.formats).toEqual(["paper", "ebook"]);
  });

  it("returns 400 for duplicate formats", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      formats: ["paper", "paper"],
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "formats" })]),
    );
  });

  it("returns 400 for an unknown format value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      formats: ["hardcover"],
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "formats.0" })]),
    );
  });

  it("returns 400 for an unknown genre value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedGenres([{ key: "fentezi", name: "Фентезі" }]);

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      genres: ["not_a_real_genre"],
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "genres.0" })]),
    );
  });

  it("returns 400 pointing at the offending index when a valid and an invalid genre are mixed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedGenres([{ key: "fentezi", name: "Фентезі" }]);

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      genres: ["fentezi", "not_a_real_genre"],
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "genres.1" })]),
    );
  });

  it("rejects a book using another user's custom genre", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedGenres([
      {
        isDefault: false,
        key: "stranger-secret",
        name: "Stranger Secret",
        userId: stranger.userId,
      },
    ]);

    const res = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      genres: ["stranger-secret"],
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "genres.0" })]),
    );
  });

  it("accepts a book using the caller's own custom genre", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenres([{ isDefault: false, key: "comfort-reads", name: "Comfort Reads", userId }]);

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      genres: ["comfort-reads"],
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.genres).toEqual(["comfort-reads"]);
  });

  it("reuses the same author row when the name is given in a different case and spacing", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const first = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const second = await createBook(accessToken, {
      authors: [{ name: "  frank   HERBERT " }],
      title: "Dune Messiah",
    });

    expect(second.body.authors[0].id).toBe(first.body.authors[0].id);
    const authors = await prisma.author.findMany({ where: { userId } });
    expect(authors).toHaveLength(1);
  });

  it("resolves to a single author when two books are created concurrently with the same new name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const [first, second] = await Promise.all([
      createBook(accessToken, { authors: [{ name: "Brand New Author" }], title: "Dune" }),
      createBook(accessToken, { authors: [{ name: "Brand New Author" }], title: "Dune Messiah" }),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.authors[0].id).toBe(first.body.authors[0].id);
    const authors = await prisma.author.findMany({ where: { userId } });
    expect(authors).toHaveLength(1);
  });

  it("returns 400 when no author reference is provided", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, { title: "Dune" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when an author reference mixes id and name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ id: MISSING_UUID, name: "Frank Herbert" }],
      title: "Dune",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown reading status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingStatus: "halfway",
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "readingStatus" })]),
    );
  });

  it("returns 404 when the author id is not visible to the user", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ id: MISSING_UUID }],
      title: "Dune",
    });

    expect(res.status).toBe(404);
  });

  it("creates a book with tags and echoes them back as id and name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      tags: ["dark academia", "slow burn"],
      title: "Dune",
    });

    expect(res.status).toBe(201);
    const names = res.body.tags.map((tag: { name: string }) => tag.name);
    expect(names).toEqual(expect.arrayContaining(["dark academia", "slow burn"]));
    for (const tag of res.body.tags) {
      expect(tag.id).toMatch(UUID);
    }
    const tags = await prisma.tag.findMany({ where: { userId } });
    expect(tags).toHaveLength(2);
  });

  it("applies an empty tags default when tags are omitted", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.tags).toEqual([]);
  });

  it("reuses the same tag row across books when the name differs only in case and spacing", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const first = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      tags: ["dark academia"],
      title: "Dune",
    });
    const second = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      tags: ["  Dark   Academia "],
      title: "Dune Messiah",
    });

    expect(second.body.tags[0].id).toBe(first.body.tags[0].id);
    const tags = await prisma.tag.findMany({ where: { userId } });
    expect(tags).toHaveLength(1);
  });

  it("returns 400 when more than 12 tags are provided", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const tags = Array.from({ length: 13 }, (unused, index) => `tag ${index}`);

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      tags,
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "tags" })]),
    );
  });

  it("returns 400 when tags contain a case-insensitive duplicate", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      tags: ["slow burn", "Slow Burn"],
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "tags" })]),
    );
  });

  it("returns 400 for a tag shorter than the minimum length", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      tags: ["a"],
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "tags.0" })]),
    );
  });

  it("creates a book with edition details and echoes them back", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Rebecca Yarros" }],
      dedication: "To everyone who has been told they are too much",
      illustrator: "Jane Doe",
      isbn: "9780306406157",
      originalTitle: "Fourth Wing",
      pagesCount: 528,
      publicationYear: 2024,
      title: "Четверте крило",
      translator: "John Smith",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      dedication: "To everyone who has been told they are too much",
      illustrator: "Jane Doe",
      isbn: "9780306406157",
      originalTitle: "Fourth Wing",
      pagesCount: 528,
      publicationYear: 2024,
      translator: "John Smith",
    });
  });

  it("accepts a valid digits-only ISBN-10", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      isbn: "0306406152",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.isbn).toBe("0306406152");
  });

  it("returns 400 for an ISBN that contains non-digit characters", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      isbn: "0-306-40615-2",
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "isbn" })]),
    );
  });

  it("returns all edition details as null when they are omitted", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      dedication: null,
      illustrator: null,
      isbn: null,
      originalTitle: null,
      pagesCount: null,
      publicationYear: null,
      translator: null,
    });
  });

  it("returns 400 for an ISBN with an invalid checksum", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      isbn: "9780306406158",
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "isbn" })]),
    );
  });

  it("returns 400 when pagesCount is below the minimum", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 0,
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "pagesCount" })]),
    );
  });

  it("returns 400 when pagesCount exceeds the maximum", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 10001,
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "pagesCount" })]),
    );
  });

  it("returns 400 when publicationYear is too far in the future", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      publicationYear: new Date().getUTCFullYear() + 2,
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "publicationYear" })]),
    );
  });

  it("scopes tag resolution to the caller so two users get separate tag rows for the same name", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const ownerBook = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      tags: ["dark academia"],
      title: "Dune",
    });
    const strangerBook = await createBook(stranger.accessToken, {
      authors: [{ name: "Isaac Asimov" }],
      tags: ["dark academia"],
      title: "Foundation",
    });

    expect(ownerBook.body.tags[0].id).not.toBe(strangerBook.body.tags[0].id);
    const ownerTags = await prisma.tag.findMany({ where: { userId: owner.userId } });
    const strangerTags = await prisma.tag.findMany({ where: { userId: stranger.userId } });
    expect(ownerTags).toHaveLength(1);
    expect(strangerTags).toHaveLength(1);
  });

  it("returns readingProgress as null when none is provided", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.readingProgress).toBeNull();
  });

  it("creates a reading book with reading progress and echoes the provided fields", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingProgress: { currentPage: 120, note: "great so far", startedAt: "2026-02-01" },
      readingStatus: "reading",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.readingProgress).toEqual({
      abandonedAt: null,
      currentPage: 120,
      finishedAt: null,
      impression: null,
      note: "great so far",
      pausedAt: null,
      rating: null,
      startedAt: "2026-02-01",
    });
  });

  it("creates a finished book with a rating, finished date and impression", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingProgress: { finishedAt: "2026-02-05", impression: "loved it", rating: 8.5 },
      readingStatus: "finished",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.readingProgress).toEqual({
      abandonedAt: null,
      currentPage: null,
      finishedAt: "2026-02-05",
      impression: "loved it",
      note: null,
      pausedAt: null,
      rating: 8.5,
      startedAt: null,
    });
  });

  it("does not create a reading-progress row for a not_started status even when progress is sent", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingProgress: { currentPage: 50, startedAt: "2026-02-01" },
      readingStatus: "not_started",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.readingProgress).toBeNull();
    const rows = await prisma.bookReadingProgress.findMany({ where: { bookId: res.body.id } });
    expect(rows).toHaveLength(0);
  });

  it("returns 400 when currentPage exceeds pagesCount", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      pagesCount: 300,
      readingProgress: { currentPage: 301 },
      readingStatus: "reading",
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "readingProgress.currentPage" })]),
    );
  });

  it("returns 400 when a reading date is in the future", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const nextYear = `${new Date().getUTCFullYear() + 1}-01-01`;

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingProgress: { startedAt: nextYear },
      readingStatus: "reading",
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "readingProgress.startedAt" })]),
    );
  });

  it("returns 400 when the rating is above 10", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingProgress: { rating: 10.5 },
      readingStatus: "finished",
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "readingProgress.rating" })]),
    );
  });

  it("returns 400 when the rating is not a multiple of 0.5", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      readingProgress: { rating: 8.3 },
      readingStatus: "finished",
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "readingProgress.rating" })]),
    );
  });

  it("returns all ownership conditional blocks as null for an owned book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.purchaseInfo).toBeNull();
    expect(res.body.deliveryInfo).toBeNull();
    expect(res.body.loanInfo).toBeNull();
  });

  it("creates a want_to_buy book with purchase info and echoes the price as a number", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "want_to_buy",
      purchaseInfo: { currency: "UAH", expectedPrice: 299.99, storeName: "Yakaboo" },
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.purchaseInfo).toEqual({
      currency: "UAH",
      expectedPrice: 299.99,
      note: null,
      storeName: "Yakaboo",
      storeUrl: null,
    });
    expect(res.body.deliveryInfo).toBeNull();
    expect(res.body.loanInfo).toBeNull();
  });

  it("ignores a non-matching conditional block sent for a want_to_buy book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { personName: "Olha" },
      ownershipStatus: "want_to_buy",
      purchaseInfo: { storeName: "Yakaboo" },
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.purchaseInfo).toMatchObject({ storeName: "Yakaboo" });
    expect(res.body.loanInfo).toBeNull();
  });

  it("defaults the delivery status to ordered for an in_transit book without one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      deliveryInfo: { orderNumber: "TTN-1", storeName: "Yakaboo" },
      ownershipStatus: "in_transit",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.deliveryInfo).toMatchObject({
      deliveryStatus: "ordered",
      orderNumber: "TTN-1",
      storeName: "Yakaboo",
    });
  });

  it("returns 400 when expectedDeliveryDate is before orderDate", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      deliveryInfo: { expectedDeliveryDate: "2026-02-01", orderDate: "2026-02-10" },
      ownershipStatus: "in_transit",
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "deliveryInfo.expectedDeliveryDate" }),
      ]),
    );
  });

  it("creates a borrowed_from_someone book with loan info", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { loanDate: "2026-02-01", personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.loanInfo).toEqual({
      expectedReturnDate: null,
      loanDate: "2026-02-01",
      note: null,
      personName: "Olha",
    });
  });

  it("creates a lent_to_someone book with loan info", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { personName: "Olha" },
      ownershipStatus: "lent_to_someone",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.loanInfo).toMatchObject({ personName: "Olha" });
  });

  it("returns 400 for a borrowed book without loan info", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "loanInfo.personName" })]),
    );
  });

  it("returns 400 when expectedReturnDate is before loanDate", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { expectedReturnDate: "2026-02-01", loanDate: "2026-02-10", personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "loanInfo.expectedReturnDate" })]),
    );
  });
});

describe("POST /api/books series handling", () => {
  function searchSeries(accessToken: string, search?: string): request.Test {
    const path = search === undefined ? "/api/series" : `/api/series?search=${search}`;
    return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
  }

  it("creates a solo book with a null series and part number", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      bookType: "solo",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.bookType).toBe("solo");
    expect(res.body.series).toBeNull();
    expect(res.body.partNumber).toBeNull();
  });

  it("creates a series_part with a new series and exposes it in the series search", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass", status: "ongoing", totalBooks: 3 },
      partNumber: 1,
      title: "Throne of Glass",
    });

    expect(res.status).toBe(201);
    expect(res.body.bookType).toBe("series_part");
    expect(res.body.partNumber).toBe(1);
    expect(res.body.series).toMatchObject({
      booksInSeries: 1,
      name: "Throne of Glass",
      status: "ongoing",
      totalBooks: 3,
    });
    expect(res.body.series.id).toMatch(UUID);

    const seriesRows = await prisma.series.findMany({ where: { userId } });
    expect(seriesRows).toHaveLength(1);

    const searchRes = await searchSeries(accessToken, "throne");
    expect(searchRes.body.totalCount).toBe(1);
    expect(searchRes.body.items[0].name).toBe("Throne of Glass");
  });

  it("links a series_part to an existing series by id", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await prisma.author.create({
      data: { name: "Sarah J. Maas", normalizedName: "sarah j maas", userId },
    });
    const existing = await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", userId },
    });
    await prisma.book.create({
      data: {
        authors: { create: [{ authorId: author.id, position: 0 }] },
        partNumber: 1,
        seriesId: existing.id,
        title: "Throne of Glass",
        userId,
      },
    });

    const res = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 2,
      seriesId: existing.id,
      title: "Crown of Midnight",
    });

    expect(res.status).toBe(201);
    expect(res.body.series.id).toBe(existing.id);
    expect(res.body.series.booksInSeries).toBe(2);
    expect(res.body.partNumber).toBe(2);
    const seriesRows = await prisma.series.findMany({ where: { userId } });
    expect(seriesRows).toHaveLength(1);
  });

  it("reports finishedInSeries live across the series search and the embedded book series", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const first = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass", status: "ongoing", totalBooks: 3 },
      partNumber: 1,
      readingProgress: { finishedAt: "2026-02-05" },
      readingStatus: "finished",
      title: "Throne of Glass",
    });
    const seriesId = first.body.series.id;
    expect(first.body.series).toMatchObject({ booksInSeries: 1, finishedInSeries: 1 });

    await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 2,
      readingStatus: "reading",
      seriesId,
      title: "Crown of Midnight",
    });

    const search = await searchSeries(accessToken, "throne");
    expect(search.body.items[0]).toMatchObject({ booksInSeries: 2, finishedInSeries: 1 });

    const read = await request(app.getHttpServer())
      .get(`/api/books/${first.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(read.body.series).toMatchObject({ booksInSeries: 2, finishedInSeries: 1 });
  });

  it("rejects a second book reusing a part number already taken in the series", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await prisma.author.create({
      data: { name: "Sarah J. Maas", normalizedName: "sarah j maas", userId },
    });
    const existing = await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", userId },
    });
    const conflicting = await prisma.book.create({
      data: {
        authors: { create: [{ authorId: author.id, position: 0 }] },
        partNumber: 1,
        seriesId: existing.id,
        title: "Throne of Glass",
        userId,
      },
    });

    const duplicate = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 1,
      seriesId: existing.id,
      title: "Crown of Midnight",
    });

    expect(duplicate.status).toBe(400);
    expect(duplicate.body.errorsMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: BOOK_SERIES_PART_NUMBER_TAKEN_CODE,
          field: "partNumber",
          meta: { bookId: conflicting.id, bookTitle: "Throne of Glass", partNumber: "1" },
        }),
      ]),
    );
    expect(await prisma.book.count({ where: { seriesId: existing.id } })).toBe(1);

    const unique = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 2,
      seriesId: existing.id,
      title: "Crown of Midnight",
    });

    expect(unique.status).toBe(201);
    expect(unique.body.partNumber).toBe(2);
  });

  it("returns 400 for a series_part without a part number", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass" },
      title: "Throne of Glass",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "partNumber" })]),
    );
  });

  it("returns 400 for a series_part with neither an existing series nor a new one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 1,
      title: "Throne of Glass",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "newSeries" })]),
    );
  });

  it("returns 400 for a series_part with both an existing series and a new one", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const existing = await prisma.series.create({
      data: { name: "Existing", normalizedName: "existing", userId },
    });

    const res = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass" },
      partNumber: 1,
      seriesId: existing.id,
      title: "Throne of Glass",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "newSeries" })]),
    );
  });

  it("returns 400 when the part number is greater than the new series total books", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass", totalBooks: 2 },
      partNumber: 3,
      title: "Throne of Glass",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "partNumber" })]),
    );
  });

  it("returns 400 when the part number exceeds the existing series total books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const existing = await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", totalBooks: 2, userId },
    });

    const res = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 3,
      seriesId: existing.id,
      title: "Heir of Fire",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "partNumber" })]),
    );
    expect(await prisma.book.count({ where: { seriesId: existing.id } })).toBe(0);
  });

  it("accepts a part number equal to the existing series total books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const existing = await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", totalBooks: 2, userId },
    });

    const res = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 2,
      seriesId: existing.id,
      title: "Crown of Midnight",
    });

    expect(res.status).toBe(201);
    expect(res.body.partNumber).toBe(2);
    expect(res.body.series.id).toBe(existing.id);
  });

  it("returns 404 when linking to a series owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerSeries = await prisma.series.create({
      data: { name: "Owner Series", normalizedName: "owner series", userId: owner.userId },
    });

    const res = await createBook(stranger.accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 1,
      seriesId: ownerSeries.id,
      title: "Steal",
    });

    expect(res.status).toBe(404);
  });

  it("ignores series fields for a solo book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      bookType: "solo",
      newSeries: { name: "Ignored" },
      partNumber: 9,
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.bookType).toBe("solo");
    expect(res.body.series).toBeNull();
    expect(res.body.partNumber).toBeNull();
  });
});

describe("POST /api/books organization", () => {
  function searchLists(accessToken: string, search?: string): request.Test {
    const path = search === undefined ? "/api/lists" : `/api/lists?search=${search}`;
    return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
  }

  it("does not add a book to the queue by default", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.isInReadingQueue).toBe(false);
    expect(res.body.queuePriority).toBeNull();
  });

  it("adds a book to the queue with the default normal priority", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.isInReadingQueue).toBe(true);
    expect(res.body.queuePriority).toBe("normal");
  });

  it("echoes back a provided high queue priority", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      queuePriority: "high",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.queuePriority).toBe("high");
  });

  it("appends a second queued book after the first", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();

    const first = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const second = await createBook(accessToken, {
      addToReadingQueue: true,
      authors: [{ name: "Frank Herbert" }],
      queuePriority: "high",
      title: "Dune Messiah",
    });

    expect(first.body.isInReadingQueue).toBe(true);
    expect(second.body.isInReadingQueue).toBe(true);
    expect(second.body.queuePriority).toBe("high");

    const rows = await prisma.book.findMany({
      orderBy: { queuePosition: "asc" },
      where: { userId },
    });
    const positions = rows.map((book) => book.queuePosition);
    expect(positions).toEqual([1, 2]);
  });

  it("does not enqueue a want_to_read book when addToReadingQueue is false", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBook(accessToken, {
      addToReadingQueue: false,
      authors: [{ name: "Frank Herbert" }],
      readingStatus: "want_to_read",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.readingStatus).toBe("want_to_read");
    expect(res.body.isInReadingQueue).toBe(false);
    expect(res.body.queuePriority).toBeNull();
  });

  it("adds the book to an existing list and a new list and exposes the new one in the list search", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const existing = await prisma.bookList.create({
      data: { name: "Gifts", normalizedName: "gifts", userId },
    });

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [existing.id],
      newLists: [{ description: "cozy", name: "Autumn reads" }],
      title: "Dune",
    });

    expect(res.status).toBe(201);
    const listNames = res.body.lists.map((list: { name: string }) => list.name);
    expect(listNames).toEqual(expect.arrayContaining(["Gifts", "Autumn reads"]));

    const lists = await prisma.bookList.findMany({ where: { userId } });
    expect(lists).toHaveLength(2);

    const searchRes = await searchLists(accessToken, "autumn");
    expect(searchRes.body.totalCount).toBe(1);
    expect(searchRes.body.items[0]).toMatchObject({ description: "cozy", name: "Autumn reads" });
  });

  it("returns 404 when adding the book to a list owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const ownerList = await prisma.bookList.create({
      data: { name: "Owner List", normalizedName: "owner list", userId: owner.userId },
    });

    const res = await createBook(stranger.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [ownerList.id],
      title: "Dune",
    });

    expect(res.status).toBe(404);
  });

  it("does not duplicate the book-to-list link when the same list is given twice", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const existing = await prisma.bookList.create({
      data: { name: "Autumn reads", normalizedName: "autumn reads", userId },
    });

    const res = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      listIds: [existing.id],
      newLists: [{ name: "  autumn   reads " }],
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.lists).toHaveLength(1);

    const items = await prisma.bookListItem.findMany({ where: { bookId: res.body.id } });
    expect(items).toHaveLength(1);

    const lists = await prisma.bookList.findMany({ where: { userId } });
    expect(lists).toHaveLength(1);
  });
});

describe("GET /api/books", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/books");

    expect(res.status).toBe(401);
  });

  it("returns only the caller's own books", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await createBook(owner.accessToken, { authors: [{ name: "Frank Herbert" }], title: "Dune" });
    await createBook(stranger.accessToken, {
      authors: [{ name: "Isaac Asimov" }],
      title: "Foundation",
    });

    const res = await request(app.getHttpServer())
      .get("/api/books")
      .set("Authorization", `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe("Dune");
  });

  it("paginates with correct totalCount and pagesCount", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    for (let index = 0; index < 3; index += 1) {
      await createBook(accessToken, {
        authors: [{ name: `Author ${index}` }],
        title: `Book ${index}`,
      });
    }

    const res = await request(app.getHttpServer())
      .get("/api/books?pageNumber=1&pageSize=2")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pagesCount: 2, pageSize: 2, totalCount: 3 });
    expect(res.body.items).toHaveLength(2);
  });
});

describe("GET /api/books/:id", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(`/api/books/${MISSING_UUID}`);

    expect(res.status).toBe(401);
  });

  it("returns 404 for a book owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await request(app.getHttpServer())
      .get(`/api/books/${created.body.id}`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/books/:id genres", () => {
  function updateBook(
    accessToken: string,
    bookId: string,
    body: Record<string, unknown>,
  ): request.Test {
    return request(app.getHttpServer())
      .patch(`/api/books/${bookId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(body);
  }

  it("updates a book with a valid seeded genre and echoes it back", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedGenres([{ key: "fentezi", name: "Фентезі" }]);
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { genres: ["fentezi"] });

    expect(res.status).toBe(200);
    expect(res.body.genres).toEqual(["fentezi"]);
  });

  it("returns 400 when updating a book with an unknown genre", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedGenres([{ key: "fentezi", name: "Фентезі" }]);
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await updateBook(accessToken, created.body.id, { genres: ["not_a_real_genre"] });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "genres.0" })]),
    );
  });
});

describe("PATCH /api/books/:id series", () => {
  function updateBook(
    accessToken: string,
    bookId: string,
    body: Record<string, unknown>,
  ): request.Test {
    return request(app.getHttpServer())
      .patch(`/api/books/${bookId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(body);
  }

  it("returns 400 when the part number exceeds the existing series total books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const existing = await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", totalBooks: 2, userId },
    });
    const created = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      title: "Heir of Fire",
    });

    const res = await updateBook(accessToken, created.body.id, {
      bookType: "series_part",
      partNumber: 3,
      seriesId: existing.id,
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "partNumber" })]),
    );
  });

  it("accepts a part number equal to the existing series total books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const existing = await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", totalBooks: 2, userId },
    });
    const created = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      title: "Crown of Midnight",
    });

    const res = await updateBook(accessToken, created.body.id, {
      bookType: "series_part",
      partNumber: 2,
      seriesId: existing.id,
    });

    expect(res.status).toBe(200);
    expect(res.body.partNumber).toBe(2);
    expect(res.body.series.id).toBe(existing.id);
  });

  it("returns 400 when bumping only the part number above the current series total books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const existing = await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", totalBooks: 2, userId },
    });
    const created = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 1,
      seriesId: existing.id,
      title: "Throne of Glass",
    });

    const res = await updateBook(accessToken, created.body.id, { partNumber: 3 });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "partNumber" })]),
    );
  });

  it("accepts bumping only the part number to the current series total books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const existing = await prisma.series.create({
      data: { name: "Throne of Glass", normalizedName: "throne of glass", totalBooks: 2, userId },
    });
    const created = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      partNumber: 1,
      seriesId: existing.id,
      title: "Throne of Glass",
    });

    const res = await updateBook(accessToken, created.body.id, { partNumber: 2 });

    expect(res.status).toBe(200);
    expect(res.body.partNumber).toBe(2);
  });
});

describe("DELETE /api/books/:id", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).delete(`/api/books/${MISSING_UUID}`);

    expect(res.status).toBe(401);
  });

  it("returns 404 when deleting a book owned by another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await request(app.getHttpServer())
      .delete(`/api/books/${created.body.id}`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 204 on the owner's book and then 404 on a follow-up read", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/books/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(204);

    const readRes = await request(app.getHttpServer())
      .get(`/api/books/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(readRes.status).toBe(404);
  });

  it("drops the series book count after the book is deleted", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Sarah J. Maas" }],
      bookType: "series_part",
      newSeries: { name: "Throne of Glass" },
      partNumber: 1,
      readingProgress: { finishedAt: "2026-02-05" },
      readingStatus: "finished",
      title: "Throne of Glass",
    });
    const seriesId = created.body.series.id;

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/books/${created.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(204);

    const search = await request(app.getHttpServer())
      .get("/api/series")
      .set("Authorization", `Bearer ${accessToken}`);
    const series = search.body.items.find((item: { id: string }) => item.id === seriesId);
    expect(series).toMatchObject({ booksInSeries: 0, finishedInSeries: 0 });
  });
});

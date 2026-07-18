import type { Nullable } from "@app/shared";
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

type SeedAuthorName = { locale: string; name: string };

type SeedBookInput = {
  ageCategory?: string;
  authorId: string;
  coAuthorIds?: string[];
  coverMediaId?: Nullable<string>;
  createdAt?: Date;
  favoriteAddedAt?: Nullable<Date>;
  firstAuthorName?: string;
  formats?: string[];
  genres?: string[];
  illustrator?: Nullable<string>;
  isbn?: Nullable<string>;
  isFavorite?: boolean;
  language?: string;
  originalTitle?: Nullable<string>;
  ownershipStatus?: string;
  pagesCount?: Nullable<number>;
  partNumber?: Nullable<number>;
  publicationYear?: Nullable<number>;
  publisherId?: Nullable<string>;
  rating?: number;
  readingStatus?: string;
  seriesId?: Nullable<string>;
  tagIds?: string[];
  title?: string;
  translator?: Nullable<string>;
  userId: string;
};

function authorJoinCreate(
  authorId: string,
  coAuthorIds: string[] | undefined,
): { authorId: string; position: number }[] {
  return [authorId, ...(coAuthorIds ?? [])].map((id, position) => ({ authorId: id, position }));
}

function listBooks(accessToken: string, query = ""): request.Test {
  const path = query === "" ? "/api/books" : `/api/books?${query}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

function seedAuthor(input: {
  name: string;
  names?: SeedAuthorName[];
  userId: string;
}): Promise<{ id: string; name: string }> {
  return prisma.author.create({
    data: {
      name: input.name,
      names:
        input.names === undefined
          ? undefined
          : {
              create: input.names.map((entry) => ({
                locale: entry.locale,
                name: entry.name,
                normalizedName: entry.name.toLowerCase(),
              })),
            },
      normalizedName: input.name.toLowerCase(),
      userId: input.userId,
    },
    select: { id: true, name: true },
  });
}

function seedBook(input: SeedBookInput): Promise<{ id: string }> {
  return prisma.book.create({
    data: {
      ageCategory: input.ageCategory ?? "not_specified",
      authors: { create: authorJoinCreate(input.authorId, input.coAuthorIds) },
      coverMediaId: input.coverMediaId ?? null,
      createdAt: input.createdAt,
      favoriteAddedAt: input.favoriteAddedAt ?? null,
      firstAuthorName: input.firstAuthorName ?? "",
      formats: input.formats ?? [],
      genres: input.genres ?? [],
      illustrator: input.illustrator ?? null,
      isbn: input.isbn ?? null,
      isFavorite: input.isFavorite ?? false,
      language: input.language ?? "ukrainian",
      originalTitle: input.originalTitle ?? null,
      ownershipStatus: input.ownershipStatus ?? "none",
      pagesCount: input.pagesCount ?? null,
      partNumber: input.partNumber ?? null,
      publicationYear: input.publicationYear ?? null,
      publisherId: input.publisherId ?? null,
      readingProgress:
        input.rating === undefined ? undefined : { create: { rating: input.rating } },
      readingStatus: input.readingStatus ?? "not_started",
      seriesId: input.seriesId ?? null,
      tags:
        input.tagIds === undefined
          ? undefined
          : { create: input.tagIds.map((tagId) => ({ tagId })) },
      title: input.title ?? "Untitled",
      translator: input.translator ?? null,
      userId: input.userId,
    },
    select: { id: true },
  });
}

function seedGenre(input: {
  key: string;
  name: string;
  userId?: Nullable<string>;
}): Promise<unknown> {
  return prisma.genre.create({
    data: {
      groupKey: "fiction",
      groupName: "Fiction",
      isDefault: input.userId === undefined,
      key: input.key,
      name: input.name,
      normalizedName: input.name.toLowerCase(),
      userId: input.userId ?? null,
    },
  });
}

function seedMedia(input: { userId: string }): Promise<{ id: string }> {
  return prisma.mediaAsset.create({
    data: {
      contentType: "image/webp",
      height: 90,
      kind: "book_cover",
      sizeBytes: 1000,
      storageKey: `covers/${input.userId}/${Date.now()}`,
      userId: input.userId,
      width: 60,
    },
    select: { id: true },
  });
}

function seedNullRatingProgress(bookId: string): Promise<unknown> {
  return prisma.bookReadingProgress.create({ data: { bookId, rating: null } });
}

function seedPublisher(input: {
  name: string;
  names?: SeedAuthorName[];
  userId: string;
}): Promise<{ id: string }> {
  return prisma.publisher.create({
    data: {
      name: input.name,
      names:
        input.names === undefined
          ? undefined
          : {
              create: input.names.map((entry) => ({
                locale: entry.locale,
                name: entry.name,
                normalizedName: entry.name.toLowerCase(),
              })),
            },
      normalizedName: input.name.toLowerCase(),
      userId: input.userId,
    },
    select: { id: true },
  });
}

function seedSeries(input: { name: string; userId: string }): Promise<{ id: string }> {
  return prisma.series.create({
    data: { name: input.name, normalizedName: input.name.toLowerCase(), userId: input.userId },
    select: { id: true },
  });
}

function seedTag(input: { name: string; userId: string }): Promise<{ id: string }> {
  return prisma.tag.create({
    data: { name: input.name, normalizedName: input.name.toLowerCase(), userId: input.userId },
    select: { id: true },
  });
}

function titlesOf(body: { items: { title: string }[] }): string[] {
  return body.items.map((item) => item.title);
}

describe("GET /api/books search", () => {
  it("matches the book title case-insensitively", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, title: "Dune", userId });
    await seedBook({ authorId: author.id, title: "Foundation", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("DUNE")}`);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });

  it("matches the original title", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      originalTitle: "Fourth Wing",
      title: "Четверте крило",
      userId,
    });
    await seedBook({ authorId: author.id, title: "Foundation", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("fourth")}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Четверте крило"]);
  });

  it("matches the primary author name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const herbert = await seedAuthor({ name: "Frank Herbert", userId });
    const asimov = await seedAuthor({ name: "Isaac Asimov", userId });
    await seedBook({ authorId: herbert.id, title: "Dune", userId });
    await seedBook({ authorId: asimov.id, title: "Foundation", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("herbert")}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });

  it("matches a localized author name from the names relation", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({
      name: "Frank Herbert",
      names: [{ locale: "uk", name: "Френк Герберт" }],
      userId,
    });
    await seedBook({ authorId: author.id, title: "Dune", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("Герберт")}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });

  it("matches a co-author who is not the first listed author", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const main = await seedAuthor({ name: "Frank Herbert", userId });
    const coAuthor = await seedAuthor({ name: "Brian Sanderson", userId });
    const other = await seedAuthor({ name: "Isaac Asimov", userId });
    await seedBook({ authorId: main.id, coAuthorIds: [coAuthor.id], title: "Dune", userId });
    await seedBook({ authorId: other.id, title: "Foundation", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("Sanderson")}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });

  it("matches the series name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Sarah J. Maas", userId });
    const series = await seedSeries({ name: "Throne of Glass", userId });
    await seedBook({
      authorId: author.id,
      partNumber: 1,
      seriesId: series.id,
      title: "Crown",
      userId,
    });
    await seedBook({ authorId: author.id, title: "Standalone", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("throne")}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Crown"]);
  });

  it("matches the publisher name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const publisher = await seedPublisher({ name: "Penguin Books", userId });
    await seedBook({ authorId: author.id, publisherId: publisher.id, title: "Dune", userId });
    await seedBook({ authorId: author.id, title: "Foundation", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("penguin")}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });

  it("matches a localized publisher name from the names relation", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const publisher = await seedPublisher({
      name: "Vivat",
      names: [{ locale: "uk", name: "Віват" }],
      userId,
    });
    await seedBook({ authorId: author.id, publisherId: publisher.id, title: "Dune", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("Віват")}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });

  it("matches a tag name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const tag = await seedTag({ name: "dark academia", userId });
    await seedBook({ authorId: author.id, tagIds: [tag.id], title: "Dune", userId });
    await seedBook({ authorId: author.id, title: "Foundation", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("academia")}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });

  it("matches the translator and illustrator", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, title: "Dune", translator: "John Smith", userId });
    await seedBook({ authorId: author.id, illustrator: "Jane Doe", title: "Foundation", userId });

    const byTranslator = await listBooks(accessToken, `q=${encodeURIComponent("smith")}`);
    expect(titlesOf(byTranslator.body)).toEqual(["Dune"]);

    const byIllustrator = await listBooks(accessToken, `q=${encodeURIComponent("jane")}`);
    expect(titlesOf(byIllustrator.body)).toEqual(["Foundation"]);
  });

  it("matches an ISBN even when the query has hyphens and spaces", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, isbn: "9780306406157", title: "Dune", userId });
    await seedBook({ authorId: author.id, title: "Foundation", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("978-0-306 40615 7")}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });

  it("matches by genre when the query hits a genre display name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGenre({ key: "fentezi", name: "Фентезі" });
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, genres: ["fentezi"], title: "Dune", userId });
    await seedBook({ authorId: author.id, title: "Foundation", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("Фентезі")}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });

  it("returns books that match the term in any single searchable field", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const titleAuthor = await seedAuthor({ name: "Rebecca Yarros", userId });
    const nameAuthor = await seedAuthor({ name: "Olivia Wingfield", userId });
    await seedBook({ authorId: titleAuthor.id, title: "Fourth Wing", userId });
    await seedBook({ authorId: nameAuthor.id, title: "Powerless", userId });
    await seedBook({ authorId: titleAuthor.id, title: "Iron Flame", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("wing")}`);

    expect(res.body.totalCount).toBe(2);
    expect(titlesOf(res.body).sort()).toEqual(["Fourth Wing", "Powerless"]);
  });

  it("combines the search term with an active filter using AND", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, readingStatus: "reading", title: "Dune", userId });
    await seedBook({
      authorId: author.id,
      readingStatus: "finished",
      title: "Dune Messiah",
      userId,
    });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("dune")}&status=reading`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });

  it("ignores a whitespace-only query and returns the whole library", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, title: "Dune", userId });
    await seedBook({ authorId: author.id, title: "Foundation", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("   ")}`);

    expect(res.body.totalCount).toBe(2);
  });

  it("returns an empty page when nothing matches", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, title: "Dune", userId });

    const res = await listBooks(accessToken, `q=${encodeURIComponent("nonexistent term")}`);

    expect(res.body.totalCount).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  it("never returns another user's books for a matching term", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerAuthor = await seedAuthor({ name: "Frank Herbert", userId: stranger.userId });
    await seedBook({ authorId: strangerAuthor.id, title: "Dune", userId: stranger.userId });

    const res = await listBooks(owner.accessToken, `q=${encodeURIComponent("dune")}`);

    expect(res.body.totalCount).toBe(0);
  });
});

describe("GET /api/books filters", () => {
  it("filters by reading status with OR semantics inside the group", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, readingStatus: "reading", title: "A", userId });
    await seedBook({ authorId: author.id, readingStatus: "finished", title: "B", userId });
    await seedBook({ authorId: author.id, readingStatus: "want_to_read", title: "C", userId });

    const res = await listBooks(accessToken, "status=reading,finished");

    expect(res.body.totalCount).toBe(2);
    expect(titlesOf(res.body).sort()).toEqual(["A", "B"]);
  });

  it("combines two filter groups with AND semantics", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      formats: ["ebook"],
      readingStatus: "reading",
      title: "Match",
      userId,
    });
    await seedBook({
      authorId: author.id,
      formats: ["paper"],
      readingStatus: "reading",
      title: "WrongFormat",
      userId,
    });
    await seedBook({
      authorId: author.id,
      formats: ["ebook"],
      readingStatus: "finished",
      title: "WrongStatus",
      userId,
    });

    const res = await listBooks(accessToken, "status=reading&format=ebook");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Match"]);
  });

  it("filters by ownership status", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, ownershipStatus: "owned", title: "Owned", userId });
    await seedBook({
      authorId: author.id,
      ownershipStatus: "want_to_buy",
      title: "Wishlist",
      userId,
    });

    const res = await listBooks(accessToken, "owner=owned");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Owned"]);
  });

  it("filters by format matching any of the selected formats", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, formats: ["audiobook"], title: "Audio", userId });
    await seedBook({ authorId: author.id, formats: ["paper"], title: "Paper", userId });

    const res = await listBooks(accessToken, "format=audiobook,ebook");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Audio"]);
  });

  it("filters by genre key", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, genres: ["fentezi"], title: "Fantasy", userId });
    await seedBook({ authorId: author.id, genres: ["romantyka"], title: "Romance", userId });

    const res = await listBooks(accessToken, "genre=fentezi");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Fantasy"]);
  });

  it("filters by tag id", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const tag = await seedTag({ name: "dragons", userId });
    await seedBook({ authorId: author.id, tagIds: [tag.id], title: "Tagged", userId });
    await seedBook({ authorId: author.id, title: "Untagged", userId });

    const res = await listBooks(accessToken, `tag=${tag.id}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Tagged"]);
  });

  it("filters by author id", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const wanted = await seedAuthor({ name: "Frank Herbert", userId });
    const other = await seedAuthor({ name: "Isaac Asimov", userId });
    await seedBook({ authorId: wanted.id, title: "Dune", userId });
    await seedBook({ authorId: other.id, title: "Foundation", userId });

    const res = await listBooks(accessToken, `author=${wanted.id}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });

  it("matches a book whose filtered author is a non-first co-author", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const main = await seedAuthor({ name: "Frank Herbert", userId });
    const wanted = await seedAuthor({ name: "Kevin J. Anderson", userId });
    const other = await seedAuthor({ name: "Isaac Asimov", userId });
    await seedBook({ authorId: main.id, coAuthorIds: [wanted.id], title: "Dune", userId });
    await seedBook({ authorId: other.id, title: "Foundation", userId });

    const res = await listBooks(accessToken, `author=${wanted.id}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });

  it("filters by publisher id", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const wanted = await seedPublisher({ name: "Penguin", userId });
    const other = await seedPublisher({ name: "Vivat", userId });
    await seedBook({ authorId: author.id, publisherId: wanted.id, title: "Dune", userId });
    await seedBook({ authorId: author.id, publisherId: other.id, title: "Other", userId });

    const res = await listBooks(accessToken, `publisher=${wanted.id}`);

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });

  it("filters by age category", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ ageCategory: "16_plus", authorId: author.id, title: "Teen", userId });
    await seedBook({ ageCategory: "6_plus", authorId: author.id, title: "Kids", userId });

    const res = await listBooks(accessToken, "ageCategory=16_plus");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Teen"]);
  });

  it("filters by language", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, language: "english", title: "English", userId });
    await seedBook({ authorId: author.id, language: "ukrainian", title: "Ukrainian", userId });

    const res = await listBooks(accessToken, "language=english");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["English"]);
  });

  it("filters solo books only", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Sarah J. Maas", userId });
    const series = await seedSeries({ name: "Throne of Glass", userId });
    await seedBook({ authorId: author.id, title: "Solo", userId });
    await seedBook({
      authorId: author.id,
      partNumber: 1,
      seriesId: series.id,
      title: "Part",
      userId,
    });

    const res = await listBooks(accessToken, "bookType=solo");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Solo"]);
  });

  it("filters series part books only", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Sarah J. Maas", userId });
    const series = await seedSeries({ name: "Throne of Glass", userId });
    await seedBook({ authorId: author.id, title: "Solo", userId });
    await seedBook({
      authorId: author.id,
      partNumber: 1,
      seriesId: series.id,
      title: "Part",
      userId,
    });

    const res = await listBooks(accessToken, "bookType=series_part");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Part"]);
  });

  it("filters favorites only", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, isFavorite: true, title: "Loved", userId });
    await seedBook({ authorId: author.id, isFavorite: false, title: "Plain", userId });

    const res = await listBooks(accessToken, "isFavorite=true");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Loved"]);
  });

  it("filters non-favorites only", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, isFavorite: true, title: "Loved", userId });
    await seedBook({ authorId: author.id, isFavorite: false, title: "Plain", userId });

    const res = await listBooks(accessToken, "isFavorite=false");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Plain"]);
  });

  it("filters books that have a cover", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const media = await seedMedia({ userId });
    await seedBook({ authorId: author.id, coverMediaId: media.id, title: "Covered", userId });
    await seedBook({ authorId: author.id, title: "Bare", userId });

    const res = await listBooks(accessToken, "hasCover=true");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Covered"]);
  });

  it("filters books that have no cover", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const media = await seedMedia({ userId });
    await seedBook({ authorId: author.id, coverMediaId: media.id, title: "Covered", userId });
    await seedBook({ authorId: author.id, title: "Bare", userId });

    const res = await listBooks(accessToken, "hasCover=false");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Bare"]);
  });

  it("filters by an inclusive rating range", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, rating: 2, title: "Low", userId });
    await seedBook({ authorId: author.id, rating: 4, title: "High", userId });
    await seedBook({ authorId: author.id, title: "Unrated", userId });

    const res = await listBooks(accessToken, "ratingMin=3&ratingMax=5");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["High"]);
  });

  it("filters by a publication year range", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, publicationYear: 1999, title: "Old", userId });
    await seedBook({ authorId: author.id, publicationYear: 2015, title: "Mid", userId });
    await seedBook({ authorId: author.id, publicationYear: 2024, title: "New", userId });

    const res = await listBooks(accessToken, "yearMin=2000&yearMax=2020");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Mid"]);
  });

  it("filters by a page count range", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, pagesCount: 100, title: "Short", userId });
    await seedBook({ authorId: author.id, pagesCount: 400, title: "Medium", userId });
    await seedBook({ authorId: author.id, pagesCount: 900, title: "Long", userId });

    const res = await listBooks(accessToken, "pagesMin=300&pagesMax=500");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Medium"]);
  });

  it("rejects an inverted rating range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listBooks(accessToken, "ratingMin=5&ratingMax=1");

    expect(res.status).toBe(400);
  });

  it("rejects an inverted publication year range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listBooks(accessToken, "yearMin=2020&yearMax=2000");

    expect(res.status).toBe(400);
  });

  it("rejects an inverted page count range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listBooks(accessToken, "pagesMin=500&pagesMax=100");

    expect(res.status).toBe(400);
  });
});

describe("GET /api/books hasRating filter", () => {
  it("returns a favorite that has no reading-progress row", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, isFavorite: true, title: "NoProgress", userId });

    const res = await listBooks(accessToken, "isFavorite=true&hasRating=false");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["NoProgress"]);
  });

  it("returns a favorite whose reading-progress row has a null rating", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const book = await seedBook({
      authorId: author.id,
      isFavorite: true,
      title: "NullRating",
      userId,
    });
    await seedNullRatingProgress(book.id);

    const res = await listBooks(accessToken, "isFavorite=true&hasRating=false");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["NullRating"]);
  });

  it("excludes a favorite that has a rating", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, isFavorite: true, rating: 8, title: "Rated", userId });

    const res = await listBooks(accessToken, "isFavorite=true&hasRating=false");

    expect(res.body.totalCount).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  it("excludes an unrated non-favorite when favorites are requested", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, isFavorite: false, title: "PlainUnrated", userId });

    const res = await listBooks(accessToken, "isFavorite=true&hasRating=false");

    expect(res.body.totalCount).toBe(0);
  });

  it("never returns another user's unrated favorite", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerAuthor = await seedAuthor({ name: "Frank Herbert", userId: stranger.userId });
    await seedBook({
      authorId: strangerAuthor.id,
      isFavorite: true,
      title: "Theirs",
      userId: stranger.userId,
    });

    const res = await listBooks(owner.accessToken, "isFavorite=true&hasRating=false");

    expect(res.body.totalCount).toBe(0);
  });

  it("excludes a reading unrated favorite when the finished status is added", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      readingStatus: "finished",
      title: "FinishedUnrated",
      userId,
    });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      readingStatus: "reading",
      title: "ReadingUnrated",
      userId,
    });

    const res = await listBooks(accessToken, "isFavorite=true&hasRating=false&status=finished");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["FinishedUnrated"]);
  });

  it("reports the database-level total count independent of the page size", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      isFavorite: true,
      title: "One",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      isFavorite: true,
      title: "Two",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      isFavorite: true,
      title: "Three",
      userId,
    });

    const res = await listBooks(
      accessToken,
      "isFavorite=true&hasRating=false&pageNumber=1&pageSize=2",
    );

    expect(res.body).toMatchObject({ page: 1, pagesCount: 2, pageSize: 2, totalCount: 3 });
    expect(res.body.items).toHaveLength(2);
  });

  it("orders unrated favorites newest-first by favorite_added with a stable created_at tiebreaker", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      favoriteAddedAt: new Date("2026-03-03T00:00:00.000Z"),
      isFavorite: true,
      title: "Latest",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      favoriteAddedAt: null,
      isFavorite: true,
      title: "OlderUnstamped",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      favoriteAddedAt: null,
      isFavorite: true,
      title: "NewerUnstamped",
      userId,
    });

    const res = await listBooks(
      accessToken,
      "isFavorite=true&hasRating=false&sort=favorite_added_desc",
    );

    expect(titlesOf(res.body)).toEqual(["Latest", "NewerUnstamped", "OlderUnstamped"]);
  });

  it("returns only books that have a rating when hasRating is true", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, rating: 7, title: "Rated", userId });
    await seedBook({ authorId: author.id, title: "NoProgress", userId });
    const nulled = await seedBook({ authorId: author.id, title: "NullRating", userId });
    await seedNullRatingProgress(nulled.id);

    const res = await listBooks(accessToken, "hasRating=true");

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Rated"]);
  });
});

describe("GET /api/books hasRating validation", () => {
  it("accepts hasRating=true", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listBooks(accessToken, "hasRating=true");

    expect(res.status).toBe(200);
  });

  it("accepts hasRating=false", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listBooks(accessToken, "hasRating=false");

    expect(res.status).toBe(200);
  });

  it("rejects a non-boolean hasRating value with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listBooks(accessToken, "hasRating=maybe");

    expect(res.status).toBe(400);
  });

  it("applies no rating filter when hasRating is absent", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, rating: 6, title: "Rated", userId });
    await seedBook({ authorId: author.id, title: "Unrated", userId });

    const res = await listBooks(accessToken);

    expect(res.body.totalCount).toBe(2);
  });

  it("combines hasRating with a search term and the favorite filter", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, isFavorite: true, title: "Dune", userId });
    await seedBook({
      authorId: author.id,
      isFavorite: true,
      rating: 9,
      title: "Dune Messiah",
      userId,
    });
    await seedBook({ authorId: author.id, isFavorite: false, title: "Dune Unloved", userId });

    const res = await listBooks(
      accessToken,
      `q=${encodeURIComponent("dune")}&isFavorite=true&hasRating=false`,
    );

    expect(res.body.totalCount).toBe(1);
    expect(titlesOf(res.body)).toEqual(["Dune"]);
  });
});

describe("GET /api/books sorting", () => {
  async function seedTitled(userId: string): Promise<string> {
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      title: "Banana",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      title: "Apple",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      title: "Cherry",
      userId,
    });
    return author.id;
  }

  it("sorts by created_desc by default", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedTitled(userId);

    const res = await listBooks(accessToken);

    expect(titlesOf(res.body)).toEqual(["Cherry", "Apple", "Banana"]);
  });

  it("sorts by created_asc", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedTitled(userId);

    const res = await listBooks(accessToken, "sort=created_asc");

    expect(titlesOf(res.body)).toEqual(["Banana", "Apple", "Cherry"]);
  });

  it("sorts by title ascending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedTitled(userId);

    const res = await listBooks(accessToken, "sort=title_asc");

    expect(titlesOf(res.body)).toEqual(["Apple", "Banana", "Cherry"]);
  });

  it("sorts by title descending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedTitled(userId);

    const res = await listBooks(accessToken, "sort=title_desc");

    expect(titlesOf(res.body)).toEqual(["Cherry", "Banana", "Apple"]);
  });

  it("sorts by author name ascending then descending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const alpha = await seedAuthor({ name: "Alpha Writer", userId });
    const bravo = await seedAuthor({ name: "Bravo Writer", userId });
    const charlie = await seedAuthor({ name: "Charlie Writer", userId });
    await seedBook({ authorId: bravo.id, firstAuthorName: bravo.name, title: "B", userId });
    await seedBook({ authorId: alpha.id, firstAuthorName: alpha.name, title: "A", userId });
    await seedBook({ authorId: charlie.id, firstAuthorName: charlie.name, title: "C", userId });

    const asc = await listBooks(accessToken, "sort=author_asc");
    expect(
      asc.body.items.map((item: { authors: { name: string }[] }) => item.authors[0]?.name),
    ).toEqual(["Alpha Writer", "Bravo Writer", "Charlie Writer"]);

    const desc = await listBooks(accessToken, "sort=author_desc");
    expect(
      desc.body.items.map((item: { authors: { name: string }[] }) => item.authors[0]?.name),
    ).toEqual(["Charlie Writer", "Bravo Writer", "Alpha Writer"]);
  });

  it("sorts by most recently updated first", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const older = await seedBook({ authorId: author.id, title: "Older", userId });
    const newer = await seedBook({ authorId: author.id, title: "Newer", userId });
    await prisma.$executeRaw`UPDATE books SET updated_at = '2026-01-01T00:00:00.000Z' WHERE id = ${older.id}::uuid`;
    await prisma.$executeRaw`UPDATE books SET updated_at = '2026-02-01T00:00:00.000Z' WHERE id = ${newer.id}::uuid`;

    const res = await listBooks(accessToken, "sort=updated_desc");

    expect(titlesOf(res.body)).toEqual(["Newer", "Older"]);
  });

  it("orders rating ascending and descending with empty ratings last", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, rating: 2, title: "Two", userId });
    await seedBook({ authorId: author.id, rating: 5, title: "Five", userId });
    await seedBook({ authorId: author.id, title: "None", userId });

    const asc = await listBooks(accessToken, "sort=rating_asc");
    expect(titlesOf(asc.body)).toEqual(["Two", "Five", "None"]);

    const desc = await listBooks(accessToken, "sort=rating_desc");
    expect(titlesOf(desc.body)).toEqual(["Five", "Two", "None"]);
  });

  it("orders year ascending and descending with empty years last", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, publicationYear: 2000, title: "Y2000", userId });
    await seedBook({ authorId: author.id, publicationYear: 2020, title: "Y2020", userId });
    await seedBook({ authorId: author.id, title: "NoYear", userId });

    const asc = await listBooks(accessToken, "sort=year_asc");
    expect(titlesOf(asc.body)).toEqual(["Y2000", "Y2020", "NoYear"]);

    const desc = await listBooks(accessToken, "sort=year_desc");
    expect(titlesOf(desc.body)).toEqual(["Y2020", "Y2000", "NoYear"]);
  });

  it("orders page count ascending and descending with empty counts last", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, pagesCount: 100, title: "P100", userId });
    await seedBook({ authorId: author.id, pagesCount: 500, title: "P500", userId });
    await seedBook({ authorId: author.id, title: "NoPages", userId });

    const asc = await listBooks(accessToken, "sort=pages_asc");
    expect(titlesOf(asc.body)).toEqual(["P100", "P500", "NoPages"]);

    const desc = await listBooks(accessToken, "sort=pages_desc");
    expect(titlesOf(desc.body)).toEqual(["P500", "P100", "NoPages"]);
  });

  it("orders favorites by favorite_added with unstamped favorites last", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      favoriteAddedAt: new Date("2026-03-01T00:00:00.000Z"),
      isFavorite: true,
      title: "Early",
      userId,
    });
    await seedBook({
      authorId: author.id,
      favoriteAddedAt: new Date("2026-03-02T00:00:00.000Z"),
      isFavorite: true,
      title: "Middle",
      userId,
    });
    await seedBook({
      authorId: author.id,
      favoriteAddedAt: new Date("2026-03-03T00:00:00.000Z"),
      isFavorite: true,
      title: "Latest",
      userId,
    });
    await seedBook({
      authorId: author.id,
      favoriteAddedAt: null,
      isFavorite: true,
      title: "Unstamped",
      userId,
    });

    const desc = await listBooks(accessToken, "isFavorite=true&sort=favorite_added_desc");
    expect(titlesOf(desc.body)).toEqual(["Latest", "Middle", "Early", "Unstamped"]);

    const asc = await listBooks(accessToken, "isFavorite=true&sort=favorite_added_asc");
    expect(titlesOf(asc.body)).toEqual(["Early", "Middle", "Latest", "Unstamped"]);
  });

  it("breaks favorite_added null ties on created_at descending", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      favoriteAddedAt: null,
      isFavorite: true,
      title: "OlderUnstamped",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      favoriteAddedAt: null,
      isFavorite: true,
      title: "NewerUnstamped",
      userId,
    });
    await seedBook({
      authorId: author.id,
      favoriteAddedAt: new Date("2026-03-01T00:00:00.000Z"),
      isFavorite: true,
      title: "Stamped",
      userId,
    });

    const desc = await listBooks(accessToken, "isFavorite=true&sort=favorite_added_desc");
    expect(titlesOf(desc.body)).toEqual(["Stamped", "NewerUnstamped", "OlderUnstamped"]);
  });

  it("returns the same result set regardless of sort order", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedTitled(userId);

    const created = await listBooks(accessToken, "sort=created_desc");
    const byTitle = await listBooks(accessToken, "sort=title_asc");

    expect(created.body.totalCount).toBe(byTitle.body.totalCount);
    expect(titlesOf(created.body).sort()).toEqual(titlesOf(byTitle.body).sort());
  });
});

describe("GET /api/books pagination", () => {
  async function seedThree(userId: string): Promise<void> {
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      title: "First",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      title: "Second",
      userId,
    });
    await seedBook({
      authorId: author.id,
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      title: "Third",
      userId,
    });
  }

  it("returns the first page with the newest books and the correct counts", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedThree(userId);

    const res = await listBooks(accessToken, "pageNumber=1&pageSize=2");

    expect(res.body).toMatchObject({ page: 1, pagesCount: 2, pageSize: 2, totalCount: 3 });
    expect(titlesOf(res.body)).toEqual(["Third", "Second"]);
  });

  it("returns the trailing page with the remaining books", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedThree(userId);

    const res = await listBooks(accessToken, "pageNumber=2&pageSize=2");

    expect(res.body).toMatchObject({ page: 2, pagesCount: 2, pageSize: 2, totalCount: 3 });
    expect(titlesOf(res.body)).toEqual(["First"]);
  });

  it("defaults to a page size of 24", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    await seedBook({ authorId: author.id, title: "Only", userId });

    const res = await listBooks(accessToken);

    expect(res.body).toMatchObject({ page: 1, pagesCount: 1, pageSize: 24, totalCount: 1 });
  });

  it("returns an empty page shape for an empty library", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listBooks(accessToken);

    expect(res.body).toMatchObject({ page: 1, pagesCount: 0, totalCount: 0 });
    expect(res.body.items).toEqual([]);
  });

  it("paginates rows sharing a created_at without duplicates or gaps", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const author = await seedAuthor({ name: "Frank Herbert", userId });
    const sharedCreatedAt = new Date("2026-01-01T00:00:00.000Z");
    const seeded = await Promise.all([
      seedBook({ authorId: author.id, createdAt: sharedCreatedAt, title: "Alpha", userId }),
      seedBook({ authorId: author.id, createdAt: sharedCreatedAt, title: "Bravo", userId }),
      seedBook({ authorId: author.id, createdAt: sharedCreatedAt, title: "Charlie", userId }),
      seedBook({ authorId: author.id, createdAt: sharedCreatedAt, title: "Delta", userId }),
    ]);

    const firstPage = await listBooks(accessToken, "pageNumber=1&pageSize=2");
    const secondPage = await listBooks(accessToken, "pageNumber=2&pageSize=2");

    const returnedIds = [
      ...firstPage.body.items.map((item: { id: string }) => item.id),
      ...secondPage.body.items.map((item: { id: string }) => item.id),
    ];
    expect(new Set(returnedIds).size).toBe(4);
    expect([...returnedIds].sort()).toEqual(seeded.map((book) => book.id).sort());
  });
});

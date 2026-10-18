import type { QuotesFacetsView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { QuotesFacetsViewSchema } from "@app/shared";
import { HttpStatus } from "@nestjs/common";
import { addMinutes } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { QuotesModule } from "../quotes.module.js";

const QUOTES_PATH = "/api/quotes";
const QUOTES_FACETS_PATH = "/api/quotes/facets";
const BASE_TIME = new Date("2026-03-01T12:00:00.000Z");

type FacetCounts = Omit<QuotesFacetsView, "authors" | "books">;

const ZERO_FACET_COUNTS: FacetCounts = {
  favoritesCount: 0,
  spoilerCount: 0,
  totalCount: 0,
  withCommentCount: 0,
  withoutCommentCount: 0,
  withoutSpoilerCount: 0,
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, QuotesModule]);
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

function authed(method: "delete" | "get" | "post", path: string, token: string): request.Test {
  return request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${token}`);
}

function byId(ids: string[]): string[] {
  return [...ids].sort();
}

async function createBook(
  token: string,
  book: { author: string; originalTitle?: string; title: string },
): Promise<string> {
  const res = await authed("post", "/api/books", token).send({
    authors: [{ name: book.author }],
    ...(book.originalTitle === undefined ? {} : { originalTitle: book.originalTitle }),
    ownershipStatus: "owned",
    title: book.title,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createBookQuote(
  token: string,
  bookId: string,
  body: Record<string, unknown> = {},
): Promise<string> {
  const res = await authed("post", `/api/books/${bookId}/quotes`, token).send({
    text: "Fear is the little-death",
    ...body,
  });
  expect(res.status).toBe(HttpStatus.CREATED);
  return res.body.id;
}

async function createBookQuotes(token: string, bookId: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    ids.push(await createBookQuote(token, bookId));
  }
  return ids;
}

async function facetCountsOf(token: string, queryString: string): Promise<FacetCounts> {
  const res = await authed("get", `${QUOTES_FACETS_PATH}?${queryString}`, token);
  expect(res.status).toBe(HttpStatus.OK);
  const { authors: _authors, books: _books, ...counts } = QuotesFacetsViewSchema.parse(res.body);
  return counts;
}

function listIds(body: { items: { id: string }[] }): string[] {
  return body.items.map((item) => item.id);
}

async function seedDuneAndHyperion(token: string): Promise<{ duneId: string; hyperionId: string }> {
  const duneId = await createBook(token, {
    author: "Frank Herbert",
    originalTitle: "Dyuna",
    title: "Dune",
  });
  const hyperionId = await createBook(token, { author: "Dan Simmons", title: "Hyperion" });
  return { duneId, hyperionId };
}

async function seedDuneQuotesWithoutBookTerms(
  token: string,
): Promise<{ duneId: string; duneQuotes: string[] }> {
  const { duneId, hyperionId } = await seedDuneAndHyperion(token);
  const duneQuotes = [
    await createBookQuote(token, duneId, { isFavorite: true, text: "Fear is the mind-killer" }),
    await createBookQuote(token, duneId, {
      comment: "Economy of Arrakeen",
      isSpoiler: true,
      text: "The spice must flow",
    }),
  ];
  await createBookQuote(token, hyperionId, { text: "Dune Herbert Dyuna mentioned elsewhere" });
  return { duneId, duneQuotes };
}

async function stampCreatedAt(quoteId: string, createdAt: Date): Promise<void> {
  await prisma.quote.update({ data: { createdAt, updatedAt: createdAt }, where: { id: quoteId } });
}

describe("GET /api/quotes?book=<id> searchIn against the book's own title and author", () => {
  it.each([
    { term: "dune", what: "title" },
    { term: "dyuna", what: "original title" },
    { term: "herbert", what: "author" },
  ])(
    "returns nothing for the book's $what when searchIn=quotes and no quote mentions it",
    async ({ term }) => {
      const { accessToken } = await context.registerVerifyAndLogin();
      const { duneId } = await seedDuneQuotesWithoutBookTerms(accessToken);

      const res = await authed(
        "get",
        `${QUOTES_PATH}?book=${duneId}&searchIn=quotes&q=${term}`,
        accessToken,
      );

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toMatchObject({ items: [], pagesCount: 0, totalCount: 0 });
    },
  );

  it.each([
    { term: "dune", what: "title" },
    { term: "dyuna", what: "original title" },
    { term: "herbert", what: "author" },
  ])(
    "reports zero facet counts for the book's $what when searchIn=quotes and no quote mentions it",
    async ({ term }) => {
      const { accessToken } = await context.registerVerifyAndLogin();
      const { duneId } = await seedDuneQuotesWithoutBookTerms(accessToken);

      const counts = await facetCountsOf(accessToken, `book=${duneId}&searchIn=quotes&q=${term}`);

      expect(counts).toEqual(ZERO_FACET_COUNTS);
    },
  );

  it.each([
    { searchIn: "", term: "dune", what: "title with the default scope" },
    { searchIn: "&searchIn=quotes_and_book", term: "dune", what: "title with quotes_and_book" },
    { searchIn: "", term: "herbert", what: "author with the default scope" },
    { searchIn: "&searchIn=quotes_and_book", term: "herbert", what: "author with quotes_and_book" },
  ])("returns every quote of the book for its $what", async ({ searchIn, term }) => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId, duneQuotes } = await seedDuneQuotesWithoutBookTerms(accessToken);

    const res = await authed(
      "get",
      `${QUOTES_PATH}?book=${duneId}&q=${term}${searchIn}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(byId(listIds(res.body))).toEqual(byId(duneQuotes));
    expect(res.body.totalCount).toBe(2);
  });

  it("counts every quote of the book in the facets for its title with the default scope", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId } = await seedDuneQuotesWithoutBookTerms(accessToken);

    const counts = await facetCountsOf(accessToken, `book=${duneId}&q=dune`);

    expect(counts).toEqual({
      favoritesCount: 1,
      spoilerCount: 1,
      totalCount: 2,
      withCommentCount: 1,
      withoutCommentCount: 1,
      withoutSpoilerCount: 1,
    });
  });

  it("keeps a quote whose own text mentions the book title when searchIn=quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId } = await seedDuneAndHyperion(accessToken);
    const ownMatchId = await createBookQuote(accessToken, duneId, {
      text: "Sand covers every dune",
    });
    await createBookQuote(accessToken, duneId, { text: "The spice must flow" });

    const res = await authed(
      "get",
      `${QUOTES_PATH}?book=${duneId}&searchIn=quotes&q=dune`,
      accessToken,
    );

    expect(listIds(res.body)).toEqual([ownMatchId]);
    expect(res.body.totalCount).toBe(1);
  });

  it("keeps a quote whose own comment mentions the book author when searchIn=quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId } = await seedDuneAndHyperion(accessToken);
    const ownMatchId = await createBookQuote(accessToken, duneId, {
      comment: "Herbert at his sharpest",
      text: "Fear is the mind-killer",
    });
    await createBookQuote(accessToken, duneId, { text: "The spice must flow" });

    const res = await authed(
      "get",
      `${QUOTES_PATH}?book=${duneId}&searchIn=quotes&q=herbert`,
      accessToken,
    );

    expect(listIds(res.body)).toEqual([ownMatchId]);
  });
});

describe("GET /api/quotes?book=<id>&searchIn=quotes own fields", () => {
  async function seedOwnFieldQuotes(token: string): Promise<{
    duneId: string;
    quoteIdByField: Record<string, string>;
  }> {
    const { duneId, hyperionId } = await seedDuneAndHyperion(token);
    const quoteIdByField: Record<string, string> = {
      chapter: await createBookQuote(token, duneId, {
        chapter: "Sietch Tabr",
        text: "A beginning is the time for taking the most delicate care",
      }),
      comment: await createBookQuote(token, duneId, {
        comment: "Harkonnen greed",
        text: "He who controls the spice controls the universe",
      }),
      page: await createBookQuote(token, duneId, {
        page: 87,
        text: "The mystery of life is not a problem to solve",
      }),
      text: await createBookQuote(token, duneId, { page: 12, text: "Fear is the mind-killer" }),
    };
    await createBookQuote(token, duneId, { page: 870, text: "Walk without rhythm" });
    await createBookQuote(token, hyperionId, {
      chapter: "Sietch Tabr",
      comment: "Harkonnen echo",
      page: 87,
      text: "The Shrike is a mind-killer too",
    });
    return { duneId, quoteIdByField };
  }

  it.each([
    { field: "text", term: "mind-killer" },
    { field: "comment", term: "harkonnen" },
    { field: "chapter", term: "tabr" },
    { field: "page", term: "87" },
  ])("matches a quote of the book by its $field", async ({ field, term }) => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId, quoteIdByField } = await seedOwnFieldQuotes(accessToken);

    const res = await authed(
      "get",
      `${QUOTES_PATH}?book=${duneId}&searchIn=quotes&q=${term}`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(listIds(res.body)).toEqual([quoteIdByField[field]]);
    expect(res.body.totalCount).toBe(1);
  });

  it("returns a spoiler quote whose text matches, with its spoiler flag and full text", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId } = await seedDuneAndHyperion(accessToken);
    const spoilerId = await createBookQuote(accessToken, duneId, {
      isSpoiler: true,
      text: "Paul drinks the Water of Life",
    });
    await createBookQuote(accessToken, duneId, { text: "The spice must flow" });

    const res = await authed(
      "get",
      `${QUOTES_PATH}?book=${duneId}&searchIn=quotes&q=water`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body.items).toEqual([
      expect.objectContaining({
        id: spoilerId,
        isSpoiler: true,
        text: "Paul drinks the Water of Life",
      }),
    ]);
  });
});

describe("GET /api/quotes?book=<id> quick filters", () => {
  it.each([
    { expected: ["favorite", "commented", "spoiler", "plain"], filter: "all" },
    { expected: ["favorite"], filter: "favorites" },
    { expected: ["commented"], filter: "with_comment" },
    { expected: ["favorite", "spoiler", "plain"], filter: "without_comment" },
    { expected: ["favorite", "commented", "plain"], filter: "no_spoiler" },
    { expected: ["spoiler"], filter: "with_spoiler" },
  ])(
    "returns only the selected book's quotes under filter=$filter",
    async ({ expected, filter }) => {
      const { accessToken } = await context.registerVerifyAndLogin();
      const { duneId, hyperionId } = await seedDuneAndHyperion(accessToken);
      const quoteIdByLabel: Record<string, string> = {
        commented: await createBookQuote(accessToken, duneId, { comment: "Worth rereading" }),
        favorite: await createBookQuote(accessToken, duneId, { isFavorite: true }),
        plain: await createBookQuote(accessToken, duneId),
        spoiler: await createBookQuote(accessToken, duneId, { isSpoiler: true }),
      };
      await createBookQuote(accessToken, hyperionId, {
        comment: "Elsewhere",
        isFavorite: true,
        isSpoiler: true,
      });
      await createBookQuote(accessToken, hyperionId);

      const res = await authed(
        "get",
        `${QUOTES_PATH}?book=${duneId}&searchIn=quotes&filter=${filter}`,
        accessToken,
      );

      expect(res.status).toBe(HttpStatus.OK);
      expect(byId(listIds(res.body))).toEqual(
        byId(expected.map((label) => quoteIdByLabel[label] ?? "")),
      );
    },
  );
});

describe("GET /api/quotes/facets?book=<id>&searchIn=quotes", () => {
  async function seedFacetQuotes(token: string): Promise<string> {
    const { duneId, hyperionId } = await seedDuneAndHyperion(token);
    await createBookQuote(token, duneId, { isFavorite: true, text: "Fear is the mind-killer" });
    await createBookQuote(token, duneId, {
      comment: "Economy of Arrakeen",
      isSpoiler: true,
      text: "The spice must flow",
    });
    await createBookQuote(token, duneId, { text: "Fear is the little-death" });
    await createBookQuote(token, hyperionId, {
      comment: "Elsewhere",
      isFavorite: true,
      isSpoiler: true,
      text: "Fear of the Shrike",
    });
    return duneId;
  }

  it("counts only the selected book's quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await seedFacetQuotes(accessToken);

    const counts = await facetCountsOf(accessToken, `book=${duneId}&searchIn=quotes`);

    expect(counts).toEqual({
      favoritesCount: 1,
      spoilerCount: 1,
      totalCount: 3,
      withCommentCount: 1,
      withoutCommentCount: 2,
      withoutSpoilerCount: 2,
    });
  });

  it("shrinks the counts to the book's quotes matching the search", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await seedFacetQuotes(accessToken);

    const counts = await facetCountsOf(accessToken, `book=${duneId}&searchIn=quotes&q=fear`);

    expect(counts).toEqual({
      favoritesCount: 1,
      spoilerCount: 0,
      totalCount: 2,
      withCommentCount: 0,
      withoutCommentCount: 2,
      withoutSpoilerCount: 2,
    });
  });

  it("matches the list totalCount for the same book and search", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const duneId = await seedFacetQuotes(accessToken);

    const list = await authed(
      "get",
      `${QUOTES_PATH}?book=${duneId}&searchIn=quotes&q=fear`,
      accessToken,
    );
    const counts = await facetCountsOf(accessToken, `book=${duneId}&searchIn=quotes&q=fear`);

    expect(list.body.totalCount).toBe(2);
    expect(counts.totalCount).toBe(list.body.totalCount);
  });
});

describe("GET /api/quotes?book=<id>&sort=page", () => {
  it("orders one book's quotes by page ascending, newer first within a page, missing pages last", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId, hyperionId } = await seedDuneAndHyperion(accessToken);
    const otherBookQuote = await createBookQuote(accessToken, hyperionId, { page: 1 });
    const noPageQuote = await createBookQuote(accessToken, duneId);
    const page5NewerQuote = await createBookQuote(accessToken, duneId, { page: 5 });
    const page3Quote = await createBookQuote(accessToken, duneId, { page: 3 });
    const page5OlderQuote = await createBookQuote(accessToken, duneId, { page: 5 });
    await stampCreatedAt(otherBookQuote, addMinutes(BASE_TIME, 50));
    await stampCreatedAt(noPageQuote, addMinutes(BASE_TIME, 40));
    await stampCreatedAt(page5NewerQuote, addMinutes(BASE_TIME, 30));
    await stampCreatedAt(page5OlderQuote, addMinutes(BASE_TIME, 10));
    await stampCreatedAt(page3Quote, addMinutes(BASE_TIME, 5));

    const res = await authed(
      "get",
      `${QUOTES_PATH}?book=${duneId}&searchIn=quotes&sort=page`,
      accessToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(listIds(res.body)).toEqual([page3Quote, page5NewerQuote, page5OlderQuote, noPageQuote]);
  });

  it("orders quotes on the same page with equal createdAt by id after the newer one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId } = await seedDuneAndHyperion(accessToken);
    const tiedQuotes = [
      await createBookQuote(accessToken, duneId, { page: 7 }),
      await createBookQuote(accessToken, duneId, { page: 7 }),
      await createBookQuote(accessToken, duneId, { page: 7 }),
    ];
    const newerQuote = await createBookQuote(accessToken, duneId, { page: 7 });
    await Promise.all(tiedQuotes.map((quoteId) => stampCreatedAt(quoteId, BASE_TIME)));
    await stampCreatedAt(newerQuote, addMinutes(BASE_TIME, 1));

    const res = await authed(
      "get",
      `${QUOTES_PATH}?book=${duneId}&searchIn=quotes&sort=page`,
      accessToken,
    );

    expect(listIds(res.body)).toEqual([newerQuote, ...byId(tiedQuotes)]);
  });
});

describe("GET /api/quotes?book=<id> pagination", () => {
  it("splits 41 quotes of one book into pages of 20, 20 and 1", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId, hyperionId } = await seedDuneAndHyperion(accessToken);
    const duneQuotes = await createBookQuotes(accessToken, duneId, 41);
    await createBookQuotes(accessToken, hyperionId, 2);

    const pages = await Promise.all(
      [1, 2, 3].map((pageNumber) =>
        authed(
          "get",
          `${QUOTES_PATH}?book=${duneId}&searchIn=quotes&sort=page&pageSize=20&pageNumber=${pageNumber}`,
          accessToken,
        ),
      ),
    );

    expect(pages.map((page) => page.body.items.length)).toEqual([20, 20, 1]);
    expect(pages.map((page) => page.body.page)).toEqual([1, 2, 3]);
    expect(pages.map((page) => page.body.pagesCount)).toEqual([3, 3, 3]);
    expect(pages.map((page) => page.body.totalCount)).toEqual([41, 41, 41]);
    expect(byId(pages.flatMap((page) => listIds(page.body)))).toEqual(byId(duneQuotes));
  });

  it("reports a single page for exactly 20 quotes of one book", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId, hyperionId } = await seedDuneAndHyperion(accessToken);
    await createBookQuotes(accessToken, duneId, 20);
    await createBookQuote(accessToken, hyperionId);

    const res = await authed(
      "get",
      `${QUOTES_PATH}?book=${duneId}&searchIn=quotes&pageSize=20&pageNumber=1`,
      accessToken,
    );

    expect(res.body).toMatchObject({ page: 1, pagesCount: 1, pageSize: 20, totalCount: 20 });
    expect(res.body.items).toHaveLength(20);
  });
});

describe("GET /api/quotes?book=<id> access and trash", () => {
  async function seedStrangerBook(): Promise<{ ownerToken: string; strangerBookId: string }> {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin();
    const ownerBookId = await createBook(owner.accessToken, {
      author: "Frank Herbert",
      title: "Dune",
    });
    await createBookQuote(owner.accessToken, ownerBookId);
    const strangerBookId = await createBook(stranger.accessToken, {
      author: "Dan Simmons",
      title: "Hyperion",
    });
    await createBookQuotes(stranger.accessToken, strangerBookId, 2);
    return { ownerToken: owner.accessToken, strangerBookId };
  }

  it("returns an empty page for another user's book id", async () => {
    const { ownerToken, strangerBookId } = await seedStrangerBook();

    const res = await authed(
      "get",
      `${QUOTES_PATH}?book=${strangerBookId}&searchIn=quotes`,
      ownerToken,
    );

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({ items: [], pagesCount: 0, totalCount: 0 });
  });

  it("reports zero facet counts for another user's book id", async () => {
    const { ownerToken, strangerBookId } = await seedStrangerBook();

    const counts = await facetCountsOf(ownerToken, `book=${strangerBookId}&searchIn=quotes`);

    expect(counts).toEqual(ZERO_FACET_COUNTS);
  });

  it("excludes soft-deleted quotes from a book's quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId } = await seedDuneAndHyperion(accessToken);
    const [trashedId, ...keptIds] = await createBookQuotes(accessToken, duneId, 3);
    await authed("delete", `/api/books/${duneId}/quotes/${trashedId}`, accessToken).expect(
      HttpStatus.OK,
    );

    const res = await authed("get", `${QUOTES_PATH}?book=${duneId}&searchIn=quotes`, accessToken);

    expect(byId(listIds(res.body))).toEqual(byId(keptIds));
    expect(res.body.totalCount).toBe(2);
  });

  it("excludes soft-deleted quotes from a book's facet counts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId } = await seedDuneAndHyperion(accessToken);
    const trashedId = await createBookQuote(accessToken, duneId, {
      comment: "Gone soon",
      isFavorite: true,
      isSpoiler: true,
    });
    await createBookQuotes(accessToken, duneId, 2);
    await authed("delete", `/api/books/${duneId}/quotes/${trashedId}`, accessToken).expect(
      HttpStatus.OK,
    );

    const counts = await facetCountsOf(accessToken, `book=${duneId}&searchIn=quotes`);

    expect(counts).toEqual({
      favoritesCount: 0,
      spoilerCount: 0,
      totalCount: 2,
      withCommentCount: 0,
      withoutCommentCount: 2,
      withoutSpoilerCount: 2,
    });
  });

  it("returns an empty page for a trashed book that still holds quotes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const { duneId } = await seedDuneAndHyperion(accessToken);
    await createBookQuotes(accessToken, duneId, 2);
    await authed("delete", `/api/books/${duneId}`, accessToken).expect(HttpStatus.OK);

    const res = await authed("get", `${QUOTES_PATH}?book=${duneId}&searchIn=quotes`, accessToken);

    expect(res.status).toBe(HttpStatus.OK);
    expect(res.body).toMatchObject({ items: [], totalCount: 0 });
  });
});

describe("searchIn validation", () => {
  it.each([
    { path: QUOTES_PATH, what: "list" },
    { path: QUOTES_FACETS_PATH, what: "facets" },
  ])("returns 400 on the $what for an unknown searchIn value", async ({ path }) => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await authed("get", `${path}?searchIn=bogus`, accessToken);

    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "searchIn" })]),
    );
  });
});

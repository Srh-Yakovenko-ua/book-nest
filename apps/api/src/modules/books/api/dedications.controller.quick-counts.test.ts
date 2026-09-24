import type { DedicationQuickFilterKey, DedicationsQuickCounts } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { LIBRARY_SEARCH_MAX } from "@app/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

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
  dedication: null | string;
  genres: string[];
  isFavoriteDedication: boolean;
  readingStatus: string;
  title: string;
};

const QUICK_FILTER_KEYS: DedicationQuickFilterKey[] = [
  "all",
  "favorites",
  "finished",
  "unfinished",
];

const ZERO_COUNTS: DedicationsQuickCounts = { all: 0, favorites: 0, finished: 0, unfinished: 0 };

const QuickCountsResponseSchema = z
  .object({
    all: z.number(),
    favorites: z.number(),
    finished: z.number(),
    unfinished: z.number(),
  })
  .strict();

const TotalCountSchema = z.object({ totalCount: z.number() });

const SEED_BOOKS: SeedBookInput[] = [
  {
    dedication: "For my mother",
    genres: ["history"],
    isFavoriteDedication: true,
    readingStatus: "finished",
    title: "Dune",
  },
  {
    dedication: "To my brother",
    genres: ["fantasy"],
    isFavoriteDedication: false,
    readingStatus: "reading",
    title: "Dune Messiah",
  },
  {
    dedication: "For my mother, again",
    genres: ["fantasy"],
    isFavoriteDedication: true,
    readingStatus: "not_started",
    title: "Children of Dune",
  },
  {
    dedication: "To the reader",
    genres: ["history"],
    isFavoriteDedication: false,
    readingStatus: "finished",
    title: "The Hobbit",
  },
  {
    dedication: "For friends",
    genres: ["fantasy"],
    isFavoriteDedication: false,
    readingStatus: "want_to_read",
    title: "Silmarillion",
  },
  {
    dedication: null,
    genres: ["fantasy"],
    isFavoriteDedication: false,
    readingStatus: "finished",
    title: "Dune Encyclopedia",
  },
  {
    dedication: "",
    genres: ["history"],
    isFavoriteDedication: true,
    readingStatus: "reading",
    title: "Dune Atlas",
  },
];

function getQuickCounts(accessToken: string, params: [string, string][] = []): request.Test {
  return request(app.getHttpServer())
    .get("/api/books/dedications/quick-counts")
    .query(new URLSearchParams(params).toString())
    .set("Authorization", `Bearer ${accessToken}`);
}

async function listTotalCount({
  accessToken,
  params,
}: {
  accessToken: string;
  params: [string, string][];
}): Promise<number> {
  const res = await request(app.getHttpServer())
    .get("/api/books/dedications")
    .query(new URLSearchParams([...params, ["pageSize", "1"]]).toString())
    .set("Authorization", `Bearer ${accessToken}`);
  expect(res.status).toBe(200);
  return TotalCountSchema.parse(res.body).totalCount;
}

async function quickCountsOf(
  accessToken: string,
  params: [string, string][] = [],
): Promise<DedicationsQuickCounts> {
  const res = await getQuickCounts(accessToken, params);
  expect(res.status).toBe(200);
  return QuickCountsResponseSchema.parse(res.body);
}

async function seedDedications(): Promise<{ accessToken: string }> {
  const { accessToken, userId } = await context.registerVerifyAndLogin();
  const author = await prisma.author.create({
    data: { name: "Frank Herbert", normalizedName: "frank herbert", userId },
    select: { id: true },
  });
  for (const book of SEED_BOOKS) {
    await prisma.book.create({
      data: {
        authors: { create: [{ authorId: author.id, position: 0 }] },
        dedication: book.dedication,
        firstAuthorName: "Frank Herbert",
        genres: book.genres,
        isFavoriteDedication: book.isFavoriteDedication,
        readingStatus: book.readingStatus,
        title: book.title,
        userId,
      },
    });
  }
  return { accessToken };
}

describe("GET /api/books/dedications/quick-counts", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/books/dedications/quick-counts");

    expect(res.status).toBe(401);
  });

  it("returns 400 for a search longer than the list accepts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getQuickCounts(accessToken, [["q", "x".repeat(LIBRARY_SEARCH_MAX + 1)]]);

    expect(res.status).toBe(400);
  });

  it("returns zero for every chip when the user has no dedications", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    expect(await quickCountsOf(accessToken)).toEqual(ZERO_COUNTS);
  });

  it("counts every chip over books that carry a real dedication", async () => {
    const { accessToken } = await seedDedications();

    expect(await quickCountsOf(accessToken)).toEqual({
      all: 5,
      favorites: 2,
      finished: 2,
      unfinished: 3,
    });
  });

  it("follows the search query", async () => {
    const { accessToken } = await seedDedications();

    expect(await quickCountsOf(accessToken, [["q", "Dune"]])).toEqual({
      all: 3,
      favorites: 2,
      finished: 1,
      unfinished: 2,
    });
  });

  it("follows a search that matches the dedication text", async () => {
    const { accessToken } = await seedDedications();

    expect(await quickCountsOf(accessToken, [["q", "mother"]])).toEqual({
      all: 2,
      favorites: 2,
      finished: 1,
      unfinished: 1,
    });
  });

  it("follows the genre filter", async () => {
    const { accessToken } = await seedDedications();

    expect(await quickCountsOf(accessToken, [["genre", "fantasy"]])).toEqual({
      all: 3,
      favorites: 1,
      finished: 0,
      unfinished: 3,
    });
  });

  it("ignores the quick filter, paging and sort the request carries", async () => {
    const { accessToken } = await seedDedications();

    const plain = await quickCountsOf(accessToken, [["q", "Dune"]]);
    const withQuickAxis = await quickCountsOf(accessToken, [
      ["q", "Dune"],
      ["filter", "favorites"],
      ["pageNumber", "2"],
      ["pageSize", "1"],
      ["sort", "book_title_asc"],
    ]);

    expect(withQuickAxis).toEqual(plain);
  });

  it("never counts the dedications of another user", async () => {
    await seedDedications();
    const { accessToken } = await context.registerVerifyAndLogin();

    expect(await quickCountsOf(accessToken)).toEqual(ZERO_COUNTS);
  });

  it("does not count trashed books", async () => {
    const { accessToken } = await seedDedications();
    await prisma.book.updateMany({
      data: TRASH_RETENTION.stamp(new Date()),
      where: { title: "Dune" },
    });

    expect(await quickCountsOf(accessToken, [["q", "Dune"]])).toEqual({
      all: 2,
      favorites: 1,
      finished: 0,
      unfinished: 2,
    });
  });

  it("leaves the unfiltered summary unchanged", async () => {
    const { accessToken } = await seedDedications();

    const res = await request(app.getHttpServer())
      .get("/api/books/dedications/summary")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      favoriteCount: 2,
      finishedCount: 2,
      totalCount: 5,
      unfinishedCount: 3,
    });
  });

  const INVARIANT_CASES: { params: [string, string][] }[] = [
    { params: [] },
    { params: [["q", "Dune"]] },
    { params: [["genre", "history"]] },
    {
      params: [
        ["q", "mother"],
        ["genre", "fantasy"],
      ],
    },
  ];

  it.each(INVARIANT_CASES)(
    "matches the list total for every chip with $params",
    async ({ params }) => {
      const { accessToken } = await seedDedications();
      const counts = await quickCountsOf(accessToken, params);

      for (const chip of QUICK_FILTER_KEYS) {
        const totalCount = await listTotalCount({
          accessToken,
          params: [...params, ["filter", chip]],
        });
        expect({ chip, count: counts[chip] }).toEqual({ chip, count: totalCount });
      }
    },
  );
});

import type { LibraryQuickCounts, LibraryQuickFilterKey } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

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

type LibraryScope = "all" | "favorites" | "my";

type SeedBookInput = {
  genres: string[];
  isFavorite: boolean;
  language: string;
  ownershipStatus: string;
  publisherId?: string;
  readingStatus: string;
  seriesId?: string;
  title: string;
};

type SeededLibrary = {
  accessToken: string;
  publisherId: string;
};

const TotalCountSchema = z.object({ totalCount: z.number() });

const PHYSICAL_OWNERSHIP = ["owned", "lent_to_someone", "borrowed_from_someone"];

const CHIP_LIST_PARAMS: Record<LibraryQuickFilterKey, [string, string][]> = {
  all: [],
  borrowed: [
    ["owner", "borrowed_from_someone"],
    ["owner", "lent_to_someone"],
  ],
  favorites: [["isFavorite", "true"]],
  finished: [["status", "finished"]],
  in_transit: [["owner", "in_transit"]],
  reading: [
    ["status", "reading"],
    ["status", "rereading"],
  ],
  series: [["bookType", "series_part"]],
  solo: [["bookType", "solo"]],
  want_to_buy: [["owner", "want_to_buy"]],
  want_to_read: [["status", "want_to_read"]],
};

const CHIPS_BY_SCOPE: Record<LibraryScope, LibraryQuickFilterKey[]> = {
  all: [
    "all",
    "reading",
    "want_to_read",
    "finished",
    "favorites",
    "want_to_buy",
    "in_transit",
    "borrowed",
    "series",
    "solo",
  ],
  favorites: ["all", "reading", "want_to_read", "finished", "series", "solo"],
  my: ["all", "reading", "want_to_read", "finished", "favorites", "borrowed", "series", "solo"],
};

const ZERO_COUNTS: LibraryQuickCounts = {
  all: 0,
  borrowed: 0,
  favorites: 0,
  finished: 0,
  in_transit: 0,
  reading: 0,
  series: 0,
  solo: 0,
  want_to_buy: 0,
  want_to_read: 0,
};

function getQuickCounts(accessToken: string, query = ""): request.Test {
  const path = query === "" ? "/api/books/quick-counts" : `/api/books/quick-counts?${query}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

function listParamsForChip({
  chip,
  scope,
}: {
  chip: LibraryQuickFilterKey;
  scope: LibraryScope;
}): [string, string][] {
  const chipParams = CHIP_LIST_PARAMS[chip];
  if (scope === "favorites") {
    return [...chipParams.filter(([name]) => name !== "isFavorite"), ["isFavorite", "true"]];
  }
  if (scope === "all") {
    return chipParams;
  }
  const chipOwners = chipParams.filter(([name]) => name === "owner").map(([, value]) => value);
  const scopedOwners =
    chipOwners.length === 0
      ? PHYSICAL_OWNERSHIP
      : chipOwners.filter((owner) => PHYSICAL_OWNERSHIP.includes(owner));
  return [
    ...chipParams.filter(([name]) => name !== "owner"),
    ...scopedOwners.map((owner): [string, string] => ["owner", owner]),
  ];
}

async function listTotalCount({
  accessToken,
  params,
}: {
  accessToken: string;
  params: [string, string][];
}): Promise<number> {
  const query = new URLSearchParams([...params, ["pageSize", "1"]]).toString();
  const res = await request(app.getHttpServer())
    .get(`/api/books?${query}`)
    .set("Authorization", `Bearer ${accessToken}`);
  expect(res.status).toBe(200);
  return TotalCountSchema.parse(res.body).totalCount;
}

async function quickCountsOf(accessToken: string, query = ""): Promise<LibraryQuickCounts> {
  const res = await getQuickCounts(accessToken, query);
  expect(res.status).toBe(200);
  return z
    .object({
      all: z.number(),
      borrowed: z.number(),
      favorites: z.number(),
      finished: z.number(),
      in_transit: z.number(),
      reading: z.number(),
      series: z.number(),
      solo: z.number(),
      want_to_buy: z.number(),
      want_to_read: z.number(),
    })
    .strict()
    .parse(res.body);
}

async function seedLibrary(): Promise<SeededLibrary> {
  const { accessToken, userId } = await context.registerVerifyAndLogin();
  const author = await prisma.author.create({
    data: { name: "Frank Herbert", normalizedName: "frank herbert", userId },
    select: { id: true },
  });
  const series = await prisma.series.create({
    data: { name: "Saga", normalizedName: "saga", userId },
    select: { id: true },
  });
  const publisher = await prisma.publisher.create({
    data: { name: "Penguin", normalizedName: "penguin", userId },
    select: { id: true },
  });
  const books: SeedBookInput[] = [
    {
      genres: ["fantasy"],
      isFavorite: true,
      language: "english",
      ownershipStatus: "owned",
      publisherId: publisher.id,
      readingStatus: "reading",
      seriesId: series.id,
      title: "Dune Messiah",
    },
    {
      genres: ["fantasy"],
      isFavorite: false,
      language: "english",
      ownershipStatus: "owned",
      readingStatus: "finished",
      seriesId: series.id,
      title: "Dune",
    },
    {
      genres: ["fantasy"],
      isFavorite: true,
      language: "ukrainian",
      ownershipStatus: "want_to_buy",
      readingStatus: "want_to_read",
      title: "Dune Chronicles",
    },
    {
      genres: ["history"],
      isFavorite: true,
      language: "english",
      ownershipStatus: "borrowed_from_someone",
      readingStatus: "rereading",
      title: "Dune Guide",
    },
    {
      genres: ["fantasy"],
      isFavorite: false,
      language: "english",
      ownershipStatus: "lent_to_someone",
      publisherId: publisher.id,
      readingStatus: "finished",
      title: "The Hobbit",
    },
    {
      genres: ["fantasy"],
      isFavorite: false,
      language: "ukrainian",
      ownershipStatus: "in_transit",
      readingStatus: "want_to_read",
      title: "Silmarillion",
    },
    {
      genres: ["history"],
      isFavorite: true,
      language: "ukrainian",
      ownershipStatus: "none",
      readingStatus: "not_started",
      seriesId: series.id,
      title: "Chronicle",
    },
  ];
  for (const book of books) {
    await prisma.book.create({
      data: {
        authors: { create: [{ authorId: author.id, position: 0 }] },
        genres: book.genres,
        isFavorite: book.isFavorite,
        language: book.language,
        ownershipStatus: book.ownershipStatus,
        publisherId: book.publisherId ?? null,
        readingStatus: book.readingStatus,
        seriesId: book.seriesId ?? null,
        title: book.title,
        userId,
      },
    });
  }
  return { accessToken, publisherId: publisher.id };
}

describe("GET /api/books/quick-counts", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/books/quick-counts");

    expect(res.status).toBe(401);
  });

  it("returns 400 for an inverted range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getQuickCounts(accessToken, "yearMin=2000&yearMax=1990");

    expect(res.status).toBe(400);
  });

  it("returns zero for every chip of an empty library", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    expect(await quickCountsOf(accessToken)).toEqual(ZERO_COUNTS);
  });

  it("counts every chip over the whole library without a query", async () => {
    const { accessToken } = await seedLibrary();

    expect(await quickCountsOf(accessToken)).toEqual({
      all: 7,
      borrowed: 2,
      favorites: 4,
      finished: 2,
      in_transit: 1,
      reading: 2,
      series: 3,
      solo: 4,
      want_to_buy: 1,
      want_to_read: 2,
    });
  });

  it("follows the search query", async () => {
    const { accessToken } = await seedLibrary();

    expect(await quickCountsOf(accessToken, "q=Dune")).toEqual({
      all: 4,
      borrowed: 1,
      favorites: 3,
      finished: 1,
      in_transit: 0,
      reading: 2,
      series: 2,
      solo: 2,
      want_to_buy: 1,
      want_to_read: 1,
    });
  });

  it("follows the advanced genre and language filters", async () => {
    const { accessToken } = await seedLibrary();

    expect(await quickCountsOf(accessToken, "genre=fantasy&language=english")).toEqual({
      all: 3,
      borrowed: 1,
      favorites: 1,
      finished: 2,
      in_transit: 0,
      reading: 1,
      series: 2,
      solo: 1,
      want_to_buy: 0,
      want_to_read: 0,
    });
  });

  it("ignores the quick filter axes the request carries", async () => {
    const { accessToken } = await seedLibrary();

    const plain = await quickCountsOf(accessToken, "q=Dune");
    const withQuickAxes = await quickCountsOf(
      accessToken,
      "q=Dune&status=reading&status=rereading&owner=owned&bookType=solo&isFavorite=true",
    );

    expect(withQuickAxes).toEqual(plain);
  });

  it("restricts every chip to favorite books in the favorites scope", async () => {
    const { accessToken } = await seedLibrary();

    expect(await quickCountsOf(accessToken, "scope=favorites")).toEqual({
      all: 4,
      borrowed: 1,
      favorites: 4,
      finished: 0,
      in_transit: 0,
      reading: 2,
      series: 2,
      solo: 2,
      want_to_buy: 1,
      want_to_read: 1,
    });
  });

  it("keeps every chip inside the physical library in the my scope", async () => {
    const { accessToken } = await seedLibrary();

    expect(await quickCountsOf(accessToken, "scope=my")).toEqual({
      all: 4,
      borrowed: 2,
      favorites: 2,
      finished: 2,
      in_transit: 0,
      reading: 2,
      series: 2,
      solo: 2,
      want_to_buy: 0,
      want_to_read: 0,
    });
  });

  it("scopes every chip to the books of one publisher", async () => {
    const { accessToken, publisherId } = await seedLibrary();

    expect(
      await quickCountsOf(accessToken, `publisher=${publisherId}&searchPublisher=false`),
    ).toEqual({
      ...ZERO_COUNTS,
      all: 2,
      borrowed: 1,
      favorites: 1,
      finished: 1,
      reading: 1,
      series: 1,
      solo: 1,
    });
  });

  it("never counts the books of another user", async () => {
    await seedLibrary();
    const { accessToken } = await context.registerVerifyAndLogin();

    expect(await quickCountsOf(accessToken)).toEqual(ZERO_COUNTS);
  });

  it("does not count trashed books", async () => {
    const { accessToken } = await seedLibrary();
    await prisma.book.updateMany({
      data: TRASH_RETENTION.stamp(new Date()),
      where: { title: "Dune" },
    });

    const counts = await quickCountsOf(accessToken, "q=Dune");

    expect(counts.all).toBe(3);
    expect(counts.finished).toBe(0);
  });

  const INVARIANT_CASES: { params: [string, string][]; scope: LibraryScope }[] = [
    { params: [], scope: "all" },
    { params: [["q", "Dune"]], scope: "all" },
    { params: [["genre", "fantasy"]], scope: "my" },
    { params: [["language", "english"]], scope: "favorites" },
    { params: [["q", "Dune"]], scope: "favorites" },
  ];

  it.each(INVARIANT_CASES)(
    "matches the list total for every chip of scope $scope with $params",
    async ({ params, scope }) => {
      const { accessToken } = await seedLibrary();
      const countsQuery = new URLSearchParams([...params, ["scope", scope]]).toString();
      const counts = await quickCountsOf(accessToken, countsQuery);

      for (const chip of CHIPS_BY_SCOPE[scope]) {
        const totalCount = await listTotalCount({
          accessToken,
          params: [...params, ...listParamsForChip({ chip, scope })],
        });
        expect({ chip, count: counts[chip] }).toEqual({ chip, count: totalCount });
      }
    },
  );
});

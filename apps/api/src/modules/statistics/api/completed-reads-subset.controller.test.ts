import type {
  Nullable,
  ReadingStatisticsCompletedReadsSubsetPage,
  ReadingStatisticsDrilldown,
} from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import {
  ReadingStatisticsCompletedReadsSubsetPageSchema,
  ReadingStatisticsOverviewSchema,
} from "@app/shared";
import { addDays } from "date-fns";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { addDaysToIsoDate, parseIsoDate } from "../../../core/iso-date.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { READING_CYCLE_STATE } from "../../books/index.js";
import { StatisticsModule } from "../statistics.module.js";

const SUBSET = {
  cursorMessage: "Invalid pagination cursor",
  path: "/api/statistics/completed-reads/subset",
  periodFrom: "2024-01-01",
  periodTo: "2024-12-31",
  snapshotVersion: { current: 1, unknown: 2 },
} as const;

const SNAPSHOT_REFS = {
  alpha: { authorId: "a1000000-0000-4000-8000-000000000001", name: "Alpha Author" },
  beta: { authorId: "a1000000-0000-4000-8000-000000000002", name: "Beta Author" },
  north: { name: "North Press", publisherId: "b1000000-0000-4000-8000-000000000001" },
  south: { name: "South Press", publisherId: "b1000000-0000-4000-8000-000000000002" },
} as const;

type CycleSeed = {
  bookId: string;
  finishedAt: string;
  id?: string;
  snapshot?: Prisma.InputJsonObject;
  state?: string;
  userId?: string;
};

type DrilledCounts = { listed: number; ranked: number; total: number };

type RankingRow = { completedReadCount: number; drilldown: ReadingStatisticsDrilldown };

type SnapshotAttributes = {
  authors?: { authorId: string; name: string }[];
  genres?: string[];
  language?: Nullable<string>;
  pagesCount?: Nullable<number>;
  publisher?: Nullable<{ name: string; publisherId: string }>;
  title?: string;
  version?: number;
};

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;
let reader: AuthenticatedUser;

function agreeingCounts(count: number): DrilledCounts {
  return { listed: count, ranked: count, total: count };
}

function completionSnapshot({
  authors = [],
  genres = [],
  language = null,
  pagesCount = 320,
  publisher = null,
  title = "Title at completion",
  version = SUBSET.snapshotVersion.current,
}: SnapshotAttributes): Prisma.InputJsonObject {
  return {
    authors,
    book: { genres, language, pagesCount, title },
    provenance: "tracked_at_completion",
    publisher,
    series: null,
    version,
  };
}

async function createBook({
  genres = [],
  language = "ukrainian",
  title,
  userId = reader.userId,
}: {
  genres?: string[];
  language?: string;
  title: string;
  userId?: string;
}): Promise<string> {
  const book = await prisma.book.create({
    data: { genres, language, readingStatus: "finished", title, userId },
    select: { id: true },
  });
  return book.id;
}

function cycleId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function cycleIdsOf(page: ReadingStatisticsCompletedReadsSubsetPage): string[] {
  return page.items.map((item) => item.readingCycleId);
}

async function drillInto(row: RankingRow): Promise<DrilledCounts> {
  const page = await subsetPage(reader, toSubsetQuery(row.drilldown));
  return { listed: page.items.length, ranked: row.completedReadCount, total: page.totalCount };
}

function firstRow<TRow>(rows: TRow[]): TRow {
  const [row] = rows;
  if (row === undefined) {
    throw new Error("expected the ranking to have a first row");
  }
  return row;
}

function inYear(query: Record<string, string>): Record<string, string> {
  return { periodFrom: SUBSET.periodFrom, periodTo: SUBSET.periodTo, ...query };
}

async function moveToTrash(bookId: string): Promise<void> {
  const trashedAt = new Date();
  await prisma.book.update({
    data: { deletedAt: trashedAt, purgeAt: addDays(trashedAt, TRASH_RETENTION.days) },
    where: { id: bookId },
  });
}

function overview(query: Record<string, string>) {
  return request(app.getHttpServer())
    .get("/api/statistics/overview")
    .query(query)
    .set("Authorization", `Bearer ${reader.accessToken}`);
}

function registerOtherReader(): Promise<AuthenticatedUser> {
  return context.registerVerifyAndLogin({ email: "other@example.com", nickname: "other" });
}

async function seedCycles(cycles: CycleSeed[]): Promise<void> {
  await prisma.bookReadingCycle.createMany({
    data: cycles.map(
      ({
        bookId,
        finishedAt,
        id,
        snapshot,
        state = READING_CYCLE_STATE.finished,
        userId = reader.userId,
      }) => ({
        bookId,
        completionMetadata: snapshot,
        finishedAt: parseIsoDate(finishedAt),
        id,
        state,
        userId,
      }),
    ),
  });
}

function subset(user: AuthenticatedUser, query: Record<string, string>) {
  return request(app.getHttpServer())
    .get(SUBSET.path)
    .query(query)
    .set("Authorization", `Bearer ${user.accessToken}`);
}

async function subsetPage(
  user: AuthenticatedUser,
  query: Record<string, string>,
): Promise<ReadingStatisticsCompletedReadsSubsetPage> {
  const response = await subset(user, query);
  expect(response.status).toBe(200);
  return ReadingStatisticsCompletedReadsSubsetPageSchema.parse(response.body);
}

function toSubsetQuery(drilldown: ReadingStatisticsDrilldown): Record<string, string> {
  if (drilldown.kind !== "completed_reads_subset") {
    throw new Error(`expected a completed reads subset drilldown, got ${drilldown.kind}`);
  }

  const entries = Object.entries(drilldown.filters);
  const filters = entries.flatMap(([key, value]): [string, string][] =>
    value === undefined ? [] : [[key, String(value)]],
  );
  return {
    ...Object.fromEntries(filters),
    ...(drilldown.period.from === null ? {} : { periodFrom: drilldown.period.from }),
    periodTo: drilldown.period.to,
  };
}

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, StatisticsModule]);
  app = context.app;
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await context.close();
});

beforeEach(async () => {
  await truncateAllTables(app);
  context.reset();
  reader = await context.registerVerifyAndLogin();
  await prisma.userProfileSettings.upsert({
    create: { timezone: "UTC", userId: reader.userId },
    update: { timezone: "UTC" },
    where: { userId: reader.userId },
  });
});

describe("GET /api/statistics/completed-reads/subset matching the completion snapshot", () => {
  it("returns both reads of a reread co-authored book for its second author", async () => {
    const coAuthored = await createBook({ title: "Co-authored" });
    const solo = await createBook({ title: "Solo" });
    const pair = completionSnapshot({ authors: [SNAPSHOT_REFS.alpha, SNAPSHOT_REFS.beta] });
    await seedCycles([
      { bookId: coAuthored, finishedAt: "2024-02-10", id: cycleId(1), snapshot: pair },
      { bookId: coAuthored, finishedAt: "2024-06-15", id: cycleId(2), snapshot: pair },
      {
        bookId: solo,
        finishedAt: "2024-04-01",
        id: cycleId(3),
        snapshot: completionSnapshot({ authors: [SNAPSHOT_REFS.alpha] }),
      },
    ]);

    const page = await subsetPage(reader, inYear({ authorId: SNAPSHOT_REFS.beta.authorId }));

    expect(page.items.map((item) => [item.readingCycleId, item.book.bookId])).toEqual([
      [cycleId(2), coAuthored],
      [cycleId(1), coAuthored],
    ]);
    expect(page.totalCount).toBe(2);
  });

  it("matches a genre that is not the first one in a multi-genre snapshot", async () => {
    const bookId = await createBook({ title: "Genres" });
    await seedCycles([
      {
        bookId,
        finishedAt: "2024-03-01",
        id: cycleId(1),
        snapshot: completionSnapshot({ genres: ["fantasy", "scifi", "classic"] }),
      },
      {
        bookId,
        finishedAt: "2024-03-02",
        id: cycleId(2),
        snapshot: completionSnapshot({ genres: ["fantasy"] }),
      },
    ]);

    const page = await subsetPage(reader, inYear({ genre: "scifi" }));

    expect(cycleIdsOf(page)).toEqual([cycleId(1)]);
  });

  it("matches the publisher recorded at completion", async () => {
    const bookId = await createBook({ title: "Published" });
    await seedCycles([
      {
        bookId,
        finishedAt: "2024-03-01",
        id: cycleId(1),
        snapshot: completionSnapshot({ publisher: SNAPSHOT_REFS.north }),
      },
      {
        bookId,
        finishedAt: "2024-03-02",
        id: cycleId(2),
        snapshot: completionSnapshot({ publisher: SNAPSHOT_REFS.south }),
      },
      {
        bookId,
        finishedAt: "2024-03-03",
        id: cycleId(3),
        snapshot: completionSnapshot({ publisher: null }),
      },
    ]);

    const page = await subsetPage(reader, inYear({ publisherId: SNAPSHOT_REFS.north.publisherId }));

    expect(cycleIdsOf(page)).toEqual([cycleId(1)]);
  });

  it("matches the language recorded at completion", async () => {
    const bookId = await createBook({ title: "Translated" });
    await seedCycles([
      {
        bookId,
        finishedAt: "2024-03-01",
        id: cycleId(1),
        snapshot: completionSnapshot({ language: "english" }),
      },
      {
        bookId,
        finishedAt: "2024-03-02",
        id: cycleId(2),
        snapshot: completionSnapshot({ language: "ukrainian" }),
      },
      {
        bookId,
        finishedAt: "2024-03-03",
        id: cycleId(3),
        snapshot: completionSnapshot({ language: null }),
      },
    ]);

    const page = await subsetPage(reader, inYear({ language: "english" }));

    expect(cycleIdsOf(page)).toEqual([cycleId(1)]);
  });

  describe("after the book is edited", () => {
    const EDIT = {
      atCompletion: { genre: "scifi", language: "english", title: "Title at completion" },
      now: { genre: "romance", language: "polish", title: "Renamed later" },
    } as const;

    beforeEach(async () => {
      const bookId = await createBook({
        genres: [EDIT.atCompletion.genre],
        language: EDIT.atCompletion.language,
        title: EDIT.atCompletion.title,
      });
      await seedCycles([
        {
          bookId,
          finishedAt: "2024-05-01",
          id: cycleId(1),
          snapshot: completionSnapshot({
            genres: [EDIT.atCompletion.genre],
            language: EDIT.atCompletion.language,
            title: EDIT.atCompletion.title,
          }),
        },
      ]);
      await prisma.book.update({
        data: {
          genres: [EDIT.now.genre],
          language: EDIT.now.language,
          title: EDIT.now.title,
        },
        where: { id: bookId },
      });
    });

    it.each(["genre", "language"] as const)(
      "matches the %s captured at completion and ignores the current one",
      async (field) => {
        const atCompletion = await subsetPage(
          reader,
          inYear({ [field]: EDIT.atCompletion[field] }),
        );
        const now = await subsetPage(reader, inYear({ [field]: EDIT.now[field] }));

        expect({ atCompletion: cycleIdsOf(atCompletion), now: now.totalCount }).toEqual({
          atCompletion: [cycleId(1)],
          now: 0,
        });
      },
    );

    it("shows the title captured at completion", async () => {
      const page = await subsetPage(reader, inYear({ genre: EDIT.atCompletion.genre }));

      expect(page.items.map((item) => item.book.title)).toEqual([EDIT.atCompletion.title]);
    });
  });
});

describe("GET /api/statistics/completed-reads/subset opened from an overview ranking", () => {
  const TASTE_DRILLDOWN_CASES: {
    expected: { author: number; genre: number; language: number; publisher: number };
    name: string;
    query: Record<string, string>;
  }[] = [
    {
      expected: { author: 5, genre: 5, language: 4, publisher: 4 },
      name: "a year",
      query: { period: "year", year: "2024" },
    },
    {
      expected: { author: 6, genre: 6, language: 5, publisher: 5 },
      name: "all time",
      query: { period: "all_time" },
    },
  ];

  beforeEach(async () => {
    const other = await registerOtherReader();
    const coAuthored = await createBook({ title: "Co-authored" });
    const solo = await createBook({ title: "Solo" });
    const doubled = await createBook({ title: "Doubled" });
    const trashed = await createBook({ title: "Trashed" });
    const theirs = await createBook({ title: "Theirs", userId: other.userId });
    const alphaNorthEnglish: SnapshotAttributes = {
      authors: [SNAPSHOT_REFS.alpha],
      genres: ["fantasy"],
      language: "english",
      publisher: SNAPSHOT_REFS.north,
    };
    const coAuthoredSnapshot = completionSnapshot({
      ...alphaNorthEnglish,
      authors: [SNAPSHOT_REFS.alpha, SNAPSHOT_REFS.beta],
      genres: ["fantasy", "scifi"],
    });
    await seedCycles([
      { bookId: coAuthored, finishedAt: "2024-02-10", snapshot: coAuthoredSnapshot },
      { bookId: coAuthored, finishedAt: "2024-06-15", snapshot: coAuthoredSnapshot },
      {
        bookId: solo,
        finishedAt: "2024-04-01",
        snapshot: completionSnapshot({
          ...alphaNorthEnglish,
          language: "ukrainian",
          publisher: SNAPSHOT_REFS.south,
        }),
      },
      {
        bookId: doubled,
        finishedAt: "2024-05-05",
        snapshot: completionSnapshot({
          ...alphaNorthEnglish,
          authors: [SNAPSHOT_REFS.alpha, SNAPSHOT_REFS.alpha],
          genres: ["fantasy", "fantasy"],
        }),
      },
      {
        bookId: trashed,
        finishedAt: "2024-09-09",
        snapshot: completionSnapshot(alphaNorthEnglish),
      },
      { bookId: solo, finishedAt: "2024-03-03" },
      {
        bookId: solo,
        finishedAt: "2024-07-07",
        snapshot: completionSnapshot({
          ...alphaNorthEnglish,
          version: SUBSET.snapshotVersion.unknown,
        }),
      },
      {
        bookId: solo,
        finishedAt: "2024-08-08",
        snapshot: completionSnapshot(alphaNorthEnglish),
        state: READING_CYCLE_STATE.abandoned,
      },
      { bookId: solo, finishedAt: "2023-11-11", snapshot: completionSnapshot(alphaNorthEnglish) },
      {
        bookId: theirs,
        finishedAt: "2024-05-20",
        snapshot: completionSnapshot(alphaNorthEnglish),
        userId: other.userId,
      },
    ]);
    await moveToTrash(trashed);
  });

  it.each(TASTE_DRILLDOWN_CASES)(
    "lists exactly the reads each top taste row counts over $name",
    async ({ expected, query }) => {
      const response = await overview(query);
      expect(response.status).toBe(200);
      const parsed = ReadingStatisticsOverviewSchema.parse(response.body);

      const drilled = {
        author: await drillInto(firstRow(parsed.authors.frequency)),
        genre: await drillInto(firstRow(parsed.genres.frequency)),
        language: await drillInto(firstRow(parsed.languages.items)),
        publisher: await drillInto(firstRow(parsed.publishers.items)),
      };

      expect(drilled).toEqual({
        author: agreeingCounts(expected.author),
        genre: agreeingCounts(expected.genre),
        language: agreeingCounts(expected.language),
        publisher: agreeingCounts(expected.publisher),
      });
    },
  );
});

describe("GET /api/statistics/completed-reads/subset and snapshots the ranking cannot read", () => {
  const UNREADABLE_SNAPSHOT_CASES: { attributes: SnapshotAttributes; name: string }[] = [
    { attributes: { language: "klingon" }, name: "an unknown language" },
    { attributes: { pagesCount: -5 }, name: "a negative page count" },
  ];

  async function drillIntoTopAuthorAndGenre(): Promise<{
    author: DrilledCounts;
    genre: DrilledCounts;
  }> {
    const response = await overview({ period: "year", year: "2024" });
    expect(response.status).toBe(200);
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);
    return {
      author: await drillInto(firstRow(parsed.authors.frequency)),
      genre: await drillInto(firstRow(parsed.genres.frequency)),
    };
  }

  async function seedNextToReadableRead(attributes: SnapshotAttributes): Promise<void> {
    const bookId = await createBook({ title: "Snapshots" });
    const fantasyByAlpha: SnapshotAttributes = {
      authors: [SNAPSHOT_REFS.alpha],
      genres: ["fantasy"],
    };
    await seedCycles([
      { bookId, finishedAt: "2024-03-01", snapshot: completionSnapshot(fantasyByAlpha) },
      {
        bookId,
        finishedAt: "2024-03-02",
        snapshot: completionSnapshot({ ...fantasyByAlpha, ...attributes }),
      },
    ]);
  }

  it.each(UNREADABLE_SNAPSHOT_CASES)(
    "leaves out a snapshot with $name just as the ranking does",
    async ({ attributes }) => {
      await seedNextToReadableRead(attributes);

      expect(await drillIntoTopAuthorAndGenre()).toEqual({
        author: agreeingCounts(1),
        genre: agreeingCounts(1),
      });
    },
  );

  it("keeps a snapshot whose language and page count were never recorded", async () => {
    await seedNextToReadableRead({ language: null, pagesCount: null });

    expect(await drillIntoTopAuthorAndGenre()).toEqual({
      author: agreeingCounts(2),
      genre: agreeingCounts(2),
    });
  });
});

describe("GET /api/statistics/completed-reads/subset and the ranking over snapshots that do not parse", () => {
  type EveryTasteDrill = Record<"author" | "genre" | "language" | "publisher", DrilledCounts>;

  const PARSEABLE_TASTE: SnapshotAttributes = {
    authors: [SNAPSHOT_REFS.alpha],
    genres: ["fantasy"],
    language: "english",
    publisher: SNAPSHOT_REFS.north,
  };

  const MALFORMED_SNAPSHOT_CASES: { name: string; snapshot: Prisma.InputJsonObject }[] = [
    { name: "an unknown provenance", snapshot: parseableSnapshotWith({ provenance: "imported" }) },
    {
      name: "a series missing its required fields",
      snapshot: parseableSnapshotWith({ series: { name: 1 } }),
    },
    {
      name: "a co-author whose id is not an RFC UUID",
      snapshot: parseableSnapshotWith({
        authors: [
          SNAPSHOT_REFS.alpha,
          { authorId: "12345678-1234-0234-8234-123456789012", name: "Broken Id" },
        ],
      }),
    },
    {
      name: "a co-author without a name",
      snapshot: parseableSnapshotWith({
        authors: [{ authorId: SNAPSHOT_REFS.beta.authorId }, SNAPSHOT_REFS.alpha],
      }),
    },
    {
      name: "a publisher without a name",
      snapshot: parseableSnapshotWith({
        publisher: { publisherId: SNAPSHOT_REFS.north.publisherId },
      }),
    },
    { name: "a null genre list", snapshot: parseableSnapshotWithBook({ genres: null }) },
    { name: "a title that is not a string", snapshot: parseableSnapshotWithBook({ title: 42 }) },
    { name: "a fractional page count", snapshot: parseableSnapshotWithBook({ pagesCount: 12.5 }) },
  ];

  async function drillIntoEveryTopRow(): Promise<EveryTasteDrill> {
    const response = await overview({ period: "year", year: "2024" });
    expect(response.status).toBe(200);
    const parsed = ReadingStatisticsOverviewSchema.parse(response.body);
    return {
      author: await drillInto(firstRow(parsed.authors.frequency)),
      genre: await drillInto(firstRow(parsed.genres.frequency)),
      language: await drillInto(firstRow(parsed.languages.items)),
      publisher: await drillInto(firstRow(parsed.publishers.items)),
    };
  }

  function everyRankingAgreeingOn(count: number): EveryTasteDrill {
    return {
      author: agreeingCounts(count),
      genre: agreeingCounts(count),
      language: agreeingCounts(count),
      publisher: agreeingCounts(count),
    };
  }

  function parseableSnapshotWith(fields: Prisma.InputJsonObject): Prisma.InputJsonObject {
    return { ...completionSnapshot(PARSEABLE_TASTE), ...fields };
  }

  function parseableSnapshotWithBook(fields: Prisma.InputJsonObject): Prisma.InputJsonObject {
    return parseableSnapshotWith({
      book: {
        genres: ["fantasy"],
        language: "english",
        pagesCount: 320,
        title: "Title at completion",
        ...fields,
      },
    });
  }

  async function seedRereads(snapshots: Prisma.InputJsonObject[]): Promise<void> {
    const bookId = await createBook({ title: "Snapshots" });
    await seedCycles(
      snapshots.map((snapshot, index) => ({
        bookId,
        finishedAt: addDaysToIsoDate("2024-03-01", index),
        snapshot,
      })),
    );
  }

  it.each(MALFORMED_SNAPSHOT_CASES)(
    "counts a read with $name the same way in every taste ranking and the subset",
    async ({ snapshot }) => {
      await seedRereads([completionSnapshot(PARSEABLE_TASTE), snapshot]);

      expect(await drillIntoEveryTopRow()).toEqual(everyRankingAgreeingOn(1));
    },
  );

  it("counts two parseable reads and a legacy read with a null genre list as two everywhere", async () => {
    const parseable = completionSnapshot(PARSEABLE_TASTE);
    await seedRereads([
      parseable,
      parseable,
      { ...parseableSnapshotWithBook({ genres: null }), provenance: "legacy_current_metadata" },
    ]);

    expect(await drillIntoEveryTopRow()).toEqual(everyRankingAgreeingOn(2));
  });
});

describe("GET /api/statistics/completed-reads/subset period bounds and snapshot versions", () => {
  it("includes reads on both bounds and leaves out the days just outside", async () => {
    const period = { periodFrom: "2024-03-10", periodTo: "2024-03-20" } as const;
    const bookId = await createBook({ title: "Bounded" });
    const fantasy = completionSnapshot({ genres: ["fantasy"] });
    await seedCycles([
      {
        bookId,
        finishedAt: addDaysToIsoDate(period.periodFrom, -1),
        id: cycleId(1),
        snapshot: fantasy,
      },
      { bookId, finishedAt: period.periodFrom, id: cycleId(2), snapshot: fantasy },
      { bookId, finishedAt: period.periodTo, id: cycleId(3), snapshot: fantasy },
      {
        bookId,
        finishedAt: addDaysToIsoDate(period.periodTo, 1),
        id: cycleId(4),
        snapshot: fantasy,
      },
    ]);

    const page = await subsetPage(reader, { ...period, genre: "fantasy" });

    expect(page.items.map((item) => item.finishedAt)).toEqual([period.periodTo, period.periodFrom]);
  });

  it("accepts a custom period of 700 days and lists reads across all of it", async () => {
    const periodFrom = "2022-01-01";
    const periodTo = addDaysToIsoDate(periodFrom, 700);
    const bookId = await createBook({ title: "Long span" });
    const fantasy = completionSnapshot({ genres: ["fantasy"] });
    await seedCycles([
      {
        bookId,
        finishedAt: addDaysToIsoDate(periodFrom, 10),
        id: cycleId(1),
        snapshot: fantasy,
      },
      { bookId, finishedAt: addDaysToIsoDate(periodTo, -10), id: cycleId(2), snapshot: fantasy },
    ]);

    const page = await subsetPage(reader, { genre: "fantasy", periodFrom, periodTo });

    expect(cycleIdsOf(page)).toEqual([cycleId(2), cycleId(1)]);
  });

  it("accepts a period one day short of the 1830-day limit", async () => {
    const periodFrom = addDaysToIsoDate(SUBSET.periodTo, -1829);
    const bookId = await createBook({ title: "Widest" });
    await seedCycles([
      {
        bookId,
        finishedAt: periodFrom,
        id: cycleId(1),
        snapshot: completionSnapshot({ genres: ["fantasy"] }),
      },
    ]);

    const page = await subsetPage(reader, {
      genre: "fantasy",
      periodFrom,
      periodTo: SUBSET.periodTo,
    });

    expect(cycleIdsOf(page)).toEqual([cycleId(1)]);
  });

  it("reaches back to the oldest read when periodFrom is absent", async () => {
    const bookId = await createBook({ title: "All time" });
    const fantasy = completionSnapshot({ genres: ["fantasy"] });
    await seedCycles([
      { bookId, finishedAt: "1995-05-01", id: cycleId(1), snapshot: fantasy },
      { bookId, finishedAt: "2024-06-01", id: cycleId(2), snapshot: fantasy },
      { bookId, finishedAt: "2025-01-01", id: cycleId(3), snapshot: fantasy },
    ]);

    const page = await subsetPage(reader, { genre: "fantasy", periodTo: SUBSET.periodTo });

    expect(cycleIdsOf(page)).toEqual([cycleId(2), cycleId(1)]);
  });

  it("returns an empty page when no read carries the attribute", async () => {
    const bookId = await createBook({ title: "Elsewhere" });
    await seedCycles([
      { bookId, finishedAt: "2024-04-01", snapshot: completionSnapshot({ genres: ["horror"] }) },
    ]);

    const response = await subset(reader, inYear({ genre: "fantasy" }));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [], nextCursor: null, totalCount: 0 });
  });

  it("leaves out reads with no completion snapshot or a snapshot of another version", async () => {
    const bookId = await createBook({ genres: ["fantasy"], title: "Versions" });
    await seedCycles([
      {
        bookId,
        finishedAt: "2024-04-01",
        id: cycleId(1),
        snapshot: completionSnapshot({ genres: ["fantasy"] }),
      },
      { bookId, finishedAt: "2024-04-02", id: cycleId(2) },
      {
        bookId,
        finishedAt: "2024-04-03",
        id: cycleId(3),
        snapshot: completionSnapshot({
          genres: ["fantasy"],
          version: SUBSET.snapshotVersion.unknown,
        }),
      },
    ]);

    const page = await subsetPage(reader, inYear({ genre: "fantasy" }));

    expect({ ids: cycleIdsOf(page), totalCount: page.totalCount }).toEqual({
      ids: [cycleId(1)],
      totalCount: 1,
    });
  });
});

describe("GET /api/statistics/completed-reads/subset paging", () => {
  const PAGING = { matchingReads: 55, maxPages: 5, pageSize: 20, readsPerDay: 3 } as const;

  function expectedNewestFirstThenById(): string[] {
    const days = Math.ceil(PAGING.matchingReads / PAGING.readsPerDay);
    const newestDayFirst = Array.from({ length: days }, (_, offset) => days - 1 - offset);
    return newestDayFirst.flatMap((day) =>
      Array.from({ length: PAGING.readsPerDay }, (_, slot) => day * PAGING.readsPerDay + slot)
        .filter((index) => index < PAGING.matchingReads)
        .map(cycleId),
    );
  }

  async function walkPages(): Promise<ReadingStatisticsCompletedReadsSubsetPage[]> {
    const pages: ReadingStatisticsCompletedReadsSubsetPage[] = [];
    let cursor: Nullable<string> = null;
    do {
      const page = await subsetPage(
        reader,
        inYear({
          genre: "fantasy",
          limit: String(PAGING.pageSize),
          ...(cursor === null ? {} : { cursor }),
        }),
      );
      pages.push(page);
      cursor = page.nextCursor;
    } while (cursor !== null && pages.length < PAGING.maxPages);
    return pages;
  }

  beforeEach(async () => {
    const marathon = await createBook({ title: "Marathon" });
    const noise = await createBook({ title: "Noise" });
    await seedCycles([
      ...Array.from({ length: PAGING.matchingReads }, (_, index) => ({
        bookId: marathon,
        finishedAt: addDaysToIsoDate(SUBSET.periodFrom, Math.floor(index / PAGING.readsPerDay)),
        id: cycleId(index),
        snapshot: completionSnapshot({ genres: ["fantasy"] }),
      })),
      ...Array.from({ length: PAGING.readsPerDay * 2 }, (_, index) => ({
        bookId: noise,
        finishedAt: addDaysToIsoDate(SUBSET.periodFrom, index),
        id: cycleId(PAGING.matchingReads + index),
        snapshot: completionSnapshot({ genres: ["horror"] }),
      })),
    ]);
  });

  it("splits 55 matching reads into pages of 20, 20 and 15, each with the total", async () => {
    const pages = await walkPages();

    expect(
      pages.map((page) => ({
        hasNextPage: page.nextCursor !== null,
        size: page.items.length,
        totalCount: page.totalCount,
      })),
    ).toEqual([
      { hasNextPage: true, size: 20, totalCount: 55 },
      { hasNextPage: true, size: 20, totalCount: 55 },
      { hasNextPage: false, size: 15, totalCount: 55 },
    ]);
  });

  it("returns every matching read exactly once across the pages", async () => {
    const seen = (await walkPages()).flatMap(cycleIdsOf);

    expect(seen).toHaveLength(PAGING.matchingReads);
    expect(new Set(seen)).toEqual(
      new Set(Array.from({ length: PAGING.matchingReads }, (_, index) => cycleId(index))),
    );
  });

  it("orders the pages newest first and same-day reads by id", async () => {
    const seen = (await walkPages()).flatMap(cycleIdsOf);

    expect(seen).toEqual(expectedNewestFirstThenById());
  });
});

describe("GET /api/statistics/completed-reads/subset rejections", () => {
  const VALID_QUERY = { genre: "fantasy", periodTo: SUBSET.periodTo } as const;

  const INVALID_QUERIES: { field: string; name: string; query: Record<string, string> }[] = [
    { field: "", name: "an unknown query param", query: { ...VALID_QUERY, sortBy: "title" } },
    {
      field: "authorId",
      name: "an author id that is not a uuid",
      query: { authorId: "author-1", periodTo: SUBSET.periodTo },
    },
    {
      field: "periodTo",
      name: "a day that does not exist",
      query: { ...VALID_QUERY, periodTo: "2024-02-30" },
    },
    { field: "filter", name: "no filter", query: { periodTo: SUBSET.periodTo } },
    { field: "filter", name: "two filters", query: { ...VALID_QUERY, language: "english" } },
    { field: "limit", name: "an empty page", query: { ...VALID_QUERY, limit: "0" } },
    { field: "limit", name: "a page over 50", query: { ...VALID_QUERY, limit: "51" } },
    {
      field: "periodFrom",
      name: "a period that starts after it ends",
      query: { ...VALID_QUERY, periodFrom: addDaysToIsoDate(SUBSET.periodTo, 1) },
    },
    {
      field: "periodTo",
      name: "a period of 1830 days",
      query: { ...VALID_QUERY, periodFrom: addDaysToIsoDate(SUBSET.periodTo, -1830) },
    },
  ];

  it("rejects an anonymous request", async () => {
    const response = await request(app.getHttpServer())
      .get(SUBSET.path)
      .query(inYear({ genre: "fantasy" }));

    expect(response.status).toBe(401);
  });

  it.each(INVALID_QUERIES)("rejects $name", async ({ field, query }) => {
    const response = await subset(reader, query);

    expect(response.status).toBe(400);
    expect(response.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
  });

  it("rejects a cursor that does not decode", async () => {
    const response = await subset(reader, { ...VALID_QUERY, cursor: "not-a-cursor" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: SUBSET.cursorMessage });
  });

  describe("a page one cursor", () => {
    const FIRST_PAGE = { ...VALID_QUERY, limit: "1" } as const;

    const CURSOR_REUSE_CASES: {
      name: string;
      query: Record<string, string>;
      requester: "other_reader" | "owner";
    }[] = [
      { name: "another genre", query: { ...FIRST_PAGE, genre: "scifi" }, requester: "owner" },
      {
        name: "another period",
        query: { ...FIRST_PAGE, periodFrom: SUBSET.periodFrom },
        requester: "owner",
      },
      { name: "another reader", query: FIRST_PAGE, requester: "other_reader" },
    ];

    async function firstPageCursor(): Promise<string> {
      const page = await subsetPage(reader, FIRST_PAGE);
      if (page.nextCursor === null) {
        throw new Error("expected the first page to have a next page");
      }
      return page.nextCursor;
    }

    beforeEach(async () => {
      const bookId = await createBook({ title: "Two reads" });
      const snapshot = completionSnapshot({ genres: ["fantasy", "scifi"] });
      await seedCycles([
        { bookId, finishedAt: "2024-03-01", id: cycleId(1), snapshot },
        { bookId, finishedAt: "2024-03-02", id: cycleId(2), snapshot },
      ]);
    });

    it("continues the query that issued it", async () => {
      const cursor = await firstPageCursor();

      const page = await subsetPage(reader, { ...FIRST_PAGE, cursor });

      expect({ ids: cycleIdsOf(page), nextCursor: page.nextCursor }).toEqual({
        ids: [cycleId(1)],
        nextCursor: null,
      });
    });

    it.each(CURSOR_REUSE_CASES)(
      "is rejected when reused for $name",
      async ({ query, requester }) => {
        const cursor = await firstPageCursor();
        const user = requester === "owner" ? reader : await registerOtherReader();

        const withoutCursor = await subset(user, query);
        const withCursor = await subset(user, { ...query, cursor });

        expect(withoutCursor.status).toBe(200);
        expect(withCursor.status).toBe(400);
        expect(withCursor.body).toMatchObject({ message: SUBSET.cursorMessage });
      },
    );
  });
});

describe("GET /api/statistics/completed-reads/subset ownership and lifecycle", () => {
  it("keeps another reader's matching reads out of the subset", async () => {
    const other = await registerOtherReader();
    const mine = await createBook({ title: "Mine" });
    const theirs = await createBook({ title: "Theirs", userId: other.userId });
    const fantasy = completionSnapshot({ genres: ["fantasy"] });
    await seedCycles([
      { bookId: mine, finishedAt: "2024-03-01", id: cycleId(1), snapshot: fantasy },
      {
        bookId: theirs,
        finishedAt: "2024-03-02",
        id: cycleId(2),
        snapshot: fantasy,
        userId: other.userId,
      },
      {
        bookId: theirs,
        finishedAt: "2024-03-03",
        id: cycleId(3),
        snapshot: fantasy,
        userId: other.userId,
      },
    ]);

    const readerPage = await subsetPage(reader, inYear({ genre: "fantasy" }));
    const otherPage = await subsetPage(other, inYear({ genre: "fantasy" }));

    expect({ other: cycleIdsOf(otherPage), reader: cycleIdsOf(readerPage) }).toEqual({
      other: [cycleId(3), cycleId(2)],
      reader: [cycleId(1)],
    });
  });

  it("keeps a read of a book moved to trash and marks it soft deleted", async () => {
    const bookId = await createBook({ title: "Trashed" });
    await seedCycles([
      {
        bookId,
        finishedAt: "2024-03-01",
        id: cycleId(1),
        snapshot: completionSnapshot({ genres: ["fantasy"] }),
      },
    ]);
    await moveToTrash(bookId);

    const page = await subsetPage(reader, inYear({ genre: "fantasy" }));

    expect(
      page.items.map((item) => ({
        bookState: item.book.bookState,
        readingCycleId: item.readingCycleId,
      })),
    ).toEqual([{ bookState: "soft_deleted", readingCycleId: cycleId(1) }]);
  });

  it("leaves out cycles that are active, abandoned or dropped", async () => {
    const bookId = await createBook({ title: "Lifecycle" });
    const fantasy = completionSnapshot({ genres: ["fantasy"] });
    await seedCycles([
      { bookId, finishedAt: "2024-03-01", id: cycleId(1), snapshot: fantasy },
      {
        bookId,
        finishedAt: "2024-03-02",
        id: cycleId(2),
        snapshot: fantasy,
        state: READING_CYCLE_STATE.active,
      },
      {
        bookId,
        finishedAt: "2024-03-03",
        id: cycleId(3),
        snapshot: fantasy,
        state: READING_CYCLE_STATE.abandoned,
      },
      {
        bookId,
        finishedAt: "2024-03-04",
        id: cycleId(4),
        snapshot: fantasy,
        state: READING_CYCLE_STATE.dnf,
      },
    ]);

    const page = await subsetPage(reader, inYear({ genre: "fantasy" }));

    expect({ ids: cycleIdsOf(page), totalCount: page.totalCount }).toEqual({
      ids: [cycleId(1)],
      totalCount: 1,
    });
  });
});

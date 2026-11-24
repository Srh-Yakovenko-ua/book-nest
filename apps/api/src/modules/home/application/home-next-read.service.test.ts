import type { Nullable, ReadingStatus } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { UserSettingsContextService } from "../../profile/index.js";
import type { SeriesOrderCheckService } from "../../series-order-check/index.js";
import type { SeriesService } from "../../series/index.js";
import type { HomeBookFacts } from "../domain/home-book.mapper.js";
import type { HomeNextReadRepository } from "../infrastructure/home-next-read.repository.js";
import type { HomeBookFactsLoader } from "./home-book-facts.loader.js";

import { fakeOf } from "../../../test/fake.js";
import { HomeNextReadService } from "./home-next-read.service.js";

type NextReadSources = {
  calendar: UserSettingsContextService["calendar"];
  favoriteContinuations: SeriesService["favoriteContinuations"];
  findDisabledSeriesIds: HomeNextReadRepository["findDisabledSeriesIds"];
  findLibraryCandidates: HomeNextReadRepository["findLibraryCandidates"];
  findQueueEntries: HomeNextReadRepository["findQueueEntries"];
  findSeriesBooks: HomeNextReadRepository["findSeriesBooks"];
  listIssues: SeriesOrderCheckService["listIssues"];
  loadFacts: HomeBookFactsLoader["loadFacts"];
};

type Resolved<TMethod extends (...args: never[]) => Promise<unknown>> = Awaited<
  ReturnType<TMethod>
>;

const USER_ID = "11111111-1111-4111-8111-111111111111";

const BOOK_IDS = {
  library: "44444444-4444-4444-8444-444444444444",
  queued: "22222222-2222-4222-8222-222222222222",
} as const;

const SOURCE_FAILURE = "source unavailable";

const CALENDAR: Resolved<UserSettingsContextService["calendar"]> = {
  timeZone: "Europe/Kyiv",
  today: new Date("2026-11-24T00:00:00.000Z"),
  weekStartDay: "monday",
};

function availableSources(): NextReadSources {
  return {
    calendar: vi.fn<UserSettingsContextService["calendar"]>().mockResolvedValue(CALENDAR),
    favoriteContinuations: vi
      .fn<SeriesService["favoriteContinuations"]>()
      .mockResolvedValue(fakeOf<Resolved<SeriesService["favoriteContinuations"]>>({ items: [] })),
    findDisabledSeriesIds: vi
      .fn<HomeNextReadRepository["findDisabledSeriesIds"]>()
      .mockResolvedValue([]),
    findLibraryCandidates: vi
      .fn<HomeNextReadRepository["findLibraryCandidates"]>()
      .mockResolvedValue([
        {
          createdAt: new Date("2026-01-10T00:00:00.000Z"),
          id: BOOK_IDS.library,
          isFavorite: false,
          readingStatus: "want_to_read",
          series: null,
          seriesId: null,
        },
      ]),
    findQueueEntries: vi.fn<HomeNextReadRepository["findQueueEntries"]>().mockResolvedValue([
      {
        id: BOOK_IDS.queued,
        ownershipStatus: "owned",
        queuePosition: 1,
        readingStatus: "want_to_read",
      },
    ]),
    findSeriesBooks: vi.fn<HomeNextReadRepository["findSeriesBooks"]>().mockResolvedValue([]),
    listIssues: vi
      .fn<SeriesOrderCheckService["listIssues"]>()
      .mockResolvedValue(fakeOf<Resolved<SeriesOrderCheckService["listIssues"]>>({ items: [] })),
    loadFacts: vi.fn<HomeBookFactsLoader["loadFacts"]>().mockResolvedValue(
      new Map([
        [
          BOOK_IDS.library,
          bookFacts({
            id: BOOK_IDS.library,
            queuePosition: null,
            readingStatus: "want_to_read",
            title: "On the shelf",
          }),
        ],
        [
          BOOK_IDS.queued,
          bookFacts({
            id: BOOK_IDS.queued,
            queuePosition: 1,
            readingStatus: "want_to_read",
            title: "Queued",
          }),
        ],
      ]),
    ),
  };
}

function bookFacts({
  id,
  queuePosition,
  readingStatus,
  title,
}: {
  id: string;
  queuePosition: Nullable<number>;
  readingStatus: ReadingStatus;
  title: string;
}): HomeBookFacts {
  return {
    authors: [],
    cover: null,
    currentPage: null,
    cycleStartedAt: null,
    id,
    isFavorite: false,
    ownershipStatus: "owned",
    pagesCount: 320,
    progressPercent: null,
    queue:
      queuePosition === null
        ? null
        : { position: queuePosition, priority: null, reason: null, targetDate: null },
    readingStatus,
    series: null,
    title,
  };
}

function buildService(overrides: Partial<NextReadSources> = {}): HomeNextReadService {
  const sources = { ...availableSources(), ...overrides };
  return new HomeNextReadService(
    fakeOf<HomeBookFactsLoader>({ loadFacts: sources.loadFacts }),
    fakeOf<HomeNextReadRepository>({
      findDisabledSeriesIds: sources.findDisabledSeriesIds,
      findLibraryCandidates: sources.findLibraryCandidates,
      findQueueEntries: sources.findQueueEntries,
      findSeriesBooks: sources.findSeriesBooks,
    }),
    fakeOf<SeriesOrderCheckService>({ listIssues: sources.listIssues }),
    fakeOf<SeriesService>({ favoriteContinuations: sources.favoriteContinuations }),
    fakeOf<UserSettingsContextService>({ calendar: sources.calendar }),
  );
}

function failingSource(): Promise<never> {
  return Promise.reject(new Error(SOURCE_FAILURE));
}

describe("HomeNextReadService.getNextRead", () => {
  it("lists a failing favorite series source while queue and library still recommend", async () => {
    const service = buildService({ favoriteContinuations: failingSource });

    const view = await service.getNextRead(USER_ID);

    expect(view.unavailableSources).toEqual(["favorite_series"]);
    expect(
      view.candidates.map((candidate) => ({ id: candidate.book.id, source: candidate.source })),
    ).toEqual([
      { id: BOOK_IDS.queued, source: "queue" },
      { id: BOOK_IDS.library, source: "library" },
    ]);
  });

  it("lists a failing library source while the queue still recommends", async () => {
    const service = buildService({ findLibraryCandidates: failingSource });

    const view = await service.getNextRead(USER_ID);

    expect(view.unavailableSources).toEqual(["library"]);
    expect(
      view.candidates.map((candidate) => ({ id: candidate.book.id, source: candidate.source })),
    ).toEqual([{ id: BOOK_IDS.queued, source: "queue" }]);
  });

  it("lists a failing queue source while the library still recommends", async () => {
    const service = buildService({ findQueueEntries: failingSource });

    const view = await service.getNextRead(USER_ID);

    expect(view.unavailableSources).toEqual(["queue"]);
    expect(
      view.candidates.map((candidate) => ({ id: candidate.book.id, source: candidate.source })),
    ).toEqual([{ id: BOOK_IDS.library, source: "library" }]);
  });
});

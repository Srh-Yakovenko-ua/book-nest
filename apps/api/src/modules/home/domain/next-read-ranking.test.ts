import type {
  HomeNextReadSource,
  Nullable,
  OwnershipStatus,
  ReadingStatus,
  SeriesContinuationRankReason,
} from "@app/shared";

import { HOME_DASHBOARD_RULES } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { HomeTemporalContext } from "./home-temporal-context.js";
import type { NextReadLibraryBook, NextReadPick, NextReadQueueEntry } from "./next-read-ranking.js";

import { collectSeriesOrderBlockedBookIds } from "./next-read-eligibility.js";
import {
  isLibraryBookEligible,
  mergeNextReadPicks,
  pickFavoriteSeriesCandidates,
  pickQueueCandidates,
  rankLibraryCandidates,
} from "./next-read-ranking.js";

const TODAY = "2026-11-24";

const FOLLOWING_DAYS = ["2026-11-25", "2026-11-26", "2026-11-27"];

const CANDIDATE_LIMIT = HOME_DASHBOARD_RULES.nextRead.candidateLimit;

const NO_BLOCKED_BOOKS: ReadonlySet<string> = new Set();

const NO_CONTINUATIONS: ReadonlyMap<string, string> = new Map();

const NO_DISABLED_SERIES: ReadonlySet<string> = new Set();

const SERIES_ID = "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e61";

const UNAVAILABLE_QUEUE_VARIANTS: readonly {
  ownershipStatus: OwnershipStatus;
  readingStatus: ReadingStatus;
}[] = [
  { ownershipStatus: "owned", readingStatus: "reading" },
  { ownershipStatus: "owned", readingStatus: "finished" },
  { ownershipStatus: "lent_to_someone", readingStatus: "want_to_read" },
  { ownershipStatus: "in_transit", readingStatus: "not_started" },
];

function bookIdsOf(picks: readonly NextReadPick[]): string[] {
  return picks.map((pick) => pick.bookId);
}

function idsOfIndexes(indexes: readonly number[]): string[] {
  return indexes.map(uuidOf);
}

function libraryBook({
  createdAt = "2026-06-01T12:00:00.000Z",
  index,
  isFavorite = false,
  readingStatus = "want_to_read",
  seriesId = null,
}: {
  createdAt?: string;
  index: number;
  isFavorite?: boolean;
  readingStatus?: ReadingStatus;
  seriesId?: Nullable<string>;
}): NextReadLibraryBook {
  return { createdAt: new Date(createdAt), id: uuidOf(index), isFavorite, readingStatus, seriesId };
}

function pickFrom(source: HomeNextReadSource, index: number): NextReadPick {
  const reasonBySource = {
    favorite_series: "favorite_series",
    library: "planned",
    queue: "queue_next",
  } as const satisfies Record<HomeNextReadSource, NextReadPick["reason"]>;
  return { bookId: uuidOf(index), reason: reasonBySource[source], source };
}

function queueEntry({
  index,
  ownershipStatus = "owned",
  position,
  readingStatus = "want_to_read",
}: {
  index: number;
  ownershipStatus?: OwnershipStatus;
  position: number;
  readingStatus?: ReadingStatus;
}): NextReadQueueEntry {
  return { id: uuidOf(index), ownershipStatus, queuePosition: position, readingStatus };
}

function rankLibraryOn(today: string, books: readonly NextReadLibraryBook[]): NextReadPick[] {
  return rankLibraryCandidates({
    books,
    continuationBySeriesId: NO_CONTINUATIONS,
    disabledSeriesIds: NO_DISABLED_SERIES,
    temporal: temporalOn(today),
  });
}

function temporalOn(today: string): HomeTemporalContext {
  return {
    day: new Date(`${today}T00:00:00.000Z`),
    timeZone: "UTC",
    today,
    weekStartDay: "monday",
  };
}

function uuidOf(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

describe("pickQueueCandidates", () => {
  it("ranks queue books by position alone, whatever the input order", () => {
    const picks = pickQueueCandidates({
      blockedBookIds: NO_BLOCKED_BOOKS,
      entries: [
        queueEntry({ index: 1, position: 3 }),
        queueEntry({ index: 2, position: 1 }),
        queueEntry({ index: 3, position: 2 }),
      ],
    });

    expect(picks).toEqual([
      { bookId: uuidOf(2), reason: "queue_next", source: "queue" },
      { bookId: uuidOf(3), reason: "queue_next", source: "queue" },
      { bookId: uuidOf(1), reason: "queue_next", source: "queue" },
    ]);
  });

  it.each<ReadingStatus>(["reading", "rereading", "finished", "dnf"])(
    "skips a queue book that is %s",
    (readingStatus) => {
      const picks = pickQueueCandidates({
        blockedBookIds: NO_BLOCKED_BOOKS,
        entries: [
          queueEntry({ index: 1, position: 1, readingStatus }),
          queueEntry({ index: 2, position: 2 }),
        ],
      });

      expect(bookIdsOf(picks)).toEqual(idsOfIndexes([2]));
    },
  );

  it.each<OwnershipStatus>(["lent_to_someone", "in_transit", "want_to_buy", "none"])(
    "skips a queue book held as %s",
    (ownershipStatus) => {
      const picks = pickQueueCandidates({
        blockedBookIds: NO_BLOCKED_BOOKS,
        entries: [
          queueEntry({ index: 1, ownershipStatus, position: 1 }),
          queueEntry({ index: 2, position: 2 }),
        ],
      });

      expect(bookIdsOf(picks)).toEqual(idsOfIndexes([2]));
    },
  );

  it("offers a paused queue book", () => {
    const picks = pickQueueCandidates({
      blockedBookIds: NO_BLOCKED_BOOKS,
      entries: [queueEntry({ index: 1, position: 1, readingStatus: "paused" })],
    });

    expect(bookIdsOf(picks)).toEqual(idsOfIndexes([1]));
  });

  it("skips the affected and related books of a series order issue", () => {
    const blockedBookIds = collectSeriesOrderBlockedBookIds([
      { affectedBook: { id: uuidOf(1) }, relatedProblems: [{ affectedBookId: uuidOf(2) }] },
    ]);

    const picks = pickQueueCandidates({
      blockedBookIds,
      entries: [
        queueEntry({ index: 1, position: 1 }),
        queueEntry({ index: 2, position: 2 }),
        queueEntry({ index: 3, position: 3 }),
      ],
    });

    expect(bookIdsOf(picks)).toEqual(idsOfIndexes([3]));
  });

  it("finds the first eligible book at position 125 behind 124 ineligible ones", () => {
    const ineligible = Array.from({ length: 31 }, (_, round) => round).flatMap((round) =>
      UNAVAILABLE_QUEUE_VARIANTS.map((variant, offset) => {
        const position = round * UNAVAILABLE_QUEUE_VARIANTS.length + offset + 1;
        return queueEntry({ index: position, position, ...variant });
      }),
    );
    const entries = [...ineligible, queueEntry({ index: 125, position: 125 })];

    const merged = mergeNextReadPicks({
      limit: CANDIDATE_LIMIT,
      sources: [pickQueueCandidates({ blockedBookIds: NO_BLOCKED_BOOKS, entries })],
    });

    expect(ineligible).toHaveLength(124);
    expect(merged).toEqual([{ bookId: uuidOf(125), reason: "queue_next", source: "queue" }]);
  });
});

describe("pickFavoriteSeriesCandidates", () => {
  it.each<SeriesContinuationRankReason>(["available", "paused"])(
    "offers a %s favorite series continuation",
    (rankReason) => {
      expect(
        pickFavoriteSeriesCandidates([{ bookId: uuidOf(1), ownershipStatus: "owned", rankReason }]),
      ).toEqual([{ bookId: uuidOf(1), reason: "favorite_series", source: "favorite_series" }]);
    },
  );

  it.each<SeriesContinuationRankReason>([
    "reading",
    "lent",
    "in_transit",
    "want_to_buy",
    "not_owned",
  ])("skips a favorite series continuation ranked %s", (rankReason) => {
    expect(
      pickFavoriteSeriesCandidates([{ bookId: uuidOf(1), ownershipStatus: "owned", rankReason }]),
    ).toEqual([]);
  });
});

describe("rankLibraryCandidates", () => {
  it("ranks favorite planned, planned, favorite on shelf, then other on-shelf books", () => {
    const picks = rankLibraryOn(TODAY, [
      libraryBook({
        createdAt: "2020-01-01T12:00:00.000Z",
        index: 1,
        readingStatus: "not_started",
      }),
      libraryBook({
        createdAt: "2021-01-01T12:00:00.000Z",
        index: 2,
        isFavorite: true,
        readingStatus: "not_started",
      }),
      libraryBook({ createdAt: "2022-01-01T12:00:00.000Z", index: 3 }),
      libraryBook({ createdAt: "2026-11-01T12:00:00.000Z", index: 4, isFavorite: true }),
    ]);

    expect(picks).toEqual([
      { bookId: uuidOf(4), reason: "favorite_planned", source: "library" },
      { bookId: uuidOf(3), reason: "planned", source: "library" },
      { bookId: uuidOf(2), reason: "favorite_on_shelf", source: "library" },
      { bookId: uuidOf(1), reason: "long_on_shelf", source: "library" },
    ]);
  });

  it.each<ReadingStatus>(["reading", "rereading", "paused", "finished", "dnf"])(
    "leaves a %s book out of the library ranking",
    (readingStatus) => {
      expect(rankLibraryOn(TODAY, [libraryBook({ index: 1, readingStatus })])).toEqual([]);
    },
  );

  it("orders a group oldest first with ties by id, as a rotation of that order", () => {
    const books = [
      libraryBook({ createdAt: "2024-06-01T12:00:00.000Z", index: 32 }),
      libraryBook({ createdAt: "2024-03-01T12:00:00.000Z", index: 20 }),
      libraryBook({ createdAt: "2024-06-01T12:00:00.000Z", index: 31 }),
      libraryBook({ createdAt: "2024-01-01T12:00:00.000Z", index: 10 }),
    ];

    expect([
      idsOfIndexes([10, 20, 31, 32]),
      idsOfIndexes([20, 31, 32, 10]),
      idsOfIndexes([31, 32, 10, 20]),
      idsOfIndexes([32, 10, 20, 31]),
    ]).toContainEqual(bookIdsOf(rankLibraryOn(TODAY, books)));
  });

  it("keeps the same order all day whatever the input order", () => {
    const books = [
      libraryBook({ createdAt: "2024-01-01T12:00:00.000Z", index: 1 }),
      libraryBook({ createdAt: "2024-02-01T12:00:00.000Z", index: 2 }),
      libraryBook({ createdAt: "2024-03-01T12:00:00.000Z", index: 3 }),
    ];

    expect(bookIdsOf(rankLibraryOn(TODAY, [...books].reverse()))).toEqual(
      bookIdsOf(rankLibraryOn(TODAY, books)),
    );
  });

  it("shifts a group by one book on each following day", () => {
    const books = [
      libraryBook({ createdAt: "2024-01-01T12:00:00.000Z", index: 1 }),
      libraryBook({ createdAt: "2024-02-01T12:00:00.000Z", index: 2 }),
      libraryBook({ createdAt: "2024-03-01T12:00:00.000Z", index: 3 }),
    ];
    const orders = [TODAY, ...FOLLOWING_DAYS].map((day) => bookIdsOf(rankLibraryOn(day, books)));

    const shiftedByOne = orders.slice(0, -1).map(([first, ...rest]) => [...rest, first]);

    expect(orders.slice(1)).toEqual(shiftedByOne);
  });

  it("rotates each group in place without mixing books across groups", () => {
    const books = [
      libraryBook({ createdAt: "2024-01-01T12:00:00.000Z", index: 1, isFavorite: true }),
      libraryBook({ createdAt: "2024-02-01T12:00:00.000Z", index: 2, isFavorite: true }),
      libraryBook({ createdAt: "2024-01-01T12:00:00.000Z", index: 3 }),
      libraryBook({ createdAt: "2024-02-01T12:00:00.000Z", index: 4 }),
      libraryBook({ createdAt: "2024-03-01T12:00:00.000Z", index: 5 }),
    ];

    const groupedPerDay = [TODAY, ...FOLLOWING_DAYS].map((day) => {
      const order = bookIdsOf(rankLibraryOn(day, books));
      return [new Set(order.slice(0, 2)), new Set(order.slice(2))];
    });

    expect(groupedPerDay).toEqual(
      [TODAY, ...FOLLOWING_DAYS].map(() => [
        new Set(idsOfIndexes([1, 2])),
        new Set(idsOfIndexes([3, 4, 5])),
      ]),
    );
  });

  it("calls an on-shelf book long on shelf once it was added 365 days ago", () => {
    const picks = rankLibraryOn(TODAY, [
      libraryBook({
        createdAt: "2025-11-24T12:00:00.000Z",
        index: 1,
        readingStatus: "not_started",
      }),
    ]);

    expect(picks).toEqual([{ bookId: uuidOf(1), reason: "long_on_shelf", source: "library" }]);
  });

  it("calls an on-shelf book added 364 days ago a discovery", () => {
    const picks = rankLibraryOn(TODAY, [
      libraryBook({
        createdAt: "2025-11-25T12:00:00.000Z",
        index: 1,
        readingStatus: "not_started",
      }),
    ]);

    expect(picks).toEqual([{ bookId: uuidOf(1), reason: "discovery", source: "library" }]);
  });

  it("offers only the continuation of a series", () => {
    const picks = rankLibraryCandidates({
      books: [
        libraryBook({ index: 1, seriesId: SERIES_ID }),
        libraryBook({ index: 2, seriesId: SERIES_ID }),
        libraryBook({ index: 3 }),
      ],
      continuationBySeriesId: new Map([[SERIES_ID, uuidOf(2)]]),
      disabledSeriesIds: NO_DISABLED_SERIES,
      temporal: temporalOn(TODAY),
    });

    expect(new Set(bookIdsOf(picks))).toEqual(new Set(idsOfIndexes([2, 3])));
  });
});

describe("isLibraryBookEligible", () => {
  it("accepts a standalone book", () => {
    expect(
      isLibraryBookEligible({
        book: libraryBook({ index: 1 }),
        continuationBySeriesId: NO_CONTINUATIONS,
        disabledSeriesIds: NO_DISABLED_SERIES,
      }),
    ).toBe(true);
  });

  it("accepts the continuation of its series", () => {
    expect(
      isLibraryBookEligible({
        book: libraryBook({ index: 1, seriesId: SERIES_ID }),
        continuationBySeriesId: new Map([[SERIES_ID, uuidOf(1)]]),
        disabledSeriesIds: NO_DISABLED_SERIES,
      }),
    ).toBe(true);
  });

  it("rejects a series book that is not the continuation", () => {
    expect(
      isLibraryBookEligible({
        book: libraryBook({ index: 1, seriesId: SERIES_ID }),
        continuationBySeriesId: new Map([[SERIES_ID, uuidOf(2)]]),
        disabledSeriesIds: NO_DISABLED_SERIES,
      }),
    ).toBe(false);
  });

  it("rejects a series book when the series has no known continuation", () => {
    expect(
      isLibraryBookEligible({
        book: libraryBook({ index: 1, seriesId: SERIES_ID }),
        continuationBySeriesId: NO_CONTINUATIONS,
        disabledSeriesIds: NO_DISABLED_SERIES,
      }),
    ).toBe(false);
  });

  it("accepts any book of a series whose order check is disabled", () => {
    expect(
      isLibraryBookEligible({
        book: libraryBook({ index: 1, seriesId: SERIES_ID }),
        continuationBySeriesId: new Map([[SERIES_ID, uuidOf(2)]]),
        disabledSeriesIds: new Set([SERIES_ID]),
      }),
    ).toBe(true);
  });
});

describe("mergeNextReadPicks", () => {
  it("keeps the first source's pick when a book appears in several sources", () => {
    const merged = mergeNextReadPicks({
      limit: CANDIDATE_LIMIT,
      sources: [
        [pickFrom("queue", 1)],
        [pickFrom("favorite_series", 2)],
        [pickFrom("library", 1), pickFrom("library", 3)],
      ],
    });

    expect(merged).toEqual([
      pickFrom("queue", 1),
      pickFrom("favorite_series", 2),
      pickFrom("library", 3),
    ]);
  });

  it("caps the merged candidates at ten", () => {
    const merged = mergeNextReadPicks({
      limit: CANDIDATE_LIMIT,
      sources: [
        [1, 2, 3, 4, 5, 6].map((index) => pickFrom("queue", index)),
        [7, 8, 9, 10, 11, 12, 13, 14].map((index) => pickFrom("library", index)),
      ],
    });

    expect(CANDIDATE_LIMIT).toBe(10);
    expect(bookIdsOf(merged)).toEqual(idsOfIndexes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  });

  it("does not spend the cap on duplicates", () => {
    const merged = mergeNextReadPicks({
      limit: CANDIDATE_LIMIT,
      sources: [
        [1, 2, 3, 4, 5, 6].map((index) => pickFrom("queue", index)),
        [1, 2, 3, 7, 8, 9, 10, 11].map((index) => pickFrom("library", index)),
      ],
    });

    expect(bookIdsOf(merged)).toEqual(idsOfIndexes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  });
});

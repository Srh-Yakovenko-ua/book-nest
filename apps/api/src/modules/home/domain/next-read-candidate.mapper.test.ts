import type { HomeNextReadAction, ReadingStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { HomeBookFacts } from "./home-book.mapper.js";
import type { NextReadPick } from "./next-read-ranking.js";

import { toNextReadCandidate } from "./next-read-candidate.mapper.js";

const BOOK_ID = "8e7d6c5b-4a39-4281-9f0e-1d2c3b4a5f61";

const QUEUE_PICK: NextReadPick = { bookId: BOOK_ID, reason: "queue_next", source: "queue" };

const FAVORITE_SERIES_PICK: NextReadPick = {
  bookId: BOOK_ID,
  reason: "favorite_series",
  source: "favorite_series",
};

function factsFor(readingStatus: ReadingStatus): HomeBookFacts {
  return {
    authors: [],
    cover: null,
    currentPage: null,
    cycleStartedAt: null,
    id: BOOK_ID,
    isFavorite: false,
    ownershipStatus: "owned",
    pagesCount: 320,
    progressPercent: null,
    queue: { position: 1, priority: null, reason: null, targetDate: null },
    readingStatus,
    series: null,
    title: "The Left Hand of Darkness",
  };
}

describe("toNextReadCandidate", () => {
  it.each<[ReadingStatus, HomeNextReadAction]>([
    ["paused", "resume"],
    ["want_to_read", "start"],
    ["not_started", "start"],
  ])("offers a %s queue book with the %s action", (readingStatus, action) => {
    expect(toNextReadCandidate({ facts: factsFor(readingStatus), pick: QUEUE_PICK })).toMatchObject(
      {
        action,
        reason: "queue_next",
        source: "queue",
      },
    );
  });

  it.each<[ReadingStatus, HomeNextReadAction]>([
    ["paused", "resume"],
    ["not_started", "start"],
  ])("offers a %s favorite series continuation with the %s action", (readingStatus, action) => {
    expect(
      toNextReadCandidate({ facts: factsFor(readingStatus), pick: FAVORITE_SERIES_PICK }),
    ).toMatchObject({ action, reason: "favorite_series", source: "favorite_series" });
  });

  it.each<ReadingStatus>(["reading", "rereading", "finished", "dnf"])(
    "offers no candidate for a %s book",
    (readingStatus) => {
      expect(toNextReadCandidate({ facts: factsFor(readingStatus), pick: QUEUE_PICK })).toBeNull();
    },
  );
});

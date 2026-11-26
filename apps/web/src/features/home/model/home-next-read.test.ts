import type { HomeNextReadCandidate, HomeNextReadView } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  followingNextReadId,
  homeNextReadState,
  isQueueConfirmedEmpty,
  nextReadActionLabel,
  nextReadFlow,
  selectNextReadCandidate,
} from "./home-next-read";

const BOOK_IDS = {
  first: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01",
  second: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d02",
  third: "c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e03",
} as const;

const IN_QUEUE = { position: 1, priority: null, reason: null, targetDate: null } as const;

function candidate(
  id: string,
  overrides: Partial<Omit<HomeNextReadCandidate, "book">> = {},
): HomeNextReadCandidate {
  return {
    action: "start",
    book: {
      authors: [{ id: "d4e5f6a7-b8c9-4d0e-bf2a-3b4c5d6e7f04", name: "Террі Пратчетт" }],
      cover: null,
      currentPage: null,
      id,
      isFavorite: false,
      ownershipStatus: "owned",
      pagesCount: 320,
      progressPercent: null,
      readingStatus: "want_to_read",
      title: "Колір магії",
    },
    queue: null,
    reason: "planned",
    series: null,
    source: "library",
    ...overrides,
  };
}

const THREE_CANDIDATES = [
  candidate(BOOK_IDS.first),
  candidate(BOOK_IDS.second),
  candidate(BOOK_IDS.third),
];

function view(overrides: Partial<HomeNextReadView> = {}): HomeNextReadView {
  return { candidates: THREE_CANDIDATES, unavailableSources: [], ...overrides };
}

describe("homeNextReadState", () => {
  it("is loading before the first response", () => {
    expect(homeNextReadState({ data: undefined, isError: false })).toEqual({ kind: "loading" });
  });

  it("is an error when the first request fails", () => {
    expect(homeNextReadState({ data: undefined, isError: true })).toEqual({ kind: "error" });
  });

  it("is confirmed empty when no source failed and none has a candidate", () => {
    expect(homeNextReadState({ data: view({ candidates: [] }), isError: false })).toEqual({
      kind: "empty",
    });
  });

  it("is incomplete rather than empty when a source failed and no candidate came back", () => {
    expect(
      homeNextReadState({
        data: view({ candidates: [], unavailableSources: ["library"] }),
        isError: false,
      }),
    ).toEqual({ kind: "incomplete" });
  });

  it("shows the candidates and flags them incomplete when a source failed", () => {
    expect(
      homeNextReadState({ data: view({ unavailableSources: ["queue"] }), isError: false }),
    ).toEqual({ candidates: THREE_CANDIDATES, isIncomplete: true, kind: "candidates" });
  });

  it("keeps showing cached candidates while a refetch is failing", () => {
    expect(homeNextReadState({ data: view(), isError: true })).toEqual({
      candidates: THREE_CANDIDATES,
      isIncomplete: false,
      kind: "candidates",
    });
  });
});

describe("selectNextReadCandidate", () => {
  it("keeps the book the reader picked while it is still a candidate", () => {
    const selected = selectNextReadCandidate({
      candidates: THREE_CANDIDATES,
      selectedId: BOOK_IDS.second,
    });

    expect(selected?.book.id).toBe(BOOK_IDS.second);
  });

  it("falls back to the first candidate when the picked book is gone", () => {
    expect(
      selectNextReadCandidate({
        candidates: [candidate(BOOK_IDS.first), candidate(BOOK_IDS.third)],
        selectedId: BOOK_IDS.second,
      })?.book.id,
    ).toBe(BOOK_IDS.first);
  });

  it("starts with the first candidate when nothing was picked", () => {
    expect(
      selectNextReadCandidate({ candidates: THREE_CANDIDATES, selectedId: null })?.book.id,
    ).toBe(BOOK_IDS.first);
  });

  it("selects nothing when there are no candidates", () => {
    expect(selectNextReadCandidate({ candidates: [], selectedId: BOOK_IDS.first })).toBeNull();
  });
});

describe("followingNextReadId", () => {
  it("offers the candidates in order without repeating one before the cycle ends", () => {
    const candidates = THREE_CANDIDATES;
    const second = followingNextReadId({ candidates, currentId: BOOK_IDS.first });
    const third = followingNextReadId({ candidates, currentId: BOOK_IDS.second });

    expect([BOOK_IDS.first, second, third]).toEqual([
      BOOK_IDS.first,
      BOOK_IDS.second,
      BOOK_IDS.third,
    ]);
  });

  it("wraps from the last candidate back to the first", () => {
    expect(followingNextReadId({ candidates: THREE_CANDIDATES, currentId: BOOK_IDS.third })).toBe(
      BOOK_IDS.first,
    );
  });

  it("offers no other book when there is a single candidate", () => {
    expect(
      followingNextReadId({ candidates: [candidate(BOOK_IDS.first)], currentId: BOOK_IDS.first }),
    ).toBeNull();
  });
});

describe("nextReadFlow", () => {
  it("opens the queue dialog for a book from the reading queue", () => {
    expect(nextReadFlow(candidate(BOOK_IDS.first, { queue: IN_QUEUE, source: "queue" }))).toBe(
      "queueDialog",
    );
  });

  it("changes the reading status for a book outside the queue", () => {
    expect(nextReadFlow(candidate(BOOK_IDS.first))).toBe("statusChange");
  });
});

describe("nextReadActionLabel", () => {
  it("offers to start a planned book", () => {
    expect(nextReadActionLabel(candidate(BOOK_IDS.first))).toBe("start");
  });

  it("offers to continue the series for a favorite series continuation", () => {
    expect(
      nextReadActionLabel(
        candidate(BOOK_IDS.first, { reason: "favorite_series", source: "favorite_series" }),
      ),
    ).toBe("continueSeries");
  });

  it("offers to resume a paused book, even in a favorite series", () => {
    expect(
      nextReadActionLabel(
        candidate(BOOK_IDS.first, {
          action: "resume",
          reason: "favorite_series",
          source: "favorite_series",
        }),
      ),
    ).toBe("resume");
  });
});

describe("isQueueConfirmedEmpty", () => {
  it("is not confirmed before the first response", () => {
    expect(isQueueConfirmedEmpty(undefined)).toBe(false);
  });

  it("is confirmed when the queue answered and no candidate comes from it", () => {
    expect(isQueueConfirmedEmpty(view())).toBe(true);
  });

  it("is not confirmed when the queue source failed", () => {
    expect(isQueueConfirmedEmpty(view({ candidates: [], unavailableSources: ["queue"] }))).toBe(
      false,
    );
  });

  it("is not empty when a candidate comes from the queue", () => {
    expect(
      isQueueConfirmedEmpty(
        view({ candidates: [candidate(BOOK_IDS.first, { queue: IN_QUEUE, source: "queue" })] }),
      ),
    ).toBe(false);
  });
});

import type { ListBookView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { fakeOf } from "../../../test/fake.js";
import {
  buildCurrentlyReading,
  countDistinctGenres,
  LIST_OVERVIEW,
  nameGenreFacets,
  selectTopGenres,
} from "./list-overview.js";

const highlightedBook = fakeOf<ListBookView>({
  id: "6f6a1f1e-2a2d-4f3b-9b64-0f5f7a6c1d90",
  position: 2,
  title: "Dune",
});

describe("buildCurrentlyReading", () => {
  it("returns no currently reading block when no book is being read", () => {
    expect(buildCurrentlyReading({ book: undefined, readingCount: 0 })).toBeNull();
  });

  it("returns no currently reading block even when the reading counter disagrees", () => {
    expect(buildCurrentlyReading({ book: undefined, readingCount: 4 })).toBeNull();
  });

  it("reports the remaining active reads beside the highlighted book", () => {
    expect(buildCurrentlyReading({ book: highlightedBook, readingCount: 3 })).toEqual({
      book: highlightedBook,
      othersCount: 2,
    });
  });

  it("reports no other active read when the highlighted book is the only one", () => {
    expect(buildCurrentlyReading({ book: highlightedBook, readingCount: 1 })?.othersCount).toBe(0);
  });

  it("never reports a negative number of other active reads", () => {
    expect(buildCurrentlyReading({ book: highlightedBook, readingCount: 0 })?.othersCount).toBe(0);
  });
});

describe("countDistinctGenres", () => {
  it("counts no genre for a list without genre rows", () => {
    expect(countDistinctGenres([])).toBe(0);
  });

  it("counts a genre once no matter how many books carry it", () => {
    expect(
      countDistinctGenres([
        { count: 7, key: "fantasy" },
        { count: 2, key: "scifi" },
      ]),
    ).toBe(2);
  });

  it("counts a repeated genre key as a single genre", () => {
    expect(
      countDistinctGenres([
        { count: 3, key: "fantasy" },
        { count: 1, key: "fantasy" },
      ]),
    ).toBe(1);
  });
});

describe("nameGenreFacets", () => {
  it("names every genre from the resolved names and keeps its count", () => {
    expect(
      nameGenreFacets({
        nameByKey: new Map([
          ["fantasy", "Фентезі"],
          ["scifi", "Наукова фантастика"],
        ]),
        rows: [
          { count: 4, key: "fantasy" },
          { count: 1, key: "scifi" },
        ],
      }),
    ).toEqual([
      { count: 4, key: "fantasy", name: "Фентезі" },
      { count: 1, key: "scifi", name: "Наукова фантастика" },
    ]);
  });

  it("keeps a genre without a resolved name and shows its raw key", () => {
    expect(
      nameGenreFacets({
        nameByKey: new Map([["fantasy", "Фентезі"]]),
        rows: [
          { count: 4, key: "fantasy" },
          { count: 2, key: "unmapped_key" },
        ],
      }),
    ).toEqual([
      { count: 4, key: "fantasy", name: "Фентезі" },
      { count: 2, key: "unmapped_key", name: "unmapped_key" },
    ]);
  });
});

describe("selectTopGenres", () => {
  it("breaks a tie by the genre name instead of the technical key", () => {
    expect(
      selectTopGenres({
        limit: 3,
        nameByKey: new Map([
          ["detektyv", "Детектив"],
          ["fentezi", "Фентезі"],
          ["tryler", "Трилер"],
        ]),
        rows: [
          { count: 4, key: "detektyv" },
          { count: 4, key: "fentezi" },
          { count: 4, key: "tryler" },
        ],
      }).map((genre) => genre.name),
    ).toEqual(["Детектив", "Трилер", "Фентезі"]);
  });

  it("keeps the leading genres up to the limit in the order they arrive", () => {
    expect(
      selectTopGenres({
        limit: 2,
        nameByKey: new Map([
          ["fantasy", "Фентезі"],
          ["scifi", "Наукова фантастика"],
        ]),
        rows: [
          { count: 5, key: "fantasy" },
          { count: 3, key: "scifi" },
          { count: 1, key: "history" },
        ],
      }),
    ).toEqual([
      { count: 5, key: "fantasy", name: "Фентезі" },
      { count: 3, key: "scifi", name: "Наукова фантастика" },
    ]);
  });

  it("keeps every genre when the list holds fewer than the limit", () => {
    expect(
      selectTopGenres({
        limit: 3,
        nameByKey: new Map([["fantasy", "Фентезі"]]),
        rows: [{ count: 5, key: "fantasy" }],
      }),
    ).toEqual([{ count: 5, key: "fantasy", name: "Фентезі" }]);
  });

  it("caps the overview at three top genres", () => {
    const rows = [
      { count: 5, key: "fantasy" },
      { count: 4, key: "scifi" },
      { count: 3, key: "history" },
      { count: 2, key: "poetry" },
      { count: 1, key: "romance" },
    ];

    const top = selectTopGenres({
      limit: LIST_OVERVIEW.topGenresLimit,
      nameByKey: new Map(),
      rows,
    });

    expect(top.map((genre) => genre.key)).toEqual(["fantasy", "scifi", "history"]);
  });

  it("falls back to the raw key for a top genre without a resolved name", () => {
    expect(
      selectTopGenres({
        limit: 1,
        nameByKey: new Map([["scifi", "Наукова фантастика"]]),
        rows: [{ count: 5, key: "fantasy" }],
      }),
    ).toEqual([{ count: 5, key: "fantasy", name: "fantasy" }]);
  });
});

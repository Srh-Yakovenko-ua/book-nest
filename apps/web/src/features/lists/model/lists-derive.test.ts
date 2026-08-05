import { describe, expect, it } from "vitest";

import {
  countListsAttention,
  filterLists,
  filterListsByAttention,
  sortLists,
} from "./lists-derive";
import { makeCustomListCard } from "./lists.fixtures";

describe("filterLists", () => {
  const lists = [
    makeCustomListCard({ description: "Затишні історії", id: "a", name: "Осіннє читання" }),
    makeCustomListCard({ description: null, id: "b", name: "Літні пригоди" }),
    makeCustomListCard({ description: "Класика жанру", id: "c", name: "Детективи" }),
  ];

  it("returns every list when the search is empty", () => {
    expect(filterLists(lists, "")).toHaveLength(3);
  });

  it("returns every list when the search is only whitespace", () => {
    expect(filterLists(lists, "   ")).toHaveLength(3);
  });

  it("matches by name regardless of case", () => {
    expect(filterLists(lists, "ОСІННЄ").map((list) => list.id)).toEqual(["a"]);
  });

  it("matches by description regardless of case", () => {
    expect(filterLists(lists, "класика").map((list) => list.id)).toEqual(["c"]);
  });

  it("ignores surrounding whitespace in the search term", () => {
    expect(filterLists(lists, "  детективи  ").map((list) => list.id)).toEqual(["c"]);
  });

  it("keeps lists without a description when only the name matches", () => {
    expect(filterLists(lists, "літні").map((list) => list.id)).toEqual(["b"]);
  });

  it("returns nothing when neither name nor description matches", () => {
    expect(filterLists(lists, "фантастика")).toEqual([]);
  });
});

describe("sortLists", () => {
  it("does not mutate the original array", () => {
    const lists = [
      makeCustomListCard({ bookCount: 1, id: "a" }),
      makeCustomListCard({ bookCount: 9, id: "b" }),
    ];

    sortLists(lists, "books_count_desc");

    expect(lists.map((list) => list.id)).toEqual(["a", "b"]);
  });

  it("orders by most recently updated first", () => {
    const result = sortLists(
      [
        makeCustomListCard({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
        makeCustomListCard({ id: "new", updatedAt: "2026-03-01T00:00:00.000Z" }),
      ],
      "updated_desc",
    );

    expect(result.map((list) => list.id)).toEqual(["new", "old"]);
  });

  it("orders by most recently created first", () => {
    const result = sortLists(
      [
        makeCustomListCard({ createdAt: "2026-01-01T00:00:00.000Z", id: "old" }),
        makeCustomListCard({ createdAt: "2026-03-01T00:00:00.000Z", id: "new" }),
      ],
      "created_desc",
    );

    expect(result.map((list) => list.id)).toEqual(["new", "old"]);
  });

  it("orders by oldest created first", () => {
    const result = sortLists(
      [
        makeCustomListCard({ createdAt: "2026-03-01T00:00:00.000Z", id: "new" }),
        makeCustomListCard({ createdAt: "2026-01-01T00:00:00.000Z", id: "old" }),
      ],
      "created_asc",
    );

    expect(result.map((list) => list.id)).toEqual(["old", "new"]);
  });

  it("orders by title ascending", () => {
    const result = sortLists(
      [
        makeCustomListCard({ id: "g", name: "Гамма" }),
        makeCustomListCard({ id: "a", name: "Альфа" }),
        makeCustomListCard({ id: "b", name: "Бета" }),
      ],
      "title_asc",
    );

    expect(result.map((list) => list.name)).toEqual(["Альфа", "Бета", "Гамма"]);
  });

  it("orders by title descending", () => {
    const result = sortLists(
      [
        makeCustomListCard({ id: "a", name: "Альфа" }),
        makeCustomListCard({ id: "g", name: "Гамма" }),
        makeCustomListCard({ id: "b", name: "Бета" }),
      ],
      "title_desc",
    );

    expect(result.map((list) => list.name)).toEqual(["Гамма", "Бета", "Альфа"]);
  });

  it("orders by most books first", () => {
    const result = sortLists(
      [
        makeCustomListCard({ bookCount: 2, id: "few" }),
        makeCustomListCard({ bookCount: 12, id: "many" }),
        makeCustomListCard({ bookCount: 7, id: "some" }),
      ],
      "books_count_desc",
    );

    expect(result.map((list) => list.id)).toEqual(["many", "some", "few"]);
  });

  it("orders by fewest books first", () => {
    const result = sortLists(
      [
        makeCustomListCard({ bookCount: 12, id: "many" }),
        makeCustomListCard({ bookCount: 2, id: "few" }),
        makeCustomListCard({ bookCount: 7, id: "some" }),
      ],
      "books_count_asc",
    );

    expect(result.map((list) => list.id)).toEqual(["few", "some", "many"]);
  });
});

const NOW = new Date("2026-08-05T12:00:00.000Z");

function attentionLists() {
  return [
    makeCustomListCard({
      bookCount: 0,
      description: "Затишні історії",
      id: "empty",
      updatedAt: "2026-08-01T00:00:00.000Z",
    }),
    makeCustomListCard({
      bookCount: 4,
      description: null,
      id: "no-description",
      updatedAt: "2026-08-01T00:00:00.000Z",
    }),
    makeCustomListCard({
      bookCount: 7,
      description: "   ",
      id: "blank-description",
      updatedAt: "2026-08-01T00:00:00.000Z",
    }),
    makeCustomListCard({
      bookCount: 3,
      description: "Класика жанру",
      id: "stale",
      updatedAt: "2025-12-31T00:00:00.000Z",
    }),
    makeCustomListCard({
      bookCount: 5,
      description: "Свіжа добірка",
      id: "healthy",
      updatedAt: "2026-08-04T00:00:00.000Z",
    }),
  ];
}

describe("countListsAttention", () => {
  it("reports zeroes for an empty collection", () => {
    expect(countListsAttention([], NOW)).toEqual({ empty: 0, no_description: 0, stale: 0 });
  });

  it("counts every reason independently", () => {
    expect(countListsAttention(attentionLists(), NOW)).toEqual({
      empty: 1,
      no_description: 2,
      stale: 1,
    });
  });

  it("treats a whitespace-only description as missing", () => {
    const lists = [makeCustomListCard({ description: "   ", id: "blank" })];

    expect(countListsAttention(lists, NOW).no_description).toBe(1);
  });

  it("counts a list as stale only after six months without changes", () => {
    const lists = [
      makeCustomListCard({ id: "just-inside", updatedAt: "2026-02-06T00:00:00.000Z" }),
      makeCustomListCard({ id: "just-outside", updatedAt: "2026-02-04T00:00:00.000Z" }),
    ];

    expect(countListsAttention(lists, NOW).stale).toBe(1);
  });

  it("counts a list under several reasons at once", () => {
    const lists = [
      makeCustomListCard({
        bookCount: 0,
        description: null,
        id: "neglected",
        updatedAt: "2024-01-01T00:00:00.000Z",
      }),
    ];

    expect(countListsAttention(lists, NOW)).toEqual({ empty: 1, no_description: 1, stale: 1 });
  });
});

describe("filterListsByAttention", () => {
  it("returns every list when no reason is selected", () => {
    expect(filterListsByAttention(attentionLists(), null, NOW)).toHaveLength(5);
  });

  it("keeps only the lists matching the selected reason", () => {
    const filtered = filterListsByAttention(attentionLists(), "no_description", NOW);

    expect(filtered.map((list) => list.id)).toEqual(["no-description", "blank-description"]);
  });

  it("matches the count reported for the same reason", () => {
    const lists = attentionLists();

    for (const reason of ["empty", "no_description", "stale"] as const) {
      expect(filterListsByAttention(lists, reason, NOW)).toHaveLength(
        countListsAttention(lists, NOW)[reason],
      );
    }
  });
});

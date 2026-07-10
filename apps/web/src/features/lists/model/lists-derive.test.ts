import { describe, expect, it } from "vitest";

import { deriveListsStats, filterLists, sortLists } from "./lists-derive";
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

describe("deriveListsStats", () => {
  it("reports zeroes and no popular list for an empty collection", () => {
    expect(deriveListsStats([])).toEqual({
      booksInLists: 0,
      mostPopular: null,
      totalLists: 0,
    });
  });

  it("counts the total number of lists", () => {
    const stats = deriveListsStats([
      makeCustomListCard({ id: "a" }),
      makeCustomListCard({ id: "b" }),
    ]);

    expect(stats.totalLists).toBe(2);
  });

  it("sums the book counts across every list", () => {
    const stats = deriveListsStats([
      makeCustomListCard({ bookCount: 3, id: "a" }),
      makeCustomListCard({ bookCount: 5, id: "b" }),
      makeCustomListCard({ bookCount: 0, id: "c" }),
    ]);

    expect(stats.booksInLists).toBe(8);
  });

  it("picks the list with the most books as the most popular", () => {
    const stats = deriveListsStats([
      makeCustomListCard({ bookCount: 3, id: "a" }),
      makeCustomListCard({ bookCount: 9, id: "b" }),
      makeCustomListCard({ bookCount: 5, id: "c" }),
    ]);

    expect(stats.mostPopular?.id).toBe("b");
  });

  it("keeps the first list when several share the highest book count", () => {
    const stats = deriveListsStats([
      makeCustomListCard({ bookCount: 4, id: "first" }),
      makeCustomListCard({ bookCount: 4, id: "second" }),
    ]);

    expect(stats.mostPopular?.id).toBe("first");
  });
});

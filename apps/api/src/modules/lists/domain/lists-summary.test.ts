import { describe, expect, it } from "vitest";

import { type ListsSummaryCounts, toListsSummary } from "./lists-summary.js";

function counts(overrides: Partial<ListsSummaryCounts> = {}): ListsSummaryCounts {
  return {
    largestListBookCount: 0,
    listsWithBooksCount: 0,
    maxListsPerBook: 0,
    multiListBookCount: 0,
    totalListCount: 0,
    totalMembershipCount: 0,
    uniqueBookCount: 0,
    ...overrides,
  };
}

describe("toListsSummary", () => {
  it("keeps every raw count untouched", () => {
    const summary = toListsSummary(
      counts({
        largestListBookCount: 100,
        listsWithBooksCount: 29,
        maxListsPerBook: 5,
        multiListBookCount: 38,
        totalListCount: 31,
        totalMembershipCount: 264,
        uniqueBookCount: 146,
      }),
    );

    expect(summary).toMatchObject({
      largestListBookCount: 100,
      listsWithBooksCount: 29,
      maxListsPerBook: 5,
      multiListBookCount: 38,
      totalListCount: 31,
      totalMembershipCount: 264,
      uniqueBookCount: 146,
    });
  });

  it("derives the empty list count from the lists that hold books", () => {
    const summary = toListsSummary(counts({ listsWithBooksCount: 29, totalListCount: 31 }));

    expect(summary.emptyListCount).toBe(2);
  });

  it("rounds the average list size to the nearest book", () => {
    const summary = toListsSummary(counts({ totalListCount: 31, totalMembershipCount: 264 }));

    expect(summary.averageBooksPerList).toBe(9);
  });

  it("rounds half up", () => {
    const summary = toListsSummary(counts({ totalListCount: 2, totalMembershipCount: 3 }));

    expect(summary.averageBooksPerList).toBe(2);
  });

  it("reports zeros when the user has no lists", () => {
    expect(toListsSummary(counts())).toEqual({
      averageBooksPerList: 0,
      emptyListCount: 0,
      largestListBookCount: 0,
      listsWithBooksCount: 0,
      maxListsPerBook: 0,
      multiListBookCount: 0,
      totalListCount: 0,
      totalMembershipCount: 0,
      uniqueBookCount: 0,
    });
  });

  it("reports every list as empty when nothing was added", () => {
    const summary = toListsSummary(counts({ totalListCount: 4 }));

    expect(summary).toMatchObject({ averageBooksPerList: 0, emptyListCount: 4 });
  });
});

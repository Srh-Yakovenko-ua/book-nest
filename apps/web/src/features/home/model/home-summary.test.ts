import { describe, expect, it } from "vitest";

import { homeSummaryState } from "./home-summary";

const SUMMARY = { favorites: 4, finished: 21, reading: 2, total: 57 };

describe("homeSummaryState", () => {
  it("is loading before the first response", () => {
    expect(homeSummaryState({ data: undefined, isError: false })).toEqual({ kind: "loading" });
  });

  it("is an error when the first request fails", () => {
    expect(homeSummaryState({ data: undefined, isError: true })).toEqual({ kind: "error" });
  });

  it("shows the counts from a fresh response", () => {
    expect(homeSummaryState({ data: { summary: SUMMARY }, isError: false })).toEqual({
      counts: SUMMARY,
      isStale: false,
      kind: "ready",
    });
  });

  it("keeps the cached counts marked stale when a refetch fails", () => {
    expect(homeSummaryState({ data: { summary: SUMMARY }, isError: true })).toEqual({
      counts: SUMMARY,
      isStale: true,
      kind: "ready",
    });
  });

  it("keeps a confirmed empty library as zero counts", () => {
    const empty = { favorites: 0, finished: 0, reading: 0, total: 0 };

    expect(homeSummaryState({ data: { summary: empty }, isError: false })).toEqual({
      counts: empty,
      isStale: false,
      kind: "ready",
    });
  });
});

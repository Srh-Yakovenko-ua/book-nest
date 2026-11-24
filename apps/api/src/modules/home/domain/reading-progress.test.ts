import { describe, expect, it } from "vitest";

import { computeProgressPercent, resolveCurrentCyclePage } from "./reading-progress.js";

describe("computeProgressPercent", () => {
  it("rounds down a third of the book to 33 percent", () => {
    expect(computeProgressPercent({ currentPage: 100, pagesCount: 300 })).toBe(33);
  });

  it("rounds up two thirds of the book to 67 percent", () => {
    expect(computeProgressPercent({ currentPage: 200, pagesCount: 300 })).toBe(67);
  });

  it("reports zero percent on the first page", () => {
    expect(computeProgressPercent({ currentPage: 0, pagesCount: 300 })).toBe(0);
  });

  it("clamps a page beyond the page count to 100 percent", () => {
    expect(computeProgressPercent({ currentPage: 450, pagesCount: 300 })).toBe(100);
  });

  it("is unknown when the page count is unknown", () => {
    expect(computeProgressPercent({ currentPage: 120, pagesCount: null })).toBeNull();
  });

  it("is unknown when the page count is zero", () => {
    expect(computeProgressPercent({ currentPage: 120, pagesCount: 0 })).toBeNull();
  });

  it("is unknown when the current page is unknown", () => {
    expect(computeProgressPercent({ currentPage: null, pagesCount: 300 })).toBeNull();
  });
});

describe("resolveCurrentCyclePage", () => {
  it("shows the page once the active cycle has a progress event", () => {
    expect(
      resolveCurrentCyclePage({
        currentPage: 140,
        endedCyclesCount: 2,
        hasCurrentCycleProgress: true,
        readingStatus: "rereading",
      }),
    ).toBe(140);
  });

  it("hides the page of a previous cycle while rereading without progress in the active cycle", () => {
    expect(
      resolveCurrentCyclePage({
        currentPage: 310,
        endedCyclesCount: 1,
        hasCurrentCycleProgress: false,
        readingStatus: "rereading",
      }),
    ).toBeNull();
  });

  it("hides the page while rereading even when no cycle has ended yet", () => {
    expect(
      resolveCurrentCyclePage({
        currentPage: 310,
        endedCyclesCount: 0,
        hasCurrentCycleProgress: false,
        readingStatus: "rereading",
      }),
    ).toBeNull();
  });

  it("hides the page of an ended cycle while reading without progress in the active cycle", () => {
    expect(
      resolveCurrentCyclePage({
        currentPage: 310,
        endedCyclesCount: 1,
        hasCurrentCycleProgress: false,
        readingStatus: "reading",
      }),
    ).toBeNull();
  });

  it("shows the page while reading for the first time without recorded progress events", () => {
    expect(
      resolveCurrentCyclePage({
        currentPage: 85,
        endedCyclesCount: 0,
        hasCurrentCycleProgress: false,
        readingStatus: "reading",
      }),
    ).toBe(85);
  });

  it("keeps the page of a paused first read, which can only belong to its current cycle", () => {
    expect(
      resolveCurrentCyclePage({
        currentPage: 85,
        endedCyclesCount: 0,
        hasCurrentCycleProgress: false,
        readingStatus: "paused",
      }),
    ).toBe(85);
  });

  it("hides the page of a paused reread without progress in its current cycle", () => {
    expect(
      resolveCurrentCyclePage({
        currentPage: 85,
        endedCyclesCount: 1,
        hasCurrentCycleProgress: false,
        readingStatus: "paused",
      }),
    ).toBeNull();
  });

  it("stays unknown when no page was ever recorded", () => {
    expect(
      resolveCurrentCyclePage({
        currentPage: null,
        endedCyclesCount: 0,
        hasCurrentCycleProgress: true,
        readingStatus: "reading",
      }),
    ).toBeNull();
  });
});

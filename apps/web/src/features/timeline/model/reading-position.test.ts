import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import { isEventAhead, readingMarkerIndex } from "./reading-position";

function pages(numbers: Nullable<number>[]) {
  return numbers.map((pageNumber) => ({ pageNumber }));
}

describe("isEventAhead", () => {
  it("is false when the reading position is unknown", () => {
    expect(isEventAhead({ pageNumber: 50 }, null)).toBe(false);
  });

  it("is false when the event has no page", () => {
    expect(isEventAhead({ pageNumber: null }, 40)).toBe(false);
  });

  it("is true when the event page is past the current page", () => {
    expect(isEventAhead({ pageNumber: 50 }, 40)).toBe(true);
  });

  it("is false when the event page is at the current page", () => {
    expect(isEventAhead({ pageNumber: 40 }, 40)).toBe(false);
  });

  it("is false when the event page is before the current page", () => {
    expect(isEventAhead({ pageNumber: 30 }, 40)).toBe(false);
  });
});

describe("readingMarkerIndex", () => {
  it("returns null when the reading position is unknown", () => {
    expect(
      readingMarkerIndex({ currentPage: null, events: pages([10, 20]), hasNextPage: false }),
    ).toBeNull();
  });

  it("returns null without any loaded event", () => {
    expect(readingMarkerIndex({ currentPage: 25, events: [], hasNextPage: false })).toBeNull();
  });

  it("points at the first event past the current page", () => {
    expect(
      readingMarkerIndex({ currentPage: 25, events: pages([10, 20, 30]), hasNextPage: false }),
    ).toBe(2);
  });

  it("points at the start when everything loaded is still ahead", () => {
    expect(readingMarkerIndex({ currentPage: 5, events: pages([10, 20]), hasNextPage: true })).toBe(
      0,
    );
  });

  it("skips events without a page", () => {
    expect(
      readingMarkerIndex({ currentPage: 5, events: pages([null, 10]), hasNextPage: false }),
    ).toBe(1);
  });

  it("closes the loaded stream with a marker when every page is loaded", () => {
    expect(
      readingMarkerIndex({ currentPage: 100, events: pages([10, 20, 30]), hasNextPage: false }),
    ).toBe(3);
  });

  it("skips the trailing marker while more pages can still be loaded", () => {
    expect(
      readingMarkerIndex({ currentPage: 100, events: pages([10, 20, 30]), hasNextPage: true }),
    ).toBeNull();
  });
});

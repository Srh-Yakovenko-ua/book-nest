import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import { isEventAhead, positionMarkerIndex, splitEventsAtPosition } from "./reading-position";

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

describe("positionMarkerIndex", () => {
  it("returns null when the reading position is unknown", () => {
    expect(positionMarkerIndex(pages([10, 20]), null)).toBeNull();
  });

  it("points at the first event past the current page", () => {
    expect(positionMarkerIndex(pages([10, 20, 30]), 25)).toBe(2);
  });

  it("points past the end when everything has been read", () => {
    expect(positionMarkerIndex(pages([10, 20, 30]), 100)).toBe(3);
  });

  it("points at the start when everything is still ahead", () => {
    expect(positionMarkerIndex(pages([10, 20]), 5)).toBe(0);
  });

  it("skips events without a page when finding the marker", () => {
    expect(positionMarkerIndex(pages([null, 10]), 5)).toBe(1);
  });
});

describe("splitEventsAtPosition", () => {
  it("keeps every event as read when the position is unknown", () => {
    const events = pages([10, 20]);
    expect(splitEventsAtPosition(events, null)).toEqual({
      ahead: [],
      markerIndex: null,
      read: events,
    });
  });

  it("splits read and ahead events around the marker", () => {
    const events = pages([10, 20, 30]);
    expect(splitEventsAtPosition(events, 25)).toEqual({
      ahead: [{ pageNumber: 30 }],
      markerIndex: 2,
      read: [{ pageNumber: 10 }, { pageNumber: 20 }],
    });
  });

  it("marks all events as read when the current page is beyond them", () => {
    const events = pages([10, 20]);
    const result = splitEventsAtPosition(events, 100);
    expect(result.ahead).toEqual([]);
    expect(result.markerIndex).toBe(2);
    expect(result.read).toEqual(events);
  });
});

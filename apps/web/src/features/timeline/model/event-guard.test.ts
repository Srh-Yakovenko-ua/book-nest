import { describe, expect, it } from "vitest";

import { eventGuardReason, GUARD_REASON_LABEL_KEYS } from "./event-guard";

function event(overrides: { isSpoiler?: boolean; pageNumber?: null | number } = {}) {
  return { isSpoiler: false, pageNumber: null, ...overrides };
}

describe("eventGuardReason", () => {
  it("never guards while the guard is off", () => {
    expect(
      eventGuardReason({
        currentPage: 10,
        event: event({ isSpoiler: true, pageNumber: 900 }),
        guardEnabled: false,
      }),
    ).toBeNull();
  });

  it("guards a manual spoiler that sits behind the reading position", () => {
    expect(
      eventGuardReason({
        currentPage: 200,
        event: event({ isSpoiler: true, pageNumber: 10 }),
        guardEnabled: true,
      }),
    ).toBe("manual");
  });

  it("guards a manual spoiler when the reading position is unknown", () => {
    expect(
      eventGuardReason({
        currentPage: null,
        event: event({ isSpoiler: true, pageNumber: 900 }),
        guardEnabled: true,
      }),
    ).toBe("manual");
  });

  it("guards an event past the reading position", () => {
    expect(
      eventGuardReason({
        currentPage: 20,
        event: event({ pageNumber: 21 }),
        guardEnabled: true,
      }),
    ).toBe("future");
  });

  it("reports both reasons for a future manual spoiler", () => {
    expect(
      eventGuardReason({
        currentPage: 20,
        event: event({ isSpoiler: true, pageNumber: 21 }),
        guardEnabled: true,
      }),
    ).toBe("both");
  });

  it("does not guard an event on the current page", () => {
    expect(
      eventGuardReason({ currentPage: 20, event: event({ pageNumber: 20 }), guardEnabled: true }),
    ).toBeNull();
  });

  it("does not guard an event without a page", () => {
    expect(eventGuardReason({ currentPage: 20, event: event(), guardEnabled: true })).toBeNull();
  });

  it("does not guard anything while the reading position is unknown", () => {
    expect(
      eventGuardReason({
        currentPage: null,
        event: event({ pageNumber: 900 }),
        guardEnabled: true,
      }),
    ).toBeNull();
  });

  it("maps every reason to its own label key", () => {
    expect(Object.values(GUARD_REASON_LABEL_KEYS)).toEqual([
      "guarded.reasonBoth",
      "guarded.reasonFuture",
      "guarded.reasonManual",
    ]);
  });
});

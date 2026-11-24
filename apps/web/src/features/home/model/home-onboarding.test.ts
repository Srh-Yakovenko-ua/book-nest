import { describe, expect, it } from "vitest";

import type { HomePresence } from "./home-onboarding";

import { isConfirmedEmptyHome } from "./home-onboarding";

const ALL_ABSENT: readonly HomePresence[] = ["absent", "absent", "absent", "absent"];

describe("isConfirmedEmptyHome", () => {
  it("shows onboarding for an empty library without goal, history, attention or memory", () => {
    expect(isConfirmedEmptyHome({ independentPresence: ALL_ABSENT, libraryTotal: 0 })).toBe(true);
  });

  it("skips onboarding when the library total is unknown", () => {
    expect(isConfirmedEmptyHome({ independentPresence: ALL_ABSENT, libraryTotal: null })).toBe(
      false,
    );
  });

  it("skips onboarding when the library holds a book", () => {
    expect(isConfirmedEmptyHome({ independentPresence: ALL_ABSENT, libraryTotal: 1 })).toBe(false);
  });

  it.each([0, 1, 2, 3])(
    "skips onboarding when presence %i of four is still unknown",
    (unknownIndex) => {
      const independentPresence = ALL_ABSENT.map((presence, index): HomePresence =>
        index === unknownIndex ? "unknown" : presence,
      );

      expect(isConfirmedEmptyHome({ independentPresence, libraryTotal: 0 })).toBe(false);
    },
  );

  it.each([0, 1, 2, 3])("skips onboarding when presence %i of four is present", (presentIndex) => {
    const independentPresence = ALL_ABSENT.map((presence, index): HomePresence =>
      index === presentIndex ? "present" : presence,
    );

    expect(isConfirmedEmptyHome({ independentPresence, libraryTotal: 0 })).toBe(false);
  });
});

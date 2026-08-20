import type { OwnershipStatus } from "@app/shared";

import { OwnershipStatusSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { CancelledBookState } from "./cancelled-outcome.js";

import {
  classifyCancelledOutcome,
  countCancelledOutcomes,
  isUnresolvedCancelledBook,
} from "./cancelled-outcome.js";

function makeState(overrides: Partial<CancelledBookState> = {}): CancelledBookState {
  return { hasActiveOrder: false, hasReceivedOrder: false, ownershipStatus: "none", ...overrides };
}

describe("where a cancelled book ended up", () => {
  it("counts a book that was received later as being in the library", () => {
    expect(classifyCancelledOutcome(makeState({ hasReceivedOrder: true }))).toBe("inLibrary");
  });

  it("keeps a received book in the library even after it was lent to someone", () => {
    expect(
      classifyCancelledOutcome(
        makeState({ hasReceivedOrder: true, ownershipStatus: "lent_to_someone" }),
      ),
    ).toBe("inLibrary");
  });

  it("counts an owned book as being in the library without any receipt of its own", () => {
    expect(classifyCancelledOutcome(makeState({ ownershipStatus: "owned" }))).toBe("inLibrary");
  });

  it("counts a book lent to someone as owned, because it is the reader's copy", () => {
    expect(classifyCancelledOutcome(makeState({ ownershipStatus: "lent_to_someone" }))).toBe(
      "inLibrary",
    );
  });

  it("counts a book with a fresh order still on its way as reordered", () => {
    expect(classifyCancelledOutcome(makeState({ ownershipStatus: "in_transit" }))).toBe(
      "reordered",
    );
  });

  it("counts an active order item as reordered even when ownership lags behind", () => {
    expect(
      classifyCancelledOutcome(makeState({ hasActiveOrder: true, ownershipStatus: "want_to_buy" })),
    ).toBe("reordered");
  });

  it("counts a book waiting on the wishlist as wishlist", () => {
    expect(classifyCancelledOutcome(makeState({ ownershipStatus: "want_to_buy" }))).toBe(
      "wishlist",
    );
  });

  it("counts a book borrowed from someone as borrowed, not as owned", () => {
    expect(classifyCancelledOutcome(makeState({ ownershipStatus: "borrowed_from_someone" }))).toBe(
      "borrowed",
    );
  });

  it("counts a book with nothing lined up as unresolved", () => {
    expect(classifyCancelledOutcome(makeState())).toBe("unresolved");
  });

  it("stops calling a book unresolved once a new order carries it", () => {
    expect(isUnresolvedCancelledBook(makeState())).toBe(true);
    expect(isUnresolvedCancelledBook(makeState({ hasActiveOrder: true }))).toBe(false);
    expect(isUnresolvedCancelledBook(makeState({ hasReceivedOrder: true }))).toBe(false);
  });

  it("places every ownership status the product knows into exactly one outcome", () => {
    const outcomes = OwnershipStatusSchema.options.map((ownershipStatus: OwnershipStatus) =>
      classifyCancelledOutcome(makeState({ ownershipStatus })),
    );

    expect(outcomes).toHaveLength(OwnershipStatusSchema.options.length);
    expect(outcomes.every((outcome) => outcome !== undefined)).toBe(true);
  });
});

describe("the outcome tally", () => {
  const states = [
    makeState({ hasReceivedOrder: true }),
    makeState({ ownershipStatus: "owned" }),
    makeState({ ownershipStatus: "lent_to_someone" }),
    makeState({ ownershipStatus: "in_transit" }),
    makeState({ ownershipStatus: "want_to_buy" }),
    makeState({ ownershipStatus: "borrowed_from_someone" }),
    makeState(),
  ];

  it("adds every outcome up to the number of distinct books it was given", () => {
    const counts = countCancelledOutcomes(states);

    expect(
      counts.borrowed + counts.inLibrary + counts.reordered + counts.unresolved + counts.wishlist,
    ).toBe(counts.totalBooksCount);
    expect(counts.totalBooksCount).toBe(states.length);
  });

  it("splits the books across the outcomes without counting one twice", () => {
    expect(countCancelledOutcomes(states)).toEqual({
      borrowed: 1,
      inLibrary: 3,
      reordered: 1,
      totalBooksCount: 7,
      unresolved: 1,
      wishlist: 1,
    });
  });

  it("reports every outcome as zero when no book was ever cancelled", () => {
    expect(countCancelledOutcomes([])).toEqual({
      borrowed: 0,
      inLibrary: 0,
      reordered: 0,
      totalBooksCount: 0,
      unresolved: 0,
      wishlist: 0,
    });
  });
});

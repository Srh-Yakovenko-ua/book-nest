import type { OwnershipStatus, ReadingStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  collectSeriesOrderBlockedBookIds,
  isAvailableOwnership,
  isQueueEligibleStatus,
} from "./next-read-eligibility.js";

const BOOK_IDS = {
  affected: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b61",
  otherAffected: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b64",
  related: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b62",
  secondRelated: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b63",
} as const;

describe("isQueueEligibleStatus", () => {
  it.each<ReadingStatus>(["not_started", "want_to_read", "paused"])(
    "lets a %s queue book through",
    (readingStatus) => {
      expect(isQueueEligibleStatus(readingStatus)).toBe(true);
    },
  );

  it.each<ReadingStatus>(["reading", "rereading", "finished", "dnf"])(
    "skips a %s queue book",
    (readingStatus) => {
      expect(isQueueEligibleStatus(readingStatus)).toBe(false);
    },
  );
});

describe("isAvailableOwnership", () => {
  it.each<OwnershipStatus>(["owned", "borrowed_from_someone"])(
    "treats a %s book as on hand",
    (ownershipStatus) => {
      expect(isAvailableOwnership(ownershipStatus)).toBe(true);
    },
  );

  it.each<OwnershipStatus>(["lent_to_someone", "in_transit", "want_to_buy", "none"])(
    "treats a %s book as unavailable",
    (ownershipStatus) => {
      expect(isAvailableOwnership(ownershipStatus)).toBe(false);
    },
  );
});

describe("collectSeriesOrderBlockedBookIds", () => {
  it("blocks the affected book and every related book of each issue", () => {
    const blocked = collectSeriesOrderBlockedBookIds([
      {
        affectedBook: { id: BOOK_IDS.affected },
        relatedProblems: [
          { affectedBookId: BOOK_IDS.related },
          { affectedBookId: BOOK_IDS.secondRelated },
        ],
      },
      { affectedBook: { id: BOOK_IDS.otherAffected }, relatedProblems: [] },
    ]);

    expect(blocked).toEqual(
      new Set([
        BOOK_IDS.affected,
        BOOK_IDS.otherAffected,
        BOOK_IDS.related,
        BOOK_IDS.secondRelated,
      ]),
    );
  });

  it("blocks nothing without issues", () => {
    expect(collectSeriesOrderBlockedBookIds([])).toEqual(new Set());
  });
});

import type { CancelledOutcome, CancelledOutcomeCounts, OwnershipStatus } from "@app/shared";

export type CancelledBookState = {
  hasActiveOrder: boolean;
  hasReceivedOrder: boolean;
  ownershipStatus: OwnershipStatus;
};

const EMPTY_COUNTS: Omit<CancelledOutcomeCounts, "totalBooksCount"> = {
  borrowed: 0,
  inLibrary: 0,
  reordered: 0,
  unresolved: 0,
  wishlist: 0,
};

export function classifyCancelledOutcome(state: CancelledBookState): CancelledOutcome {
  if (state.hasReceivedOrder) {
    return "inLibrary";
  }

  switch (state.ownershipStatus) {
    case "borrowed_from_someone":
      return state.hasActiveOrder ? "reordered" : "borrowed";
    case "in_transit":
      return "reordered";
    case "lent_to_someone":
    case "owned":
      return "inLibrary";
    case "none":
      return state.hasActiveOrder ? "reordered" : "unresolved";
    case "want_to_buy":
      return state.hasActiveOrder ? "reordered" : "wishlist";
    default: {
      const exhaustiveCheck: never = state.ownershipStatus;
      return exhaustiveCheck;
    }
  }
}

export function countCancelledOutcomes(
  states: readonly CancelledBookState[],
): CancelledOutcomeCounts {
  const counts = states.reduce(
    (tally, state) => {
      const outcome = classifyCancelledOutcome(state);
      return { ...tally, [outcome]: tally[outcome] + 1 };
    },
    { ...EMPTY_COUNTS },
  );

  return { ...counts, totalBooksCount: states.length };
}

export function isUnresolvedCancelledBook(state: CancelledBookState): boolean {
  return classifyCancelledOutcome(state) === "unresolved";
}

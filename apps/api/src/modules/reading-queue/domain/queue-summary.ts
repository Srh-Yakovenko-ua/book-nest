import type {
  Nullable,
  OwnershipStatus,
  ReadingQueueSummaryView,
  ReadingQueueUnavailableBreakdown,
} from "@app/shared";

import { computeHasUnreadEarlierParts, type EarlierPartCandidate } from "@app/shared";

const AVAILABLE_OWNERSHIP_STATUSES: ReadonlySet<OwnershipStatus> = new Set<OwnershipStatus>([
  "borrowed_from_someone",
  "owned",
]);

const OWNERSHIP_UNAVAILABLE_KEY = {
  borrowed_from_someone: null,
  in_transit: "inTransit",
  lent_to_someone: "lentToSomeone",
  none: "none",
  owned: null,
  want_to_buy: "wantToBuy",
} as const satisfies Record<OwnershipStatus, Nullable<keyof ReadingQueueUnavailableBreakdown>>;

export type ReadingQueueSummaryDomainRow = {
  ownershipStatus: OwnershipStatus;
  partNumber: Nullable<number>;
  seriesBooks: EarlierPartCandidate[];
  seriesId: Nullable<string>;
};

export function computeReadingQueueSummary(
  rows: readonly ReadingQueueSummaryDomainRow[],
): ReadingQueueSummaryView {
  const unavailableByOwnership: ReadingQueueUnavailableBreakdown = {
    inTransit: 0,
    lentToSomeone: 0,
    none: 0,
    wantToBuy: 0,
  };
  const seriesIds = new Set<string>();
  let seriesBooksCount = 0;
  let availableNowCount = 0;
  let blockedBySeriesOrderCount = 0;
  let unavailableCount = 0;

  for (const row of rows) {
    if (row.seriesId !== null) {
      seriesBooksCount += 1;
      seriesIds.add(row.seriesId);
    }

    if (isAvailableOwnership(row.ownershipStatus)) {
      if (isBlockedBySeriesOrder(row)) {
        blockedBySeriesOrderCount += 1;
      } else {
        availableNowCount += 1;
      }
      continue;
    }

    const breakdownKey = OWNERSHIP_UNAVAILABLE_KEY[row.ownershipStatus];
    if (breakdownKey !== null) {
      unavailableByOwnership[breakdownKey] += 1;
    }
    unavailableCount += 1;
  }

  return {
    availableNowCount,
    blockedBySeriesOrderCount,
    seriesBooksCount,
    seriesInQueueCount: seriesIds.size,
    standaloneBooksCount: rows.length - seriesBooksCount,
    totalCount: rows.length,
    unavailableByOwnership,
    unavailableCount,
  };
}

export function isAvailableOwnership(status: OwnershipStatus): boolean {
  return AVAILABLE_OWNERSHIP_STATUSES.has(status);
}

function isBlockedBySeriesOrder(row: ReadingQueueSummaryDomainRow): boolean {
  if (row.seriesId === null) {
    return false;
  }

  return (
    computeHasUnreadEarlierParts({
      books: row.seriesBooks,
      currentPartNumber: row.partNumber,
    }) === true
  );
}

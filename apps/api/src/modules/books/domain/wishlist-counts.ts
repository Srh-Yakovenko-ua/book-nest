import type { Nullable, WishlistCountsView, WishlistSeriesBreakdown } from "@app/shared";

import { isAfter, isBefore, subDays, subMonths } from "date-fns";

const WISHLIST_AGE_THRESHOLDS = {
  longWaitMonths: 6,
  recentDays: 30,
} as const;

export type SeriesWishlistAnchor = {
  highestPartNumberOutsideWishlist: number;
  seriesId: string;
};

export type WishlistCountsBookRow = {
  partNumber: Nullable<number>;
  seriesId: Nullable<string>;
  wishlistAddedAt: Nullable<Date>;
};

type SeriesPlacement = { kind: "continuation" | "gap"; seriesId: string };

export function computeWishlistCounts({
  anchors,
  books,
  now,
}: {
  anchors: SeriesWishlistAnchor[];
  books: WishlistCountsBookRow[];
  now: Date;
}): WishlistCountsView {
  const anchorBySeriesId = new Map(
    anchors.map((anchor) => [anchor.seriesId, anchor.highestPartNumberOutsideWishlist]),
  );

  const recentThreshold = subDays(now, WISHLIST_AGE_THRESHOLDS.recentDays);
  const longWaitThreshold = subMonths(now, WISHLIST_AGE_THRESHOLDS.longWaitMonths);

  const missingSeriesIds = new Set<string>();
  const nextSeriesIds = new Set<string>();
  let addedLast30Days = 0;
  let waitingOverSixMonths = 0;
  let missingBooksCount = 0;
  let nextBooksCount = 0;

  for (const book of books) {
    if (book.wishlistAddedAt !== null) {
      if (isAfter(book.wishlistAddedAt, recentThreshold)) {
        addedLast30Days += 1;
      }
      if (isBefore(book.wishlistAddedAt, longWaitThreshold)) {
        waitingOverSixMonths += 1;
      }
    }

    const placement = placeInSeries({ anchorBySeriesId, book });
    if (placement === null) {
      continue;
    }

    if (placement.kind === "gap") {
      missingBooksCount += 1;
      missingSeriesIds.add(placement.seriesId);
      continue;
    }

    nextBooksCount += 1;
    nextSeriesIds.add(placement.seriesId);
  }

  return {
    addedLast30Days,
    missingFromSeries: toBreakdown({ booksCount: missingBooksCount, seriesIds: missingSeriesIds }),
    nextInSeries: toBreakdown({ booksCount: nextBooksCount, seriesIds: nextSeriesIds }),
    waitingOverSixMonths,
  };
}

function placeInSeries({
  anchorBySeriesId,
  book,
}: {
  anchorBySeriesId: Map<string, number>;
  book: WishlistCountsBookRow;
}): Nullable<SeriesPlacement> {
  if (book.seriesId === null || book.partNumber === null) {
    return null;
  }

  const anchor = anchorBySeriesId.get(book.seriesId);
  if (anchor === undefined) {
    return null;
  }

  if (book.partNumber < anchor) {
    return { kind: "gap", seriesId: book.seriesId };
  }

  if (book.partNumber > anchor) {
    return { kind: "continuation", seriesId: book.seriesId };
  }

  return null;
}

function toBreakdown({
  booksCount,
  seriesIds,
}: {
  booksCount: number;
  seriesIds: Set<string>;
}): WishlistSeriesBreakdown {
  return { booksCount, seriesCount: seriesIds.size };
}

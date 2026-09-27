import type { Nullable, SeriesPublisherRef } from "@app/shared";

import type { SeriesBookPublisher } from "./series-preview.js";

import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";

export type SeriesPublisherBookRow = {
  publisher: Nullable<SeriesBookPublisher>;
};

export type SeriesPublishersSummary = {
  breakdown: SeriesPublisherRef[];
  dominant: Nullable<SeriesPublisherRef>;
};

export function summarizeSeriesPublishers(
  books: readonly SeriesPublisherBookRow[],
): SeriesPublishersSummary {
  const countsById = new Map<string, SeriesPublisherRef>();

  for (const book of books) {
    if (book.publisher === null) {
      continue;
    }

    const counted = countsById.get(book.publisher.id);
    if (counted === undefined) {
      countsById.set(book.publisher.id, {
        bookCount: 1,
        id: book.publisher.id,
        name: book.publisher.name,
      });
      continue;
    }

    counted.bookCount += 1;
  }

  const breakdown = [...countsById.values()].sort(compareByBookCountThenName);

  return { breakdown, dominant: selectDominantPublisher(breakdown) };
}

function compareByBookCountThenName(first: SeriesPublisherRef, second: SeriesPublisherRef): number {
  if (first.bookCount !== second.bookCount) {
    return second.bookCount - first.bookCount;
  }

  return UKRAINIAN_COLLATION.compare(first.name, second.name);
}

function selectDominantPublisher(
  breakdown: readonly SeriesPublisherRef[],
): Nullable<SeriesPublisherRef> {
  const [leader, runnerUp] = breakdown;
  if (leader === undefined) {
    return null;
  }

  if (runnerUp !== undefined && runnerUp.bookCount === leader.bookCount) {
    return null;
  }

  return leader;
}

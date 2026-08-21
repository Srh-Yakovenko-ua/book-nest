import type { ReceivedSeriesInsight, ReceivedSeriesInsightKind } from "@app/shared";

import type { SeriesSetRow } from "./series-set.js";

import { countCompletingSubjects, countGapClosingSubjects, countSubjects } from "./series-set.js";

export type ReceivedSeriesRow = SeriesSetRow;

type SeriesTally = {
  booksCount: number;
  seriesCount: number;
};

export function buildReceivedSeriesInsights(
  rows: readonly ReceivedSeriesRow[],
): ReceivedSeriesInsight[] {
  const completed = tally(rows, (row) => countCompletingSubjects(row));
  const remaining = rows.filter((row) => countCompletingSubjects(row) === 0);
  const gapsClosed = tally(remaining, (row) => countGapClosingSubjects(row));

  if (completed.seriesCount === 0 && gapsClosed.seriesCount === 0) {
    return [];
  }

  const toppedUp = tally(
    remaining.filter((row) => countGapClosingSubjects(row) === 0),
    (row) => countSubjects(row),
  );

  return [
    toInsight("series_completed", completed),
    toInsight("series_gaps_closed", gapsClosed),
    toInsight("series_topped_up", toppedUp),
  ].flat();
}

function tally(
  rows: readonly ReceivedSeriesRow[],
  countBooks: (row: ReceivedSeriesRow) => number,
): SeriesTally {
  return rows.reduce<SeriesTally>(
    (totals, row) => {
      const booksCount = countBooks(row);
      return booksCount === 0
        ? totals
        : {
            booksCount: totals.booksCount + booksCount,
            seriesCount: totals.seriesCount + 1,
          };
    },
    { booksCount: 0, seriesCount: 0 },
  );
}

function toInsight(
  kind: ReceivedSeriesInsightKind,
  { booksCount, seriesCount }: SeriesTally,
): ReceivedSeriesInsight[] {
  return seriesCount === 0 ? [] : [{ booksCount, kind, seriesCount }];
}

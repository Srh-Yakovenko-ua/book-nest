import type { GenreStatsView, Nullable } from "@app/shared";

export type GenreStatsAggregateRow = {
  averageRating: Nullable<number>;
  booksCount: number;
  key: string;
  readCount: number;
  readingQueueCount: number;
  wantToBuyCount: number;
};

const RATING_FRACTION_DIGITS = 2;

export function toGenreStatsViews({
  aggregates,
  coverUrlsByKey,
  labelByKey,
}: {
  aggregates: GenreStatsAggregateRow[];
  coverUrlsByKey: Map<string, string[]>;
  labelByKey: Map<string, string>;
}): GenreStatsView[] {
  return aggregates.map((row) => ({
    averageRating: row.averageRating === null ? null : roundRating(row.averageRating),
    booksCount: row.booksCount,
    coverUrls: coverUrlsByKey.get(row.key) ?? [],
    key: row.key,
    label: labelByKey.get(row.key) ?? row.key,
    readCount: row.readCount,
    readingQueueCount: row.readingQueueCount,
    wantToBuyCount: row.wantToBuyCount,
  }));
}

function roundRating(value: number): number {
  const factor = 10 ** RATING_FRACTION_DIGITS;
  return Math.round(value * factor) / factor;
}

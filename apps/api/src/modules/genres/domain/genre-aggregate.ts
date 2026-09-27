import type { Nullable } from "@app/shared";

export type GenreAggregate = {
  averageRating: Nullable<number>;
  booksCount: number;
  groupKey: string;
  groupName: string;
  key: string;
  label: string;
  normalizedName: string;
  ratedBooksCount: number;
  readCount: number;
  readingQueueCount: number;
  sortOrder: number;
  wantToBuyCount: number;
};

type GenreIdentity = { key: string; normalizedName: string };

const genreNameCollator = new Intl.Collator("uk");

export function compareGenreIdentity(left: GenreIdentity, right: GenreIdentity): number {
  return (
    genreNameCollator.compare(left.normalizedName, right.normalizedName) ||
    compareKeys(left.key, right.key)
  );
}

function compareKeys(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

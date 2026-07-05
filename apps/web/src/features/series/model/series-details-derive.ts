import type { SeriesBookView } from "@app/shared";

const PART_NUMBER_MAX = 999;

export function readingOrder(books: SeriesBookView[]): SeriesBookView[] {
  return books
    .filter((book): book is SeriesBookView & { partNumber: number } => book.partNumber !== null)
    .sort((a, b) => a.partNumber - b.partNumber);
}

export function suggestedPartNumber(books: SeriesBookView[]): number {
  const highest = books.reduce((max, book) => Math.max(max, book.partNumber ?? 0), 0);
  return Math.min(highest + 1, PART_NUMBER_MAX);
}

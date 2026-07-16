import type { SeriesBookView, SeriesDetailsView } from "@app/shared";

const PART_NUMBER_MAX = 999;

export type SeriesCoverBook = {
  id: string;
  src: string;
  title: string;
};

export function authorsDifferFromSeries({
  bookAuthors,
  seriesAuthors,
}: {
  bookAuthors: SeriesBookView["authors"];
  seriesAuthors: SeriesDetailsView["authors"];
}): boolean {
  const bookIds = new Set(bookAuthors.map((author) => author.id));
  const seriesIds = new Set(seriesAuthors.map((author) => author.id));

  if (bookIds.size !== seriesIds.size) return true;
  return [...bookIds].some((id) => !seriesIds.has(id));
}

export function duplicatePartNumbers(books: SeriesBookView[]): number[] {
  const seen = new Set<number>();
  const duplicates = new Set<number>();

  for (const book of books) {
    if (book.partNumber === null) continue;
    if (seen.has(book.partNumber)) duplicates.add(book.partNumber);
    seen.add(book.partNumber);
  }

  return [...duplicates].sort((a, b) => a - b);
}

export function readingOrder(books: SeriesBookView[]): SeriesBookView[] {
  return books
    .filter((book): book is SeriesBookView & { partNumber: number } => book.partNumber !== null)
    .sort((a, b) => a.partNumber - b.partNumber);
}

export function seriesBooksInReadingOrder(books: SeriesBookView[]): SeriesBookView[] {
  return [...books].sort(byPartNumberAsc);
}

export function seriesCoverBooks(books: SeriesBookView[]): SeriesCoverBook[] {
  return [...books].sort(byPartNumberAsc).flatMap((book) => {
    const src = book.cover?.urls.card;
    if (src === undefined || src.length === 0) return [];
    return [{ id: book.id, src, title: book.title }];
  });
}

export function suggestedPartNumber(books: SeriesBookView[]): number {
  const highest = books.reduce((max, book) => Math.max(max, book.partNumber ?? 0), 0);
  return Math.min(highest + 1, PART_NUMBER_MAX);
}

function byPartNumberAsc(a: SeriesBookView, b: SeriesBookView): number {
  if (a.partNumber === null) return b.partNumber === null ? 0 : 1;
  if (b.partNumber === null) return -1;
  return a.partNumber - b.partNumber;
}

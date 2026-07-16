import type { SeriesBookView, SeriesDetailsView } from "@app/shared";

const PART_NUMBER_MAX = 999;

export type SeriesCoverBook = {
  id: string;
  src: string;
  title: string;
};

export type SeriesSlot =
  | { book: SeriesBookView; isCurrent: boolean; key: string; kind: "added"; number: null | number }
  | { key: string; kind: "missing"; number: number }
  | { key: string; kind: "open"; partNumber: number };

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

export function buildSeriesSlots({
  books,
  currentId,
  totalBooks,
}: {
  books: SeriesBookView[];
  currentId?: string;
  totalBooks: null | number;
}): SeriesSlot[] {
  if (totalBooks === null) {
    const numbered = readingOrder(books).map((entry) => toAddedSlot(entry, currentId));
    const unnumbered = books
      .filter((entry) => entry.partNumber === null)
      .map((entry) => toAddedSlot(entry, currentId));
    return [
      ...numbered,
      ...unnumbered,
      { key: "open", kind: "open", partNumber: suggestedPartNumber(books) },
    ];
  }

  const used = new Set<string>();
  const slots: SeriesSlot[] = [];
  for (let position = 1; position <= totalBooks; position += 1) {
    const matches = books.filter((entry) => entry.partNumber === position);
    if (matches.length === 0) {
      slots.push({ key: `missing-${position}`, kind: "missing", number: position });
      continue;
    }
    for (const match of matches) {
      slots.push(toAddedSlot(match, currentId));
      used.add(match.id);
    }
  }

  const extras = books
    .filter((entry) => !used.has(entry.id))
    .sort(
      (a, b) =>
        (a.partNumber ?? Number.MAX_SAFE_INTEGER) - (b.partNumber ?? Number.MAX_SAFE_INTEGER),
    );
  for (const extra of extras) slots.push(toAddedSlot(extra, currentId));
  return slots;
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

function toAddedSlot(book: SeriesBookView, currentId?: string): SeriesSlot {
  return {
    book,
    isCurrent: book.id === currentId,
    key: `added-${book.id}`,
    kind: "added",
    number: book.partNumber,
  };
}

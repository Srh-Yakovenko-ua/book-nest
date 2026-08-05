import type { ReadingStatus, SeriesBookView, SeriesDetailsView, SeriesStatus } from "@app/shared";

const PART_NUMBER_MAX = 999;

export type SeriesCoverBook = {
  id: string;
  src: string;
  title: string;
};

export type SeriesProgressStatus =
  | { bookPercent: null | number; kind: "reading"; position: null | number; title: string }
  | { kind: "completed" }
  | { kind: "missingPart"; position: number }
  | { kind: "nextUnread"; position: null | number; title: string }
  | { kind: "notStarted" }
  | { kind: "ongoingAllRead" };

export type SeriesReleaseYears =
  | { from: number; kind: "range"; to: number }
  | { kind: "since"; year: number }
  | { kind: "single"; year: number };

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

export function nextAddablePartNumber({
  books,
  totalBooks,
}: {
  books: SeriesBookView[];
  totalBooks: null | number;
}): null | number {
  if (totalBooks === null) return suggestedPartNumber(books);
  for (let position = 1; position <= totalBooks; position += 1) {
    if (!books.some((book) => book.partNumber === position)) return position;
  }
  return null;
}

export function publisherDiffersFromSeries({
  bookPublisher,
  seriesPublishers,
}: {
  bookPublisher: SeriesBookView["publisher"];
  seriesPublishers: SeriesDetailsView["publishers"];
}): boolean {
  return bookPublisher !== null && seriesPublishers.length > 1;
}

export function readingOrder(books: SeriesBookView[]): SeriesBookView[] {
  return books
    .filter((book): book is SeriesBookView & { partNumber: number } => book.partNumber !== null)
    .sort((a, b) => a.partNumber - b.partNumber);
}

export function resolveSeriesGenres({
  books,
  seriesGenres,
}: {
  books: SeriesBookView[];
  seriesGenres: readonly string[];
}): string[] {
  if (seriesGenres.length > 0) return [...seriesGenres];
  const seen = new Set<string>();
  const union: string[] = [];
  for (const book of books) {
    for (const key of book.genres) {
      if (seen.has(key)) continue;
      seen.add(key);
      union.push(key);
    }
  }
  return union;
}

export function resolveSeriesReleaseYears({
  books,
  status,
}: {
  books: SeriesBookView[];
  status: SeriesStatus;
}): null | SeriesReleaseYears {
  if (status === "unknown") return null;
  const ordered = readingOrder(books);
  const first = ordered[0];
  if (first === undefined || first.publicationYear === null) return null;
  if (status === "ongoing") return { kind: "since", year: first.publicationYear };
  const last = ordered[ordered.length - 1];
  if (last === undefined || last.publicationYear === null) return null;
  if (first.publicationYear === last.publicationYear) {
    return { kind: "single", year: first.publicationYear };
  }
  return { from: first.publicationYear, kind: "range", to: last.publicationYear };
}

export function seriesCoverBooks(books: SeriesBookView[]): SeriesCoverBook[] {
  return [...books].sort(byPartNumberAsc).flatMap((book) => {
    const src = book.cover?.urls.card;
    if (src === undefined || src.length === 0) return [];
    return [{ id: book.id, src, title: book.title }];
  });
}

export function seriesProgressStatus(details: SeriesDetailsView): SeriesProgressStatus {
  const { books, finishedInSeries, nextBook, status, totalBooks } = details;
  if (books.length === 0) return { kind: "notStarted" };

  const activeBook = nextBook === null ? undefined : books.find((book) => book.id === nextBook.id);
  if (activeBook !== undefined && isReadingStatus(activeBook.readingStatus)) {
    return {
      bookPercent: bookProgressPercent(activeBook),
      kind: "reading",
      position: activeBook.partNumber,
      title: activeBook.title,
    };
  }

  if (nextBook === null) {
    const missingPart = totalBooks === null ? null : nextAddablePartNumber({ books, totalBooks });
    if (missingPart !== null) return { kind: "missingPart", position: missingPart };
    if (status === "ongoing") return { kind: "ongoingAllRead" };
    return { kind: "completed" };
  }

  if (finishedInSeries === 0) return { kind: "notStarted" };
  return { kind: "nextUnread", position: nextBook.partNumber, title: nextBook.title };
}

export function suggestedPartNumber(books: SeriesBookView[]): number {
  const highest = books.reduce((max, book) => Math.max(max, book.partNumber ?? 0), 0);
  return Math.min(highest + 1, PART_NUMBER_MAX);
}

function bookProgressPercent(book: SeriesBookView): null | number {
  if (book.currentPage === null || book.pagesCount === null || book.pagesCount <= 0) return null;
  return Math.min(100, Math.round((book.currentPage / book.pagesCount) * 100));
}

function byPartNumberAsc(a: SeriesBookView, b: SeriesBookView): number {
  if (a.partNumber === null) return b.partNumber === null ? 0 : 1;
  if (b.partNumber === null) return -1;
  return a.partNumber - b.partNumber;
}

function isReadingStatus(status: ReadingStatus): boolean {
  return status === "reading" || status === "rereading";
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

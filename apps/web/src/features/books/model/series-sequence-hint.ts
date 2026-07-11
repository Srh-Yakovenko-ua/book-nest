import type { ReadingStatus, SeriesBookView } from "@app/shared";

import { readingOrder } from "@/features/series";

export type SeriesSequenceHint =
  | { book: SeriesBookView; kind: "afterAdded" }
  | { book: SeriesBookView; kind: "beforeAdded" }
  | { kind: "afterMissing"; number: number }
  | { kind: "beforeMissing"; number: number }
  | { kind: "completed" }
  | { kind: "current" }
  | { kind: "none" };

type FirstIncomplete =
  | { book: SeriesBookView; kind: "added"; order: number }
  | { kind: "missing"; number: number; order: number };

const FINISHED_STATUS: ReadingStatus = "finished";

export function computeSeriesSequenceHint({
  books,
  currentId,
  currentPartNumber,
  totalBooks,
}: {
  books: SeriesBookView[];
  currentId: string;
  currentPartNumber: null | number;
  totalBooks: null | number;
}): SeriesSequenceHint {
  const firstIncomplete = findFirstIncomplete(books, totalBooks);

  if (firstIncomplete === null) {
    return totalBooks === null ? { kind: "none" } : { kind: "completed" };
  }

  if (firstIncomplete.kind === "added" && firstIncomplete.book.id === currentId) {
    return { kind: "current" };
  }

  const currentOrder = currentPartNumber ?? Number.POSITIVE_INFINITY;
  const isBefore = firstIncomplete.order < currentOrder;

  if (firstIncomplete.kind === "added") {
    return { book: firstIncomplete.book, kind: isBefore ? "beforeAdded" : "afterAdded" };
  }

  return isBefore
    ? { kind: "beforeMissing", number: firstIncomplete.number }
    : { kind: "afterMissing", number: firstIncomplete.number };
}

function findFirstIncomplete(
  books: SeriesBookView[],
  totalBooks: null | number,
): FirstIncomplete | null {
  if (totalBooks === null) {
    const next = readingOrder(books).find((book) => !isFinished(book.readingStatus));
    if (next === undefined) {
      return null;
    }
    return { book: next, kind: "added", order: next.partNumber ?? Number.POSITIVE_INFINITY };
  }

  for (let position = 1; position <= totalBooks; position += 1) {
    const added = books.find((book) => book.partNumber === position);
    if (added === undefined) {
      return { kind: "missing", number: position, order: position };
    }
    if (!isFinished(added.readingStatus)) {
      return { book: added, kind: "added", order: position };
    }
  }

  return null;
}

function isFinished(status: ReadingStatus): boolean {
  return status === FINISHED_STATUS;
}

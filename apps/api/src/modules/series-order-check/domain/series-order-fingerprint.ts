import { createHash } from "node:crypto";

import type {
  SeriesOrderDetectedIssue,
  SeriesOrderDetectionBook,
} from "./series-order-detection.js";

const NOT_QUEUED_MARKER = "-";

export function computeSeriesOrderFingerprint({
  issue,
  userId,
}: {
  issue: SeriesOrderDetectedIssue;
  userId: string;
}): string {
  const { inPlayBooks, primary, series } = issue;
  const relativeRankByBookId = buildRelativeRankMap(inPlayBooks);
  const inPlayTokens = [...inPlayBooks]
    .sort((first, second) => first.id.localeCompare(second.id))
    .map((book) => bookToken({ book, relativeRankByBookId }));

  const parts = [
    userId,
    series.id,
    primary.problemType,
    primary.affectedBook.id,
    primary.previousBook?.id ?? NOT_QUEUED_MARKER,
    ...inPlayTokens,
  ];

  return createHash("sha256").update(parts.join("|")).digest("hex");
}

function bookToken({
  book,
  relativeRankByBookId,
}: {
  book: SeriesOrderDetectionBook;
  relativeRankByBookId: Map<string, number>;
}): string {
  const relativeRank = relativeRankByBookId.get(book.id) ?? NOT_QUEUED_MARKER;
  const partNumber = book.partNumber ?? NOT_QUEUED_MARKER;

  return `${book.id}:${book.readingStatus}:${book.ownershipStatus}:${partNumber}:${relativeRank}`;
}

function buildRelativeRankMap(inPlayBooks: SeriesOrderDetectionBook[]): Map<string, number> {
  const queuedBooks = inPlayBooks
    .filter((book) => book.queuePosition !== null)
    .sort((first, second) => (first.queuePosition ?? 0) - (second.queuePosition ?? 0));

  const relativeRankByBookId = new Map<string, number>();
  queuedBooks.forEach((book, index) => {
    relativeRankByBookId.set(book.id, index + 1);
  });

  return relativeRankByBookId;
}

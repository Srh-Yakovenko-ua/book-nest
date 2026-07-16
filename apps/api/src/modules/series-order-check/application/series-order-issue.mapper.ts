import type {
  MediaView,
  Nullable,
  ReadingStatus,
  SeriesOrderBookView,
  SeriesOrderIssueView,
  SeriesOrderPositionView,
  SeriesOrderRelatedProblem,
} from "@app/shared";

import { compareByPartThenCreated } from "../../series/index.js";
import {
  type SeriesOrderConflict,
  type SeriesOrderDetectedIssue,
  type SeriesOrderDetectionBook,
} from "../domain/series-order-detection.js";

const CURRENT_READING_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "reading",
  "rereading",
]);

const READING_EFFECTIVE_POSITION = 0;

export function toSeriesOrderIssueView({
  coverByBookId,
  fingerprint,
  issue,
}: {
  coverByBookId: Map<string, Nullable<MediaView>>;
  fingerprint: string;
  issue: SeriesOrderDetectedIssue;
}): SeriesOrderIssueView {
  const { primary } = issue;

  return {
    affectedBook: toBookView(primary.affectedBook, coverByBookId),
    allowedActions: primary.allowedActions,
    currentOrder: toCurrentOrder(issue.inPlayBooks),
    fingerprint,
    previousBook:
      primary.previousBook === null ? null : toBookView(primary.previousBook, coverByBookId),
    problemType: primary.problemType,
    recommendedOrder: toRecommendedOrder(issue),
    relatedProblems: issue.related.map(toRelatedProblem),
    series: { cover: null, id: issue.series.id, title: issue.series.title },
    severity: primary.severity,
    unresolvedPreviousCount: primary.unresolvedPreviousCount,
  };
}

function effectivePosition(book: SeriesOrderDetectionBook): number {
  if (isCurrentReading(book.readingStatus)) {
    return READING_EFFECTIVE_POSITION;
  }
  return book.queuePosition ?? Number.POSITIVE_INFINITY;
}

function isCurrentReading(status: ReadingStatus): boolean {
  return CURRENT_READING_STATUSES.has(status);
}

function toBookView(
  book: SeriesOrderDetectionBook,
  coverByBookId: Map<string, Nullable<MediaView>>,
): SeriesOrderBookView {
  return {
    cover: coverByBookId.get(book.id) ?? null,
    id: book.id,
    isCurrentReading: isCurrentReading(book.readingStatus),
    ownershipStatus: book.ownershipStatus,
    queuePosition: book.queuePosition,
    readingStatus: book.readingStatus,
    seriesPosition: book.partNumber,
    title: book.title,
  };
}

function toCurrentOrder(inPlayBooks: SeriesOrderDetectionBook[]): SeriesOrderPositionView[] {
  return [...inPlayBooks]
    .sort((first, second) => effectivePosition(first) - effectivePosition(second))
    .map(toPositionView);
}

function toPositionView(book: SeriesOrderDetectionBook): SeriesOrderPositionView {
  return {
    bookId: book.id,
    queuePosition: book.queuePosition,
    seriesPosition: book.partNumber,
    title: book.title,
  };
}

function toRecommendedOrder(issue: SeriesOrderDetectedIssue): SeriesOrderPositionView[] {
  return [...issue.inPlayBooks, ...issue.addableBooks]
    .sort(compareByPartThenCreated)
    .map(toPositionView);
}

function toRelatedProblem(conflict: SeriesOrderConflict): SeriesOrderRelatedProblem {
  return {
    affectedBookId: conflict.affectedBook.id,
    previousBookId: conflict.previousBook?.id ?? null,
    problemType: conflict.problemType,
  };
}

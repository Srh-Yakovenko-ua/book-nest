import type {
  MediaView,
  Nullable,
  ReadingStatus,
  SeriesOrderBookView,
  SeriesOrderFixPreviewView,
  SeriesOrderFixStrategy,
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
import { type FixPlan } from "../domain/series-order-fix-plan.js";

const CURRENT_READING_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "reading",
  "rereading",
]);

const READING_EFFECTIVE_POSITION = 0;

export function toSeriesOrderFixPreviewView({
  fingerprint,
  plan,
  queueVersion,
  series,
  strategy,
}: {
  fingerprint: string;
  plan: FixPlan;
  queueVersion: string;
  series: { id: string; title: string };
  strategy: SeriesOrderFixStrategy;
}): SeriesOrderFixPreviewView {
  return {
    addedBooksCount: plan.addedBookIds.length,
    after: plan.after,
    before: plan.before,
    changes: plan.changes,
    fingerprint,
    movedBooksCount: plan.movedBookIds.length,
    queueVersion,
    series,
    shiftedUnrelatedBooksCount: plan.shiftedUnrelatedBooksCount,
    strategy,
    warnings: plan.warnings,
  };
}

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
    currentOrder: toCurrentOrder(issue.inPlayBooks, coverByBookId),
    fingerprint,
    previousBook:
      primary.previousBook === null ? null : toBookView(primary.previousBook, coverByBookId),
    problemType: primary.problemType,
    recommendedOrder: toRecommendedOrder(issue, coverByBookId),
    relatedProblems: issue.related.map(toRelatedProblem),
    series: { id: issue.series.id, title: issue.series.title },
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

function toCurrentOrder(
  inPlayBooks: SeriesOrderDetectionBook[],
  coverByBookId: Map<string, Nullable<MediaView>>,
): SeriesOrderPositionView[] {
  return [...inPlayBooks]
    .sort((first, second) => effectivePosition(first) - effectivePosition(second))
    .map((book) => toPositionView(book, coverByBookId));
}

function toPositionView(
  book: SeriesOrderDetectionBook,
  coverByBookId: Map<string, Nullable<MediaView>>,
): SeriesOrderPositionView {
  return {
    bookId: book.id,
    cover: coverByBookId.get(book.id) ?? null,
    queuePosition: book.queuePosition,
    seriesPosition: book.partNumber,
    title: book.title,
  };
}

function toRecommendedOrder(
  issue: SeriesOrderDetectedIssue,
  coverByBookId: Map<string, Nullable<MediaView>>,
): SeriesOrderPositionView[] {
  return [...issue.inPlayBooks, ...issue.addableBooks]
    .sort(compareByPartThenCreated)
    .map((book) => toPositionView(book, coverByBookId));
}

function toRelatedProblem(conflict: SeriesOrderConflict): SeriesOrderRelatedProblem {
  return {
    affectedBookId: conflict.affectedBook.id,
    previousBookId: conflict.previousBook?.id ?? null,
    problemType: conflict.problemType,
  };
}

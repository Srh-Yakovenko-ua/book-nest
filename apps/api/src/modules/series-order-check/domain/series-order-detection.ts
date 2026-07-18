import type {
  Nullable,
  OwnershipStatus,
  ReadingStatus,
  SeriesOrderActionCode,
  SeriesOrderProblemType,
  SeriesOrderSeverity,
} from "@app/shared";

import { isClosedReadingStatus } from "@app/shared";

import { compareByPartThenCreated } from "../../series/index.js";

export type SeriesOrderConflict = {
  affectedBook: SeriesOrderDetectionBook;
  allowedActions: SeriesOrderActionCode[];
  previousBook: Nullable<SeriesOrderDetectionBook>;
  problemType: SeriesOrderProblemType;
  severity: SeriesOrderSeverity;
  unresolvedPreviousCount: number;
};

export type SeriesOrderDetectedIssue = {
  addableBooks: SeriesOrderDetectionBook[];
  inPlayBooks: SeriesOrderDetectionBook[];
  primary: SeriesOrderConflict;
  related: SeriesOrderConflict[];
  series: { id: string; title: string };
};

export type SeriesOrderDetectionBook = {
  createdAt: Date;
  id: string;
  ownershipStatus: OwnershipStatus;
  partNumber: Nullable<number>;
  queuePosition: Nullable<number>;
  readingStatus: ReadingStatus;
  title: string;
};

export type SeriesOrderDetectionSeries = {
  books: SeriesOrderDetectionBook[];
  id: string;
  title: string;
};

type PartedBook = SeriesOrderDetectionBook & { partNumber: number };

type RankedConflict = {
  conflict: SeriesOrderConflict;
  sortedMissingPrevious: PartedBook[];
};

const MIN_PARTED_BOOKS = 2;
const MIN_JUMBLED_QUEUED = 3;
const MULTIPLE_MISSING_THRESHOLD = 2;

const READING_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "reading",
  "rereading",
]);

const BASE_ACTIONS: readonly SeriesOrderActionCode[] = ["IGNORE_ISSUE", "DISABLE_SERIES_CHECK"];

const PRIMARY_ACTIONS: Record<SeriesOrderProblemType, readonly SeriesOrderActionCode[]> = {
  current_reading_ahead_of_order: ["OPEN_PREVIOUS_BOOK"],
  missing_previous_from_queue: ["ADD_NEXT_PREVIOUS_BEFORE"],
  multiple_books_out_of_order: ["REORDER_SERIES_SLOTS"],
  multiple_previous_missing: ["ADD_NEXT_PREVIOUS_BEFORE", "ADD_ALL_PREVIOUS_BEFORE"],
  previous_book_after_later_book: ["REORDER_SERIES_SLOTS"],
  previous_book_in_transit: ["OPEN_ORDER", "OPEN_PREVIOUS_BOOK"],
  previous_book_lent_out: ["OPEN_LOAN", "OPEN_PREVIOUS_BOOK"],
  previous_book_not_owned: ["ADD_PREVIOUS_TO_WISHLIST", "OPEN_PREVIOUS_BOOK"],
  previous_book_paused: ["RESUME_PREVIOUS_BOOK", "OPEN_PREVIOUS_BOOK"],
  previous_book_want_to_buy: ["OPEN_PURCHASE", "OPEN_PREVIOUS_BOOK"],
};

const PROBLEM_TYPE_PRIORITY: Record<SeriesOrderProblemType, number> = {
  current_reading_ahead_of_order: 0,
  missing_previous_from_queue: 4,
  multiple_books_out_of_order: 2,
  multiple_previous_missing: 3,
  previous_book_after_later_book: 1,
  previous_book_in_transit: 6,
  previous_book_lent_out: 6,
  previous_book_not_owned: 6,
  previous_book_paused: 5,
  previous_book_want_to_buy: 6,
};

const PROBLEM_TYPE_SEVERITY: Record<SeriesOrderProblemType, SeriesOrderSeverity> = {
  current_reading_ahead_of_order: "error",
  missing_previous_from_queue: "warning",
  multiple_books_out_of_order: "error",
  multiple_previous_missing: "warning",
  previous_book_after_later_book: "error",
  previous_book_in_transit: "warning",
  previous_book_lent_out: "warning",
  previous_book_not_owned: "warning",
  previous_book_paused: "info",
  previous_book_want_to_buy: "warning",
};

export function detectSeriesOrderIssue(
  series: SeriesOrderDetectionSeries,
): Nullable<SeriesOrderDetectedIssue> {
  const partedBooks = series.books.filter(hasPartNumber);
  if (partedBooks.length < MIN_PARTED_BOOKS) {
    return null;
  }

  const perBookConflicts = collectPerBookConflicts(partedBooks);
  const conflicts = collapseOutOfOrder({ conflicts: perBookConflicts, partedBooks });
  if (conflicts.length === 0) {
    return null;
  }

  const ranked = [...conflicts].sort((first, second) =>
    compareConflicts(first.conflict, second.conflict),
  );
  const primary = ranked[0];
  if (primary === undefined) {
    return null;
  }

  return {
    addableBooks: resolveAddableBooks(primary),
    inPlayBooks: series.books.filter(isInPlay),
    primary: primary.conflict,
    related: ranked.slice(1).map((detection) => detection.conflict),
    series: { id: series.id, title: series.title },
  };
}

export function detectSeriesOrderIssues(
  seriesList: SeriesOrderDetectionSeries[],
): SeriesOrderDetectedIssue[] {
  const issues: SeriesOrderDetectedIssue[] = [];
  for (const series of seriesList) {
    const issue = detectSeriesOrderIssue(series);
    if (issue !== null) {
      issues.push(issue);
    }
  }

  return issues.sort(compareIssues);
}

function actionsFor(problemType: SeriesOrderProblemType): SeriesOrderActionCode[] {
  return [...PRIMARY_ACTIONS[problemType], ...BASE_ACTIONS];
}

function collapseOutOfOrder({
  conflicts,
  partedBooks,
}: {
  conflicts: RankedConflict[];
  partedBooks: PartedBook[];
}): RankedConflict[] {
  const queuedParted = partedBooks
    .filter(isJumbleCandidate)
    .sort((first, second) => first.queuePosition - second.queuePosition);
  if (queuedParted.length < MIN_JUMBLED_QUEUED || isStrictlyIncreasingByPart(queuedParted)) {
    return conflicts;
  }

  const affectedBook = queuedParted[0];
  if (affectedBook === undefined) {
    return conflicts;
  }

  const withoutAfterLater = conflicts.filter(
    (detection) => detection.conflict.problemType !== "previous_book_after_later_book",
  );

  return [
    ...withoutAfterLater,
    {
      conflict: {
        affectedBook,
        allowedActions: actionsFor("multiple_books_out_of_order"),
        previousBook: null,
        problemType: "multiple_books_out_of_order",
        severity: PROBLEM_TYPE_SEVERITY.multiple_books_out_of_order,
        unresolvedPreviousCount: 0,
      },
      sortedMissingPrevious: [],
    },
  ];
}

function collectPerBookConflicts(partedBooks: PartedBook[]): RankedConflict[] {
  const activeBooks = partedBooks.filter(isInPlay);
  const conflicts: RankedConflict[] = [];

  for (const affectedBook of activeBooks) {
    const problematicPrevious = partedBooks.filter(
      (previous) =>
        previous.id !== affectedBook.id &&
        previous.partNumber < affectedBook.partNumber &&
        !isClosedReadingStatus(previous.readingStatus) &&
        isProblematicPrevious({ affectedBook, previous }),
    );
    if (problematicPrevious.length === 0) {
      continue;
    }

    const sortedProblematic = [...problematicPrevious].sort(compareByPartThenCreated);
    const firstProblematic = sortedProblematic[0];
    if (firstProblematic === undefined) {
      continue;
    }

    const sortedMissingPrevious = problematicPrevious
      .filter((previous) => previous.queuePosition === null)
      .sort(compareByPartThenCreated);
    const problemType = resolveProblemType({
      affectedBook,
      firstProblematic,
      missingCount: sortedMissingPrevious.length,
    });

    conflicts.push({
      conflict: {
        affectedBook,
        allowedActions: actionsFor(problemType),
        previousBook: firstProblematic,
        problemType,
        severity: PROBLEM_TYPE_SEVERITY[problemType],
        unresolvedPreviousCount: problematicPrevious.length,
      },
      sortedMissingPrevious,
    });
  }

  return conflicts;
}

function compareConflicts(first: SeriesOrderConflict, second: SeriesOrderConflict): number {
  const priorityDiff =
    PROBLEM_TYPE_PRIORITY[first.problemType] - PROBLEM_TYPE_PRIORITY[second.problemType];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const positionDiff = compareNumbers(
    rankPosition(first.affectedBook),
    rankPosition(second.affectedBook),
  );
  if (positionDiff !== 0) {
    return positionDiff;
  }

  return compareNumbers(
    previousPartRank(first.previousBook),
    previousPartRank(second.previousBook),
  );
}

function compareIssues(first: SeriesOrderDetectedIssue, second: SeriesOrderDetectedIssue): number {
  const conflictDiff = compareConflicts(first.primary, second.primary);
  if (conflictDiff !== 0) {
    return conflictDiff;
  }

  return first.series.id.localeCompare(second.series.id);
}

function compareNumbers(first: number, second: number): number {
  if (first === second) {
    return 0;
  }

  return first < second ? -1 : 1;
}

function effectivePosition(book: SeriesOrderDetectionBook): Nullable<number> {
  return isReading(book.readingStatus) ? 0 : book.queuePosition;
}

function hasPartNumber(book: SeriesOrderDetectionBook): book is PartedBook {
  return book.partNumber !== null;
}

function isInPlay(book: SeriesOrderDetectionBook): boolean {
  return book.queuePosition !== null || isReading(book.readingStatus);
}

function isJumbleCandidate(book: PartedBook): book is PartedBook & { queuePosition: number } {
  return isQueuedParted(book) && !isClosedReadingStatus(book.readingStatus);
}

function isProblematicPrevious({
  affectedBook,
  previous,
}: {
  affectedBook: SeriesOrderDetectionBook;
  previous: SeriesOrderDetectionBook;
}): boolean {
  const previousPosition = effectivePosition(previous);
  if (previousPosition === null) {
    return true;
  }

  const affectedPosition = effectivePosition(affectedBook);
  if (affectedPosition === null) {
    return true;
  }

  return previousPosition > affectedPosition;
}

function isQueuedParted(book: PartedBook): book is PartedBook & { queuePosition: number } {
  return book.queuePosition !== null;
}

function isReading(status: ReadingStatus): boolean {
  return READING_STATUSES.has(status);
}

function isStrictlyIncreasingByPart(orderedBooks: PartedBook[]): boolean {
  for (let index = 1; index < orderedBooks.length; index += 1) {
    const previous = orderedBooks[index - 1];
    const current = orderedBooks[index];
    if (previous === undefined || current === undefined) {
      continue;
    }
    if (current.partNumber <= previous.partNumber) {
      return false;
    }
  }

  return true;
}

function previousPartRank(previousBook: Nullable<SeriesOrderDetectionBook>): number {
  if (previousBook === null || previousBook.partNumber === null) {
    return Number.POSITIVE_INFINITY;
  }

  return previousBook.partNumber;
}

function rankPosition(book: SeriesOrderDetectionBook): number {
  return effectivePosition(book) ?? Number.POSITIVE_INFINITY;
}

function resolveAddableBooks(primary: RankedConflict): SeriesOrderDetectionBook[] {
  const { conflict } = primary;
  if (conflict.problemType === "missing_previous_from_queue") {
    return conflict.previousBook === null ? [] : [conflict.previousBook];
  }
  if (conflict.problemType === "multiple_previous_missing") {
    return primary.sortedMissingPrevious;
  }

  return [];
}

function resolveOwnershipProblemType({
  missingCount,
  ownershipStatus,
}: {
  missingCount: number;
  ownershipStatus: OwnershipStatus;
}): SeriesOrderProblemType {
  switch (ownershipStatus) {
    case "borrowed_from_someone":
    case "owned":
      return missingCount >= MULTIPLE_MISSING_THRESHOLD
        ? "multiple_previous_missing"
        : "missing_previous_from_queue";
    case "in_transit":
      return "previous_book_in_transit";
    case "lent_to_someone":
      return "previous_book_lent_out";
    case "none":
      return "previous_book_not_owned";
    case "want_to_buy":
      return "previous_book_want_to_buy";
    default: {
      const _exhaustiveCheck: never = ownershipStatus;
      return _exhaustiveCheck;
    }
  }
}

function resolveProblemType({
  affectedBook,
  firstProblematic,
  missingCount,
}: {
  affectedBook: PartedBook;
  firstProblematic: PartedBook;
  missingCount: number;
}): SeriesOrderProblemType {
  if (isReading(affectedBook.readingStatus)) {
    return "current_reading_ahead_of_order";
  }
  if (firstProblematic.queuePosition !== null) {
    return "previous_book_after_later_book";
  }
  if (firstProblematic.readingStatus === "paused") {
    return "previous_book_paused";
  }

  return resolveOwnershipProblemType({
    missingCount,
    ownershipStatus: firstProblematic.ownershipStatus,
  });
}

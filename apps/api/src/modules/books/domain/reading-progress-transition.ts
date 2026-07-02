import type { ReadingStatus } from "@app/shared";

import type {
  CreateReadingProgressData,
  ReadingChangePatch,
} from "../infrastructure/books.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";

const STATUSES_STARTED_BY_PROGRESS: ReadonlySet<ReadingStatus> = new Set([
  "not_started",
  "want_to_read",
]);

export type ReadingProgressTransitionInput = {
  currentPage: number;
  currentStatus: ReadingStatus;
  existingStartedAt: Date | null;
  markAsFinished?: boolean;
  pagesCount: null | number;
  updateDate: string;
};

export function computeReadingProgressChange(
  input: ReadingProgressTransitionInput,
): ReadingChangePatch {
  const date = parseIsoDate(input.updateDate);
  const resolvedPage =
    input.markAsFinished === true && input.pagesCount !== null
      ? input.pagesCount
      : input.currentPage;

  const progress: Partial<CreateReadingProgressData> = {
    currentPage: resolvedPage,
    lastProgressUpdateAt: date,
  };
  const book: ReadingChangePatch["book"] = {};

  if (STATUSES_STARTED_BY_PROGRESS.has(input.currentStatus) && resolvedPage > 0) {
    book.readingStatus = "reading";
    progress.startedAt = input.existingStartedAt ?? date;
  }

  if (input.markAsFinished === true) {
    book.readingStatus = "finished";
    progress.finishedAt = date;
  }

  return { book, progress };
}

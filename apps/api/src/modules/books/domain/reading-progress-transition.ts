import type { Nullable, ReadingStatus } from "@app/shared";

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
  let readingStatus: Nullable<ReadingStatus> = null;

  if (STATUSES_STARTED_BY_PROGRESS.has(input.currentStatus) && resolvedPage > 0) {
    readingStatus = "reading";
    progress.startedAt = input.existingStartedAt ?? date;
  }

  if (input.markAsFinished === true) {
    readingStatus = "finished";
    progress.finishedAt = date;
  }

  return { book: readingStatus === null ? null : { readingStatus }, progress };
}

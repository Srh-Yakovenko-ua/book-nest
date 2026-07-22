import type { BookView, Nullable, ReadingStatus } from "@app/shared";

import { isClosedReadingStatus } from "@app/shared";

const AUDIOBOOK_FORMAT = "audiobook";

const STATUSES_WITH_READING_PROGRESS: readonly ReadingStatus[] = [
  "dnf",
  "finished",
  "paused",
  "reading",
  "rereading",
];

export type QueueVolumeGapReason = "invalid_progress" | "missing_page_count";

export function queueVolumeGapReason(book: BookView): Nullable<QueueVolumeGapReason> {
  if (isClosedReadingStatus(book.readingStatus)) return null;

  if (book.pagesCount !== null) {
    if (normalizedCurrentPage(book) > book.pagesCount) return "invalid_progress";
    return null;
  }

  if (book.pagesCountUnavailable) return null;
  if (isAudiobookOnly(book.formats)) return null;

  return "missing_page_count";
}

function isAudiobookOnly(formats: readonly string[]): boolean {
  return formats.length === 1 && formats[0] === AUDIOBOOK_FORMAT;
}

function normalizedCurrentPage(book: BookView): number {
  if (!STATUSES_WITH_READING_PROGRESS.includes(book.readingStatus)) return 0;
  return book.readingProgress?.currentPage ?? 0;
}

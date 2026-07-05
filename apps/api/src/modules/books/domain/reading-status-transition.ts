import type { ReadingStatus } from "@app/shared";

import type {
  CreateReadingProgressData,
  ReadingChangePatch,
} from "../infrastructure/books.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";

export type ReadingStatusTransitionInput = {
  currentPage?: number;
  date: string;
  existingStartedAt: Date | null;
  hasExistingProgress: boolean;
  note?: null | string;
  pagesCount: null | number;
  rating?: null | number;
  resetProgress?: boolean;
  targetStatus: ReadingStatus;
};

export function computeReadingStatusChange(
  input: ReadingStatusTransitionInput,
): ReadingChangePatch {
  const date = parseIsoDate(input.date);
  const progress: Partial<CreateReadingProgressData> = {};

  switch (input.targetStatus) {
    case "dnf":
      progress.abandonedAt = date;
      progress.finishedAt = null;
      progress.pausedAt = null;
      progress.note = input.note ?? null;
      if (input.currentPage !== undefined) {
        progress.currentPage = input.currentPage;
      }
      break;
    case "finished":
      progress.finishedAt = date;
      progress.abandonedAt = null;
      progress.pausedAt = null;
      progress.note = null;
      if (input.pagesCount !== null) {
        progress.currentPage = input.pagesCount;
      }
      if (input.rating !== undefined) {
        progress.rating = input.rating;
      }
      break;
    case "not_started":
    case "want_to_read":
      if (input.hasExistingProgress) {
        progress.startedAt = null;
        progress.finishedAt = null;
        progress.pausedAt = null;
        progress.abandonedAt = null;
        progress.rating = null;
        progress.note = null;
        if (input.resetProgress === true) {
          progress.currentPage = null;
        }
      }
      break;
    case "paused":
      progress.pausedAt = date;
      progress.abandonedAt = null;
      progress.finishedAt = null;
      progress.note = input.note ?? null;
      if (input.currentPage !== undefined) {
        progress.currentPage = input.currentPage;
      }
      break;
    case "reading":
    case "rereading":
      progress.startedAt = input.existingStartedAt ?? date;
      progress.pausedAt = null;
      progress.abandonedAt = null;
      progress.finishedAt = null;
      progress.note = null;
      if (input.currentPage !== undefined) {
        progress.currentPage = input.currentPage;
      }
      break;
    default: {
      const _exhaustiveCheck: never = input.targetStatus;
      return _exhaustiveCheck;
    }
  }

  return { book: { readingStatus: input.targetStatus }, progress };
}

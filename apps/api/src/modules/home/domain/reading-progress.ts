import type { Nullable, ReadingStatus } from "@app/shared";

const PERCENT = { max: 100, min: 0 } as const;

export function computeProgressPercent({
  currentPage,
  pagesCount,
}: {
  currentPage: Nullable<number>;
  pagesCount: Nullable<number>;
}): Nullable<number> {
  if (currentPage === null || pagesCount === null || pagesCount <= 0) {
    return null;
  }
  const percent = Math.round((currentPage / pagesCount) * PERCENT.max);
  return Math.min(PERCENT.max, Math.max(PERCENT.min, percent));
}

export function resolveCurrentCyclePage({
  currentPage,
  endedCyclesCount,
  hasCurrentCycleProgress,
  readingStatus,
}: {
  currentPage: Nullable<number>;
  endedCyclesCount: number;
  hasCurrentCycleProgress: boolean;
  readingStatus: ReadingStatus;
}): Nullable<number> {
  if (currentPage === null) {
    return null;
  }
  if (hasCurrentCycleProgress) {
    return currentPage;
  }
  if (readingStatus === "rereading" || endedCyclesCount > 0) {
    return null;
  }
  return currentPage;
}

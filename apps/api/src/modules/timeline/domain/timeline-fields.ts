import type { Nullable, ReadingStatus, TimelineReadingPosition } from "@app/shared";

import { isClosedReadingStatus } from "@app/shared";

export const DEFAULT_TIMELINE_NAME = "Основна часова лінія";

export function emptyToNull(value: Nullable<string> | undefined): Nullable<string> {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function resolveReadingPosition({
  currentPage,
  readingStatus,
}: {
  currentPage: Nullable<number>;
  readingStatus: ReadingStatus;
}): TimelineReadingPosition {
  return {
    currentPage,
    guardDefault: !isClosedReadingStatus(readingStatus),
    positionKnown: currentPage !== null,
  };
}

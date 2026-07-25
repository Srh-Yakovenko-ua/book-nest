import type {
  Nullable,
  ReadingStatus,
  TimelineReadingPosition,
  UpdateTimelineEventInput,
} from "@app/shared";

import { isClosedReadingStatus } from "@app/shared";

export const DEFAULT_TIMELINE_NAME = "Основна часова лінія";

export type UpdateEventFields = {
  chapter?: Nullable<string>;
  description?: Nullable<string>;
  eventType?: string;
  importance?: string;
  importanceRank?: number;
  location?: Nullable<string>;
  pageNumber?: Nullable<number>;
  personalNote?: Nullable<string>;
  resolvedByEventId?: Nullable<string>;
  storyTime?: Nullable<string>;
  summary?: Nullable<string>;
  threadStatus?: Nullable<string>;
  title?: string;
};

export function applyTextFields({
  fields,
  input,
}: {
  fields: UpdateEventFields;
  input: UpdateTimelineEventInput;
}): void {
  if (input.title !== undefined) {
    fields.title = input.title;
  }
  if (input.summary !== undefined) {
    fields.summary = emptyToNull(input.summary);
  }
  if (input.description !== undefined) {
    fields.description = emptyToNull(input.description);
  }
  if (input.chapter !== undefined) {
    fields.chapter = emptyToNull(input.chapter);
  }
  if (input.location !== undefined) {
    fields.location = emptyToNull(input.location);
  }
  if (input.storyTime !== undefined) {
    fields.storyTime = emptyToNull(input.storyTime);
  }
  if (input.personalNote !== undefined) {
    fields.personalNote = emptyToNull(input.personalNote);
  }
}

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

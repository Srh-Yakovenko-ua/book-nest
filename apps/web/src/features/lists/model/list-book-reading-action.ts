import type { Nullable } from "@app/shared";

import type { CustomListDetailDtoBooksItemsItemReadingStatus } from "@/shared/api/generated/model";

export type ListBookReadingAction = "resume" | "start";

type ListBookReadingStatus = CustomListDetailDtoBooksItemsItemReadingStatus;

const READING_ACTION_BY_STATUS = {
  dnf: null,
  finished: null,
  not_started: "start",
  paused: "resume",
  reading: null,
  rereading: null,
  want_to_read: "start",
} as const satisfies Record<ListBookReadingStatus, Nullable<ListBookReadingAction>>;

export function listBookReadingAction(
  readingStatus: ListBookReadingStatus,
): Nullable<ListBookReadingAction> {
  return READING_ACTION_BY_STATUS[readingStatus];
}

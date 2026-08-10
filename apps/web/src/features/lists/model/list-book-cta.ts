import type { CustomListDetailDtoBooksItemsItemReadingStatus } from "@/shared/api/generated/model";

export type ListBookCta = "continue" | "resume" | "start" | "view";

type ListBookReadingStatus = CustomListDetailDtoBooksItemsItemReadingStatus;

const CTA_BY_STATUS = {
  dnf: "view",
  finished: "view",
  not_started: "start",
  paused: "resume",
  reading: "continue",
  rereading: "continue",
  want_to_read: "start",
} as const satisfies Record<ListBookReadingStatus, ListBookCta>;

export function listBookCta(readingStatus: ListBookReadingStatus): ListBookCta {
  return CTA_BY_STATUS[readingStatus];
}

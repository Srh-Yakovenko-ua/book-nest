import type { OwnershipStatus, ReadingStatus } from "@app/shared";

export const PUBLISHER_BOOK_STATUSES = {
  read: ["finished", "rereading"],
  reading: ["reading", "rereading"],
  wantToBuy: "want_to_buy",
  wantToRead: "want_to_read",
} as const satisfies {
  read: readonly ReadingStatus[];
  reading: readonly ReadingStatus[];
  wantToBuy: OwnershipStatus;
  wantToRead: ReadingStatus;
};

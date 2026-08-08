import type { CustomListDetail, ListBookTab, ReadingStatus } from "@app/shared";

export type ListStatusCounts = CustomListDetail["statusCounts"];

export type ListTabCounts = {
  all: number;
  finished: number;
  notStarted: number;
  reading: number;
};

export const TAB_STATUSES: Record<ListBookTab, ReadingStatus[] | undefined> = {
  all: undefined,
  finished: ["finished"],
  not_started: ["not_started", "want_to_read"],
  reading: ["reading", "rereading"],
};

export function resolveListBookStatuses({
  status,
  tab,
}: {
  status: ReadingStatus[] | undefined;
  tab: ListBookTab;
}): ReadingStatus[] | undefined {
  if (status !== undefined && status.length > 0) {
    return status;
  }
  return TAB_STATUSES[tab];
}

export function toListStatusCounts({
  all,
  finished,
  notStarted,
  reading,
}: ListTabCounts): ListStatusCounts {
  return { all, finished, not_started: notStarted, reading };
}

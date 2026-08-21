import type { CustomListDetail, ListBookTab, ReadingStatus } from "@app/shared";

import { LIST_TAB_READING_STATUSES } from "@app/shared";

export type ListQuickCounts = {
  all: number;
  favorites: number;
  finished: number;
  inQueue: number;
  notStarted: number;
  reading: number;
  series: number;
};

export type ListQuickCountsView = CustomListDetail["quickCounts"];

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
  return LIST_TAB_READING_STATUSES[tab];
}

export function toListQuickCountsView({
  all,
  favorites,
  finished,
  inQueue,
  notStarted,
  reading,
  series,
}: ListQuickCounts): ListQuickCountsView {
  return {
    all,
    favorites,
    finished,
    in_queue: inQueue,
    not_started: notStarted,
    reading,
    series,
  };
}

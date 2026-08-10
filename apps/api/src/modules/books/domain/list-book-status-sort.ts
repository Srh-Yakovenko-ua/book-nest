import type { ListBookSort, ReadingStatus } from "@app/shared";

export type StatusSortedEntry = {
  bookId: string;
  isFinished: boolean;
};

const FINISHED_STATUS: ReadingStatus = "finished";

export const STATUS_SORTS: ListBookSort[] = ["status_unread_first", "status_read_first"];

export function isFinishedStatus(status: string): boolean {
  return status === FINISHED_STATUS;
}

export function isStatusSort(sort: ListBookSort): boolean {
  return STATUS_SORTS.includes(sort);
}

export function selectStatusSortedPage({
  entries,
  skip,
  sort,
  take,
}: {
  entries: StatusSortedEntry[];
  skip: number;
  sort: ListBookSort;
  take: number;
}): string[] {
  const finished = entries.filter((entry) => entry.isFinished).map((entry) => entry.bookId);
  const unread = entries.filter((entry) => !entry.isFinished).map((entry) => entry.bookId);
  const ordered =
    sort === "status_read_first" ? [...finished, ...unread] : [...unread, ...finished];
  return ordered.slice(skip, skip + take);
}

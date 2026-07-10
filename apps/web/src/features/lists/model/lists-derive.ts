import type { CustomListCard, ListSort, Nullable } from "@app/shared";

export const LIST_SORT_OPTIONS = [
  "updated_desc",
  "created_desc",
  "created_asc",
  "title_asc",
  "title_desc",
  "books_count_desc",
  "books_count_asc",
] as const satisfies readonly ListSort[];

export const LIST_SORT_DEFAULT: ListSort = "updated_desc";

export type ListsStats = {
  booksInLists: number;
  mostPopular: Nullable<CustomListCard>;
  totalLists: number;
};

export function filterLists(lists: CustomListCard[], search: string): CustomListCard[] {
  const normalized = search.trim().toLowerCase();
  if (normalized.length === 0) return lists;
  return lists.filter(
    (list) =>
      list.name.toLowerCase().includes(normalized) ||
      (list.description !== null && list.description.toLowerCase().includes(normalized)),
  );
}

const SORT_COMPARATORS: Record<ListSort, (a: CustomListCard, b: CustomListCard) => number> = {
  books_count_asc: (a, b) => a.bookCount - b.bookCount,
  books_count_desc: (a, b) => b.bookCount - a.bookCount,
  created_asc: (a, b) => a.createdAt.localeCompare(b.createdAt),
  created_desc: (a, b) => b.createdAt.localeCompare(a.createdAt),
  title_asc: (a, b) => a.name.localeCompare(b.name),
  title_desc: (a, b) => b.name.localeCompare(a.name),
  updated_desc: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
};

export function deriveListsStats(lists: CustomListCard[]): ListsStats {
  const booksInLists = lists.reduce((sum, list) => sum + list.bookCount, 0);
  const mostPopular = lists.reduce<Nullable<CustomListCard>>(
    (top, list) => (top === null || list.bookCount > top.bookCount ? list : top),
    null,
  );
  return { booksInLists, mostPopular, totalLists: lists.length };
}

export function sortLists(lists: CustomListCard[], sort: ListSort): CustomListCard[] {
  return [...lists].sort(SORT_COMPARATORS[sort]);
}

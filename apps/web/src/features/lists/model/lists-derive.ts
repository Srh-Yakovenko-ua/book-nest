import type { CustomListCard, ListSort, Nullable } from "@app/shared";

import { isBefore, parseISO, subMonths } from "date-fns";

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

export type ListAttentionReason = "empty" | "no_description" | "stale";

export const LIST_ATTENTION_REASONS = [
  "empty",
  "no_description",
  "stale",
] as const satisfies readonly ListAttentionReason[];

export const LIST_STALE_MONTHS = 6;

const LIST_ATTENTION_PREDICATES: Record<
  ListAttentionReason,
  (list: CustomListCard, staleBefore: Date) => boolean
> = {
  empty: (list) => list.bookCount === 0,
  no_description: (list) => list.description === null || list.description.trim() === "",
  stale: (list, staleBefore) => isBefore(parseISO(list.updatedAt), staleBefore),
};

export function countListsAttention(
  lists: CustomListCard[],
  now: Date = new Date(),
): Record<ListAttentionReason, number> {
  const staleBefore = subMonths(now, LIST_STALE_MONTHS);
  const counts: Record<ListAttentionReason, number> = { empty: 0, no_description: 0, stale: 0 };
  for (const list of lists) {
    for (const reason of LIST_ATTENTION_REASONS) {
      if (LIST_ATTENTION_PREDICATES[reason](list, staleBefore)) {
        counts[reason] += 1;
      }
    }
  }
  return counts;
}

export function filterLists(lists: CustomListCard[], search: string): CustomListCard[] {
  const normalized = search.trim().toLowerCase();
  if (normalized.length === 0) return lists;
  return lists.filter(
    (list) =>
      list.name.toLowerCase().includes(normalized) ||
      (list.description !== null && list.description.toLowerCase().includes(normalized)),
  );
}

export function filterListsByAttention(
  lists: CustomListCard[],
  attention: Nullable<ListAttentionReason>,
  now: Date = new Date(),
): CustomListCard[] {
  if (attention === null) return lists;
  const staleBefore = subMonths(now, LIST_STALE_MONTHS);
  return lists.filter((list) => LIST_ATTENTION_PREDICATES[attention](list, staleBefore));
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

export function sortLists(lists: CustomListCard[], sort: ListSort): CustomListCard[] {
  return [...lists].sort(SORT_COMPARATORS[sort]);
}

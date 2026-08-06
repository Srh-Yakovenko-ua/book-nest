import {
  type inferParserType,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { ListsControllerSearchParams } from "@/shared/api/generated/model";

import {
  ListsControllerSearchAttention,
  ListsControllerSearchDescriptionItem,
  ListsControllerSearchFillItem,
  ListsControllerSearchSizeItem,
  ListsControllerSearchSort,
} from "@/shared/api/generated/model";

export const LISTS_PAGE_SIZE = 24;

export const LIST_SORT_DEFAULT = ListsControllerSearchSort.updated_desc;

export const LIST_SORT_OPTIONS = [
  ListsControllerSearchSort.updated_desc,
  ListsControllerSearchSort.created_desc,
  ListsControllerSearchSort.created_asc,
  ListsControllerSearchSort.title_asc,
  ListsControllerSearchSort.title_desc,
  ListsControllerSearchSort.books_count_desc,
  ListsControllerSearchSort.books_count_asc,
] as const satisfies readonly ListsControllerSearchSort[];

export const LIST_FILL_VALUES = Object.values(ListsControllerSearchFillItem);
export const LIST_DESCRIPTION_VALUES = Object.values(ListsControllerSearchDescriptionItem);
export const LIST_SIZE_VALUES = Object.values(ListsControllerSearchSizeItem);
export const LIST_ATTENTION_REASONS = Object.values(ListsControllerSearchAttention);

export type ListAttentionReason = ListsControllerSearchAttention;
export type ListsListParams = Omit<ListsControllerSearchParams, "pageNumber">;

export type ListSort = ListsControllerSearchSort;

export const listsQueryParsers = {
  attention: parseAsStringLiteral(LIST_ATTENTION_REASONS),
  description: parseAsArrayOf(parseAsStringLiteral(LIST_DESCRIPTION_VALUES)).withDefault([]),
  fill: parseAsArrayOf(parseAsStringLiteral(LIST_FILL_VALUES)).withDefault([]),
  q: parseAsString.withDefault(""),
  size: parseAsArrayOf(parseAsStringLiteral(LIST_SIZE_VALUES)).withDefault([]),
  sort: parseAsStringLiteral(LIST_SORT_OPTIONS).withDefault(LIST_SORT_DEFAULT),
};

export type ListsQueryState = inferParserType<typeof listsQueryParsers>;

export const LISTS_FILTERS_RESET = {
  attention: null,
  description: null,
  fill: null,
  q: null,
  size: null,
} satisfies Partial<Record<keyof ListsQueryState, null>>;

export function activeListFilterCount(state: ListsQueryState): number {
  let count = 0;
  if (state.fill.length > 0) count += 1;
  if (state.description.length > 0) count += 1;
  if (state.size.length > 0) count += 1;
  return count;
}

export function hasActiveListFilters(state: ListsQueryState): boolean {
  return activeListFilterCount(state) > 0 || state.attention !== null || state.q.trim() !== "";
}

export function toListsListParams(state: ListsQueryState): ListsListParams {
  const search = state.q.trim();

  return {
    description: state.description,
    fill: state.fill,
    pageSize: LISTS_PAGE_SIZE,
    size: state.size,
    sort: state.sort,
    ...(search === "" ? {} : { search }),
    ...(state.attention === null ? {} : { attention: state.attention }),
  };
}

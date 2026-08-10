import {
  type inferParserType,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { ListDetailsControllerDetailParams } from "@/shared/api/generated/model";

import {
  ListDetailsControllerDetailBookType,
  ListDetailsControllerDetailFormatItem,
  ListDetailsControllerDetailOwnerItem,
  ListDetailsControllerDetailStatusItem,
  ListDetailsControllerDetailTab,
} from "@/shared/api/generated/model";

import { LIST_BOOK_SORT_DEFAULT, LIST_BOOK_SORT_OPTIONS } from "./list-book-sort";

const LIST_DETAIL_PAGE_SIZE = 24;

const LIST_DETAIL_VIEW_MODES = ["grid", "list"] as const;

export type ListDetailViewMode = (typeof LIST_DETAIL_VIEW_MODES)[number];

export const LIST_DETAIL_VALUES = {
  bookType: Object.values(ListDetailsControllerDetailBookType),
  format: Object.values(ListDetailsControllerDetailFormatItem),
  owner: Object.values(ListDetailsControllerDetailOwnerItem),
  status: Object.values(ListDetailsControllerDetailStatusItem),
  tab: Object.values(ListDetailsControllerDetailTab),
};

export type ListDetailStatus = ListDetailsControllerDetailStatusItem;

export const listDetailQueryParsers = {
  author: parseAsArrayOf(parseAsString).withDefault([]),
  bookType: parseAsStringLiteral(LIST_DETAIL_VALUES.bookType),
  format: parseAsArrayOf(parseAsStringLiteral(LIST_DETAIL_VALUES.format)).withDefault([]),
  genre: parseAsArrayOf(parseAsString).withDefault([]),
  inQueue: parseAsBoolean,
  isFavorite: parseAsBoolean,
  owner: parseAsArrayOf(parseAsStringLiteral(LIST_DETAIL_VALUES.owner)).withDefault([]),
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(LIST_BOOK_SORT_OPTIONS).withDefault(LIST_BOOK_SORT_DEFAULT),
  status: parseAsArrayOf(parseAsStringLiteral(LIST_DETAIL_VALUES.status)).withDefault([]),
  tab: parseAsStringLiteral(LIST_DETAIL_VALUES.tab).withDefault(ListDetailsControllerDetailTab.all),
  view: parseAsStringLiteral(LIST_DETAIL_VIEW_MODES).withDefault("grid"),
};

export type ListDetailBooksParams = Omit<ListDetailsControllerDetailParams, "pageNumber">;

export type ListDetailQueryState = inferParserType<typeof listDetailQueryParsers>;

export const LIST_DETAIL_FILTERS_RESET = {
  author: null,
  bookType: null,
  format: null,
  genre: null,
  inQueue: null,
  isFavorite: null,
  owner: null,
  status: null,
} satisfies Partial<Record<keyof ListDetailQueryState, null>>;

export type ListDetailEmptyReason = "filters" | "none" | "search" | "tab";

export function activeListDetailFilterCount(state: ListDetailQueryState): number {
  const conditions = [
    state.status.length > 0,
    state.owner.length > 0,
    state.format.length > 0,
    state.author.length > 0,
    state.genre.length > 0,
    state.bookType !== null,
    state.inQueue !== null,
    state.isFavorite !== null,
  ];
  return conditions.filter(Boolean).length;
}

export function hasActiveListDetailFilters(state: ListDetailQueryState): boolean {
  return activeListDetailFilterCount(state) > 0;
}

export function hasActiveListDetailSearch(state: ListDetailQueryState): boolean {
  return state.q.trim() !== "";
}

export function listDetailEmptyReason(state: ListDetailQueryState): ListDetailEmptyReason {
  if (hasActiveListDetailFilters(state)) return "filters";
  if (hasActiveListDetailSearch(state)) return "search";
  if (state.tab !== ListDetailsControllerDetailTab.all) return "tab";
  return "none";
}

export function toListDetailParams(state: ListDetailQueryState): ListDetailBooksParams {
  const search = state.q.trim();

  return {
    author: state.author,
    format: state.format,
    genre: state.genre,
    owner: state.owner,
    pageSize: LIST_DETAIL_PAGE_SIZE,
    sort: state.sort,
    status: state.status,
    tab: state.tab,
    ...(search === "" ? {} : { search }),
    ...(state.bookType === null ? {} : { bookType: state.bookType }),
    ...(state.inQueue === null ? {} : { inQueue: String(state.inQueue) }),
    ...(state.isFavorite === null ? {} : { isFavorite: String(state.isFavorite) }),
  };
}

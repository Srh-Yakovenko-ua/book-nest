import {
  type inferParserType,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type {
  PublishersControllerLibraryListParams,
  PublishersControllerLibraryQuickCountsParams,
} from "@/shared/api/generated/model";

import {
  PublishersControllerLibraryListFilter,
  PublishersControllerLibraryListGeography,
  PublishersControllerLibraryListOrder,
  PublishersControllerLibraryListSort,
  PublishersControllerLibraryListSource,
} from "@/shared/api/generated/model";

export const PUBLISHERS_PAGE_SIZE = 24;

export const PUBLISHERS_VIEW_MODES = ["grid", "list"] as const;
export type PublishersViewMode = (typeof PUBLISHERS_VIEW_MODES)[number];

export const PUBLISHERS_SORTS = [
  "books_desc",
  "books_asc",
  "read_desc",
  "read_asc",
  "to_buy_desc",
  "to_buy_asc",
  "rating_desc",
  "rating_asc",
  "recent_desc",
  "recent_asc",
  "name_asc",
  "name_desc",
] as const;
export type PublishersSort = (typeof PUBLISHERS_SORTS)[number];

export const PUBLISHERS_QUICK_FILTERS = [
  PublishersControllerLibraryListFilter.all,
  PublishersControllerLibraryListFilter.reading,
  PublishersControllerLibraryListFilter.read,
  PublishersControllerLibraryListFilter.to_buy,
  PublishersControllerLibraryListFilter.series,
] as const;
export type PublishersQuickFilter = (typeof PUBLISHERS_QUICK_FILTERS)[number];

export const PUBLISHERS_GEOGRAPHY_OPTIONS = [
  PublishersControllerLibraryListGeography.all,
  PublishersControllerLibraryListGeography.ua,
  PublishersControllerLibraryListGeography.foreign,
  PublishersControllerLibraryListGeography.unknown,
] as const;
export type PublishersGeography = (typeof PUBLISHERS_GEOGRAPHY_OPTIONS)[number];

export const PUBLISHERS_SOURCE_OPTIONS = [
  PublishersControllerLibraryListSource.all,
  PublishersControllerLibraryListSource.global,
  PublishersControllerLibraryListSource.custom,
] as const;
export type PublishersSource = (typeof PUBLISHERS_SOURCE_OPTIONS)[number];

export const PUBLISHERS_BOOLEAN_FILTERS = ["hasRatedBooks", "hasWantToRead", "hasQueue"] as const;
export type PublisherBooleanFilter = (typeof PUBLISHERS_BOOLEAN_FILTERS)[number];

export const PUBLISHERS_QUERY_DEFAULTS = {
  filter: PublishersControllerLibraryListFilter.all,
  geography: PublishersControllerLibraryListGeography.all,
  sort: "books_desc",
  source: PublishersControllerLibraryListSource.all,
  view: "grid",
} as const satisfies {
  filter: PublishersQuickFilter;
  geography: PublishersGeography;
  sort: PublishersSort;
  source: PublishersSource;
  view: PublishersViewMode;
};

type BackendSort = {
  order: PublishersControllerLibraryListOrder;
  sort: PublishersControllerLibraryListSort;
};

const { asc, desc } = PublishersControllerLibraryListOrder;
const backendField = PublishersControllerLibraryListSort;

const BACKEND_SORT_BY_SEMANTIC_SORT = {
  books_asc: { order: asc, sort: backendField.booksCount },
  books_desc: { order: desc, sort: backendField.booksCount },
  name_asc: { order: asc, sort: backendField.name },
  name_desc: { order: desc, sort: backendField.name },
  rating_asc: { order: asc, sort: backendField.averageRating },
  rating_desc: { order: desc, sort: backendField.averageRating },
  read_asc: { order: asc, sort: backendField.readCount },
  read_desc: { order: desc, sort: backendField.readCount },
  recent_asc: { order: asc, sort: backendField.lastBookAddedAt },
  recent_desc: { order: desc, sort: backendField.lastBookAddedAt },
  to_buy_asc: { order: asc, sort: backendField.wantToBuyCount },
  to_buy_desc: { order: desc, sort: backendField.wantToBuyCount },
} as const satisfies Record<PublishersSort, BackendSort>;

export const publisherQueryParsers = {
  filter: parseAsStringLiteral(PUBLISHERS_QUICK_FILTERS).withDefault(
    PUBLISHERS_QUERY_DEFAULTS.filter,
  ),
  geography: parseAsStringLiteral(PUBLISHERS_GEOGRAPHY_OPTIONS).withDefault(
    PUBLISHERS_QUERY_DEFAULTS.geography,
  ),
  hasQueue: parseAsBoolean,
  hasRatedBooks: parseAsBoolean,
  hasWantToRead: parseAsBoolean,
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(PUBLISHERS_SORTS).withDefault(PUBLISHERS_QUERY_DEFAULTS.sort),
  source: parseAsStringLiteral(PUBLISHERS_SOURCE_OPTIONS).withDefault(
    PUBLISHERS_QUERY_DEFAULTS.source,
  ),
  view: parseAsStringLiteral(PUBLISHERS_VIEW_MODES).withDefault(PUBLISHERS_QUERY_DEFAULTS.view),
};

export type PublisherQueryState = inferParserType<typeof publisherQueryParsers>;

export type PublishersAdvancedFilters = {
  geography: PublishersGeography;
  hasQueue: boolean;
  hasRatedBooks: boolean;
  hasWantToRead: boolean;
  source: PublishersSource;
};

export type PublishersListQuery = Omit<PublishersControllerLibraryListParams, "pageNumber">;

export const EMPTY_PUBLISHERS_ADVANCED_FILTERS: PublishersAdvancedFilters = {
  geography: PUBLISHERS_QUERY_DEFAULTS.geography,
  hasQueue: false,
  hasRatedBooks: false,
  hasWantToRead: false,
  source: PUBLISHERS_QUERY_DEFAULTS.source,
};

export const PUBLISHERS_FILTERS_RESET = {
  filter: null,
  geography: null,
  hasQueue: null,
  hasRatedBooks: null,
  hasWantToRead: null,
  source: null,
} satisfies Partial<Record<keyof PublisherQueryState, null>>;

export const PUBLISHERS_CLEAR_ALL = {
  ...PUBLISHERS_FILTERS_RESET,
  q: null,
} satisfies Partial<Record<keyof PublisherQueryState, null>>;

export function countActivePublisherAdvancedFilters(filters: PublishersAdvancedFilters): number {
  const flags = [
    filters.geography !== PUBLISHERS_QUERY_DEFAULTS.geography,
    filters.source !== PUBLISHERS_QUERY_DEFAULTS.source,
    ...PUBLISHERS_BOOLEAN_FILTERS.map((key) => filters[key]),
  ];
  return flags.filter(Boolean).length;
}

export function hasActivePublisherFilters(state: PublisherQueryState): boolean {
  return (
    state.filter !== PUBLISHERS_QUERY_DEFAULTS.filter ||
    countActivePublisherAdvancedFilters(toPublishersAdvancedFilters(state)) > 0
  );
}

export function hasActivePublisherSearch(state: PublisherQueryState): boolean {
  return state.q.trim() !== "";
}

export function toBackendPublishersSort(sort: PublishersSort): BackendSort {
  return BACKEND_SORT_BY_SEMANTIC_SORT[sort];
}

export function toPublishersAdvancedFilters(state: PublisherQueryState): PublishersAdvancedFilters {
  return {
    geography: state.geography,
    hasQueue: state.hasQueue === true,
    hasRatedBooks: state.hasRatedBooks === true,
    hasWantToRead: state.hasWantToRead === true,
    source: state.source,
  };
}

export function toPublishersAdvancedPatch(filters: PublishersAdvancedFilters) {
  return {
    geography: filters.geography === PUBLISHERS_QUERY_DEFAULTS.geography ? null : filters.geography,
    hasQueue: filters.hasQueue ? true : null,
    hasRatedBooks: filters.hasRatedBooks ? true : null,
    hasWantToRead: filters.hasWantToRead ? true : null,
    source: filters.source === PUBLISHERS_QUERY_DEFAULTS.source ? null : filters.source,
  };
}

export function toPublishersListQuery(state: PublisherQueryState): PublishersListQuery {
  const search = state.q.trim();
  const advanced = toPublishersAdvancedFilters(state);

  return {
    ...toBackendPublishersSort(state.sort),
    pageSize: PUBLISHERS_PAGE_SIZE,
    ...(search === "" ? {} : { search }),
    ...(state.filter === PUBLISHERS_QUERY_DEFAULTS.filter ? {} : { filter: state.filter }),
    ...(advanced.geography === PUBLISHERS_QUERY_DEFAULTS.geography
      ? {}
      : { geography: advanced.geography }),
    ...(advanced.source === PUBLISHERS_QUERY_DEFAULTS.source ? {} : { source: advanced.source }),
    ...(advanced.hasRatedBooks ? { hasRatedBooks: "true" } : {}),
    ...(advanced.hasWantToRead ? { hasWantToRead: "true" } : {}),
    ...(advanced.hasQueue ? { hasQueue: "true" } : {}),
  };
}

export function toPublishersQuickCountsParams(
  listQuery: PublishersListQuery,
): PublishersControllerLibraryQuickCountsParams {
  const {
    filter: _filter,
    locale: _locale,
    order: _order,
    pageSize: _pageSize,
    sort: _sort,
    ...countFilters
  } = listQuery;
  return countFilters;
}

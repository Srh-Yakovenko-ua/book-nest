import {
  type inferParserType,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";

import type { PublishersControllerLibraryListParams } from "@/shared/api/generated/model";

import {
  PublishersControllerLibraryListGeography,
  PublishersControllerLibraryListOrder,
  PublishersControllerLibraryListSort,
  PublishersControllerLibraryListSource,
} from "@/shared/api/generated/model";

export const PUBLISHERS_PAGE_SIZE = 24;

export const PUBLISHERS_SORT_DEFAULT = PublishersControllerLibraryListSort.booksCount;
export const PUBLISHERS_ORDER_DEFAULT = PublishersControllerLibraryListOrder.desc;
export const PUBLISHERS_GEOGRAPHY_DEFAULT = PublishersControllerLibraryListGeography.all;
export const PUBLISHERS_SOURCE_DEFAULT = PublishersControllerLibraryListSource.all;
export const PUBLISHERS_VIEW_DEFAULT = "grid";

export const PUBLISHERS_VIEW_MODES = ["grid", "list"] as const;
export type PublishersViewMode = (typeof PUBLISHERS_VIEW_MODES)[number];

export const PUBLISHERS_SORT_OPTIONS = Object.values(PublishersControllerLibraryListSort);
export const PUBLISHERS_ORDER_OPTIONS = Object.values(PublishersControllerLibraryListOrder);
export const PUBLISHERS_GEOGRAPHY_OPTIONS = Object.values(PublishersControllerLibraryListGeography);
export const PUBLISHERS_SOURCE_OPTIONS = Object.values(PublishersControllerLibraryListSource);

export const PUBLISHERS_BOOLEAN_FILTERS = ["hasBooksToBuy", "hasRatedBooks", "hasSeries"] as const;
export type PublisherBooleanFilter = (typeof PUBLISHERS_BOOLEAN_FILTERS)[number];

export const publisherQueryParsers = {
  geography: parseAsStringLiteral(PUBLISHERS_GEOGRAPHY_OPTIONS).withDefault(
    PUBLISHERS_GEOGRAPHY_DEFAULT,
  ),
  hasBooksToBuy: parseAsBoolean,
  hasRatedBooks: parseAsBoolean,
  hasSeries: parseAsBoolean,
  order: parseAsStringLiteral(PUBLISHERS_ORDER_OPTIONS).withDefault(PUBLISHERS_ORDER_DEFAULT),
  page: parseAsInteger.withDefault(1),
  search: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(PUBLISHERS_SORT_OPTIONS).withDefault(PUBLISHERS_SORT_DEFAULT),
  source: parseAsStringLiteral(PUBLISHERS_SOURCE_OPTIONS).withDefault(PUBLISHERS_SOURCE_DEFAULT),
  view: parseAsStringLiteral(PUBLISHERS_VIEW_MODES).withDefault(PUBLISHERS_VIEW_DEFAULT),
};

export type LibraryPublishersParams = PublishersControllerLibraryListParams;

export type PublisherQueryState = inferParserType<typeof publisherQueryParsers>;

export function hasActivePublisherFilters(state: PublisherQueryState): boolean {
  return (
    state.geography !== PUBLISHERS_GEOGRAPHY_DEFAULT ||
    state.source !== PUBLISHERS_SOURCE_DEFAULT ||
    state.hasBooksToBuy !== null ||
    state.hasRatedBooks !== null ||
    state.hasSeries !== null
  );
}

export function hasActivePublisherSearch(state: PublisherQueryState): boolean {
  return state.search.trim() !== "";
}

export function toLibraryPublishersParams(state: PublisherQueryState): LibraryPublishersParams {
  const search = state.search.trim();

  return {
    geography: state.geography,
    order: state.order,
    pageNumber: state.page,
    pageSize: PUBLISHERS_PAGE_SIZE,
    sort: state.sort,
    source: state.source,
    ...(search === "" ? {} : { search }),
    ...(state.hasBooksToBuy === null ? {} : { hasBooksToBuy: String(state.hasBooksToBuy) }),
    ...(state.hasRatedBooks === null ? {} : { hasRatedBooks: String(state.hasRatedBooks) }),
    ...(state.hasSeries === null ? {} : { hasSeries: String(state.hasSeries) }),
  };
}

export const PUBLISHERS_FILTERS_RESET = {
  geography: null,
  hasBooksToBuy: null,
  hasRatedBooks: null,
  hasSeries: null,
  page: null,
  source: null,
} satisfies Partial<Record<keyof PublisherQueryState, null>>;

"use client";

import type { TagColor, TagQuickFilter, TagSort, TagType } from "@app/shared";

import { useQueryStates } from "nuqs";

import type { TagsCatalogParams, TagsFacetsParams, TagsQueryState } from "./tags-query";

import {
  clearAllTagsFiltersPatch,
  committedTagSearch,
  hasActiveTagsFilters,
  hasContextualTagCriteria,
  TAGS_QUERY,
  TAGS_QUERY_PARSERS,
  toArrayPatch,
  toggleArrayValue,
  toTagsCatalogParams,
  toTagSearchPatch,
  toTagsFacetsParams,
} from "./tags-query";

export type TagsAdvancedFiltersValue = {
  color: TagColor[];
  type: TagType[];
};

export type UseTagQueryResult = {
  catalogParams: TagsCatalogParams;
  clearAll: () => void;
  clearSearch: () => void;
  facetsParams: TagsFacetsParams;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  hasContextualCriteria: boolean;
  setAdvancedFilters: (filters: TagsAdvancedFiltersValue) => void;
  setFilter: (filter: TagQuickFilter) => void;
  setSearch: (query: string) => void;
  setSort: (sort: TagSort) => void;
  state: TagsQueryState;
  toggleColor: (color: TagColor) => void;
  toggleType: (type: TagType) => void;
};

export function useTagQuery(): UseTagQueryResult {
  const [state, setState] = useQueryStates(TAGS_QUERY_PARSERS, { history: TAGS_QUERY.history });

  return {
    catalogParams: toTagsCatalogParams(state),
    clearAll: () => void setState(clearAllTagsFiltersPatch()),
    clearSearch: () => void setState({ q: null }),
    facetsParams: toTagsFacetsParams(state),
    hasActiveFilters: hasActiveTagsFilters(state),
    hasActiveSearch: committedTagSearch(state.q) !== "",
    hasContextualCriteria: hasContextualTagCriteria(state),
    setAdvancedFilters: ({ color, type }) =>
      void setState({ color: toArrayPatch(color), type: toArrayPatch(type) }),
    setFilter: (filter) => void setState({ filter }),
    setSearch: (query) => void setState(toTagSearchPatch(query)),
    setSort: (sort) => void setState({ sort }),
    state,
    toggleColor: (color) =>
      void setState({ color: toArrayPatch(toggleArrayValue(state.color, color)) }),
    toggleType: (type) => void setState({ type: toArrayPatch(toggleArrayValue(state.type, type)) }),
  };
}

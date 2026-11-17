"use client";

import type { BookCharacterImportance, BookCharacterSummaryQuery } from "@app/shared";

import { useQueryStates } from "nuqs";

import type { BookCharactersControllerListParams } from "@/shared/api/generated/model";

import type {
  CharactersRosterFilter,
  CharactersRosterSort,
  CharactersRosterState,
} from "./characters-roster-query";

import {
  canonicalRosterImportance,
  CHARACTERS_ROSTER_RESET,
  charactersRosterParsers,
  hasActiveRosterFilters,
  hasActiveRosterSearch,
  toBookCharactersListParams,
} from "./characters-roster-query";

export type UseCharactersRosterQueryResult = {
  clearSearch: () => void;
  clearSearchAndFilters: () => void;
  hasActiveCriteria: boolean;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: BookCharactersControllerListParams;
  setFilter: (value: CharactersRosterFilter) => void;
  setImportance: (value: readonly BookCharacterImportance[]) => void;
  setSearch: (value: string) => void;
  setSort: (value: CharactersRosterSort) => void;
  state: CharactersRosterState;
};

export function useCharactersRosterQuery(
  bookContext: BookCharacterSummaryQuery,
): UseCharactersRosterQueryResult {
  const [state, setState] = useQueryStates(charactersRosterParsers);
  const hasActiveFilters = hasActiveRosterFilters(state);
  const hasActiveSearch = hasActiveRosterSearch(state);

  return {
    clearSearch: () => void setState(CHARACTERS_ROSTER_RESET.search),
    clearSearchAndFilters: () =>
      void setState({ ...CHARACTERS_ROSTER_RESET.search, ...CHARACTERS_ROSTER_RESET.filters }),
    hasActiveCriteria: hasActiveFilters || hasActiveSearch,
    hasActiveFilters,
    hasActiveSearch,
    listParams: toBookCharactersListParams(state, bookContext),
    setFilter: (characterFilter) => void setState({ characterFilter }),
    setImportance: (importance) =>
      void setState({ characterImportance: canonicalRosterImportance(importance) }),
    setSearch: (characterSearch) => void setState({ characterSearch }),
    setSort: (characterSort) => void setState({ characterSort }),
    state,
  };
}

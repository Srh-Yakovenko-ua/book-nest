"use client";

import { useQueryStates } from "nuqs";

import type { BookCharactersControllerListParams } from "@/shared/api/generated/model";

import type { CharactersRosterSort, CharactersRosterState } from "./characters-roster-query";

import {
  CHARACTERS_ROSTER_RESET,
  charactersRosterParsers,
  hasActiveRosterSearch,
  toBookCharactersListParams,
} from "./characters-roster-query";

export type UseCharactersRosterQueryResult = {
  clearSearch: () => void;
  hasActiveSearch: boolean;
  listParams: BookCharactersControllerListParams;
  setPage: (value: number) => void;
  setSearch: (value: string) => void;
  setSort: (value: CharactersRosterSort) => void;
  state: CharactersRosterState;
};

export function useCharactersRosterQuery(): UseCharactersRosterQueryResult {
  const [state, setState] = useQueryStates(charactersRosterParsers);

  return {
    clearSearch: () => void setState(CHARACTERS_ROSTER_RESET),
    hasActiveSearch: hasActiveRosterSearch(state),
    listParams: toBookCharactersListParams(state),
    setPage: (characterPage) => void setState({ characterPage }),
    setSearch: (characterSearch) => void setState({ characterPage: null, characterSearch }),
    setSort: (characterSort) => void setState({ characterSort }),
    state,
  };
}

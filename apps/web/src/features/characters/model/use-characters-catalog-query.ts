"use client";

import { useQueryStates } from "nuqs";

import type { CharactersControllerListParams } from "@/shared/api/generated/model";

import type {
  CharactersCatalogQuickFilter,
  CharactersCatalogState,
} from "./characters-catalog-query";

import {
  CHARACTERS_CATALOG_ADVANCED_RESET,
  CHARACTERS_CATALOG_RESET,
  charactersCatalogParsers,
  countActiveAdvancedFilters,
  hasActiveCatalogFilters,
  toCharactersCatalogParams,
} from "./characters-catalog-query";

export type CharactersCatalogAdvancedPatch = Partial<
  Pick<
    CharactersCatalogState,
    "attitude" | "gender" | "groupId" | "importance" | "role" | "seriesId"
  >
>;

export type UseCharactersCatalogQueryResult = {
  activeAdvancedCount: number;
  applyAdvanced: (patch: CharactersCatalogAdvancedPatch) => void;
  clearAll: () => void;
  hasActiveFilters: boolean;
  listParams: CharactersControllerListParams;
  setFilter: (value: CharactersCatalogQuickFilter) => void;
  setSearch: (value: string) => void;
  setSort: (value: CharactersCatalogState["sort"]) => void;
  setView: (value: CharactersCatalogState["view"]) => void;
  state: CharactersCatalogState;
};

export function useCharactersCatalogQuery(): UseCharactersCatalogQueryResult {
  const [state, setState] = useQueryStates(charactersCatalogParsers);

  return {
    activeAdvancedCount: countActiveAdvancedFilters(state),
    applyAdvanced: (patch) => void setState({ ...CHARACTERS_CATALOG_ADVANCED_RESET, ...patch }),
    clearAll: () => void setState(CHARACTERS_CATALOG_RESET),
    hasActiveFilters: hasActiveCatalogFilters(state),
    listParams: toCharactersCatalogParams(state),
    setFilter: (filter) => void setState({ filter }),
    setSearch: (q) => void setState({ q }),
    setSort: (sort) => void setState({ sort }),
    setView: (view) => void setState({ view }),
    state,
  };
}

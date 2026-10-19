"use client";

import type { RelationshipCategory } from "@app/shared";

import { useQueryStates } from "nuqs";

import type {
  RelationshipAdvancedFilters,
  RelationshipListCriteria,
  RelationshipListQueryState,
  RelationshipListSort,
} from "./relationship-list-query";
import type { RelationshipScope } from "./relationship-scope";

import {
  hasActiveRelationshipCriteria,
  hasRelationshipListState,
  isRelationshipSearchTooShort,
  RELATIONSHIP_LIST_PARSERS,
  RELATIONSHIP_LIST_RESET,
  toRelationshipListCriteria,
  toScopedRelationshipListState,
} from "./relationship-list-query";

export type UseRelationshipListQueryResult = {
  clearAll: () => void;
  criteria: RelationshipListCriteria;
  hasActiveCriteria: boolean;
  hasListState: boolean;
  isSearchTooShort: boolean;
  setAdvancedFilters: (filters: RelationshipAdvancedFilters) => void;
  setCategories: (categories: RelationshipCategory[]) => void;
  setSearch: (query: string) => void;
  setSort: (sort: RelationshipListSort) => void;
  state: RelationshipListQueryState;
};

export function useRelationshipListQuery(scope: RelationshipScope): UseRelationshipListQueryResult {
  const [urlState, setState] = useQueryStates(RELATIONSHIP_LIST_PARSERS);
  const state = toScopedRelationshipListState({ scope, state: urlState });

  return {
    clearAll: () => void setState(RELATIONSHIP_LIST_RESET.all),
    criteria: toRelationshipListCriteria(state),
    hasActiveCriteria: hasActiveRelationshipCriteria(state),
    hasListState: hasRelationshipListState(state),
    isSearchTooShort: isRelationshipSearchTooShort(state.relQ),
    setAdvancedFilters: (filters) => void setState(filters),
    setCategories: (relCat) => void setState({ relCat }),
    setSearch: (relQ) => void setState({ relQ }),
    setSort: (relSort) => void setState({ relSort }),
    state,
  };
}

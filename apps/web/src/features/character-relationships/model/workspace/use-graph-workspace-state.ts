"use client";

import type { Nullable, RelationshipCategory, RelationshipType } from "@app/shared";

import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect, useRef } from "react";

import type {
  GraphWorkspaceParams,
  GraphWorkspaceView,
  NetworkGrouping,
} from "./graph-workspace-params";

import {
  canonicalizeGraphWorkspaceParams,
  GRAPH_WORKSPACE_FILTERS_RESET,
  graphWorkspaceParsers,
  needsGraphWorkspaceCanonicalReplace,
  normalizeGraphWorkspaceFilters,
} from "./graph-workspace-params";

const HISTORY = {
  push: { history: "push" },
  replace: { history: "replace" },
} as const;

export type GraphWorkspaceState = {
  actions: GraphWorkspaceActions;
  params: GraphWorkspaceParams;
};

type GraphWorkspaceActions = {
  chooseCharacter: (characterId: string) => void;
  clearCharacter: () => void;
  closePath: () => void;
  exploreFromPath: (characterId: string) => void;
  makeCenter: (characterId: string) => void;
  openPath: (fromId: Nullable<string>) => void;
  resetFilters: () => void;
  setDepth: (depth: number) => void;
  setFilters: (filters: { categories: RelationshipCategory[]; types: RelationshipType[] }) => void;
  setGenerations: (generations: { treeDown: number; treeUp: number }) => void;
  setNetworkGroup: (grouping: NetworkGrouping) => void;
  setPathEndpoints: (endpoints: { from: Nullable<string>; to: Nullable<string> }) => void;
  setView: (view: GraphWorkspaceView) => void;
};

export function useGraphWorkspaceState(): GraphWorkspaceState {
  const [rawParams, setParams] = useQueryStates(graphWorkspaceParsers);
  const search = useSearchParams();
  const params = canonicalizeGraphWorkspaceParams(rawParams);
  const searchString = search.toString();
  const replacedSearch = useRef<Nullable<string>>(null);

  useEffect(() => {
    const canonical = canonicalizeGraphWorkspaceParams(rawParams);
    const currentSearch = new URLSearchParams(searchString);
    if (!needsGraphWorkspaceCanonicalReplace({ canonical, search: currentSearch })) {
      replacedSearch.current = null;
      return;
    }
    if (replacedSearch.current === searchString) return;
    replacedSearch.current = searchString;
    void setParams(canonical, HISTORY.replace);
  }, [rawParams, searchString, setParams]);

  const actions: GraphWorkspaceActions = {
    chooseCharacter: (characterId) => void setParams({ characterId }, HISTORY.push),
    clearCharacter: () => void setParams({ characterId: null }, HISTORY.push),
    closePath: () => void setParams({ from: null, path: false, to: null }, HISTORY.replace),
    exploreFromPath: (characterId) =>
      void setParams(
        { characterId, from: null, path: false, to: null, view: "person" },
        HISTORY.push,
      ),
    makeCenter: (characterId) =>
      void setParams(
        { characterId, view: params.view === "network" ? "person" : params.view },
        HISTORY.push,
      ),
    openPath: (fromId) => void setParams({ from: fromId, path: true, to: null }, HISTORY.push),
    resetFilters: () => void setParams(GRAPH_WORKSPACE_FILTERS_RESET, HISTORY.replace),
    setDepth: (depth) => void setParams({ depth }, HISTORY.replace),
    setFilters: (filters) =>
      void setParams(normalizeGraphWorkspaceFilters(filters), HISTORY.replace),
    setGenerations: (generations) => void setParams(generations, HISTORY.replace),
    setNetworkGroup: (networkGroup) => void setParams({ networkGroup }, HISTORY.replace),
    setPathEndpoints: (endpoints) => void setParams(endpoints, HISTORY.replace),
    setView: (view) => void setParams({ view }, HISTORY.push),
  };

  return { actions, params };
}

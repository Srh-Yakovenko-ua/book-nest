"use client";

import type { Nullable } from "@app/shared";
import type { Options } from "nuqs";

import { useQueryStates } from "nuqs";

import type {
  GoalsListParams,
  GoalsQueryState,
  GoalsSort,
  GoalsStatus,
  GoalsViewMode,
} from "./goals-query";

import { GOALS_QUERY_PARSERS, toGoalsListParams } from "./goals-query";

export type UseGoalsQueryResult = {
  hasStatusFilter: boolean;
  listParams: GoalsListParams;
  setSort: (value: GoalsSort) => void;
  setStatus: (value: Nullable<GoalsStatus>) => void;
  setView: (value: GoalsViewMode) => void;
  state: GoalsQueryState;
};

const GOALS_URL_OPTIONS = { history: "push" } as const satisfies Options;

export function useGoalsQuery(): UseGoalsQueryResult {
  const [state, setState] = useQueryStates(GOALS_QUERY_PARSERS, GOALS_URL_OPTIONS);

  return {
    hasStatusFilter: state.status !== null,
    listParams: toGoalsListParams(state),
    setSort: (sort) => void setState({ sort }),
    setStatus: (status) => void setState({ status }),
    setView: (view) => void setState({ view }),
    state,
  };
}

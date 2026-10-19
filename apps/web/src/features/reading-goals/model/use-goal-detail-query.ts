"use client";

import type { Nullable } from "@app/shared";
import type { Options } from "nuqs";

import { useQueryStates } from "nuqs";

import type {
  GoalActivityType,
  GoalBooksScope,
  GoalDetailSection,
  GoalDetailTab,
} from "./goal-detail-query";

import {
  GOAL_DETAIL_QUERY_PARSERS,
  toGoalDetailSection,
  toGoalDetailTabPatch,
} from "./goal-detail-query";

export type UseGoalDetailQueryResult = {
  section: GoalDetailSection;
  setActivityType: (value: Nullable<GoalActivityType>) => void;
  setScope: (value: GoalBooksScope) => void;
  setTab: (value: GoalDetailTab) => void;
};

const GOAL_DETAIL_URL_OPTIONS = { history: "push" } as const satisfies Options;

export function useGoalDetailQuery(): UseGoalDetailQueryResult {
  const [state, setState] = useQueryStates(GOAL_DETAIL_QUERY_PARSERS, GOAL_DETAIL_URL_OPTIONS);

  return {
    section: toGoalDetailSection(state),
    setActivityType: (activityType) => void setState({ activityType }),
    setScope: (scope) => void setState({ scope }),
    setTab: (tab) => void setState(toGoalDetailTabPatch(tab)),
  };
}

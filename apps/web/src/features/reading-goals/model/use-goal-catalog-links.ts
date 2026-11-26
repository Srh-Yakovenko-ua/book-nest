"use client";

import { useQueryStates } from "nuqs";

import {
  GOAL_CATALOG_RETURN_PARSERS,
  toGoalDetailHref,
  toGoalsCatalogHref,
} from "./goal-catalog-href";
import { GOALS_QUERY_PARSERS } from "./goals-query";

export function useGoalDetailHref(): (goalId: string) => string {
  const [catalog] = useQueryStates(GOALS_QUERY_PARSERS);

  return (goalId) => toGoalDetailHref({ catalog, goalId });
}

export function useGoalsCatalogHref(): string {
  const [{ catalog }] = useQueryStates(GOAL_CATALOG_RETURN_PARSERS);

  return toGoalsCatalogHref(catalog);
}

import type { Nullable } from "@app/shared";

import { createLoader, createSerializer, parseAsString } from "nuqs/server";

import type { GoalsQueryState } from "./goals-query";

import { GOALS_QUERY_PARSERS } from "./goals-query";

export const GOAL_CATALOG_RETURN_PARSERS = {
  catalog: parseAsString,
};

const loadCatalogQuery = createLoader(GOALS_QUERY_PARSERS);
const serializeCatalogQuery = createSerializer(GOALS_QUERY_PARSERS);
const serializeCatalogReturn = createSerializer(GOAL_CATALOG_RETURN_PARSERS);

export function toGoalDetailHref({
  catalog,
  goalId,
}: {
  catalog: GoalsQueryState;
  goalId: string;
}): string {
  const catalogQuery = new URLSearchParams(serializeCatalogQuery(catalog)).toString();

  return serializeCatalogReturn(`/goals/${goalId}`, {
    catalog: catalogQuery === "" ? null : catalogQuery,
  });
}

export function toGoalsCatalogHref(catalog: Nullable<string>): string {
  if (catalog === null) return "/goals";
  return serializeCatalogQuery("/goals", loadCatalogQuery(catalog));
}

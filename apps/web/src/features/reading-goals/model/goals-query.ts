import { READING_GOAL_PAGE_SIZE } from "@app/shared";
import { type inferParserType, parseAsStringLiteral } from "nuqs/server";

import type { ReadingGoalsControllerListParams } from "@/shared/api/generated/model";

import {
  ReadingGoalsControllerListSort,
  ReadingGoalsControllerListStatus,
} from "@/shared/api/generated/model";

export const GOALS_QUERY = {
  sortDefault: ReadingGoalsControllerListSort.created_desc,
  sortOptions: Object.values(ReadingGoalsControllerListSort),
  statusOptions: Object.values(ReadingGoalsControllerListStatus),
  viewDefault: "grid",
  viewOptions: ["grid", "list"],
} as const;

export const GOALS_QUERY_PARSERS = {
  sort: parseAsStringLiteral(GOALS_QUERY.sortOptions).withDefault(GOALS_QUERY.sortDefault),
  status: parseAsStringLiteral(GOALS_QUERY.statusOptions),
  view: parseAsStringLiteral(GOALS_QUERY.viewOptions).withDefault(GOALS_QUERY.viewDefault),
};

export type GoalsListParams = Omit<ReadingGoalsControllerListParams, "cursor">;

export type GoalsQueryState = inferParserType<typeof GOALS_QUERY_PARSERS>;

export type GoalsSort = ReadingGoalsControllerListSort;

export type GoalsStatus = ReadingGoalsControllerListStatus;

export type GoalsViewMode = (typeof GOALS_QUERY.viewOptions)[number];

export function toGoalsListParams(state: GoalsQueryState): GoalsListParams {
  return {
    limit: READING_GOAL_PAGE_SIZE.default,
    sort: state.sort,
    ...(state.status === null ? {} : { status: state.status }),
  };
}

import type { Nullable } from "@app/shared";

import { type inferParserType, parseAsStringLiteral } from "nuqs/server";

import { assertNever } from "@/lib/assert-never";
import {
  ReadingGoalsControllerListActivityType,
  ReadingGoalsControllerListBooksScope,
} from "@/shared/api/generated/model";

export const GOAL_DETAIL_QUERY = {
  activityTypeOptions: Object.values(ReadingGoalsControllerListActivityType),
  scopeDefault: ReadingGoalsControllerListBooksScope.all,
  scopeOptions: Object.values(ReadingGoalsControllerListBooksScope),
  tabDefault: "overview",
  tabOptions: ["overview", "books", "activity"],
} as const;

export const GOAL_DETAIL_QUERY_PARSERS = {
  activityType: parseAsStringLiteral(GOAL_DETAIL_QUERY.activityTypeOptions),
  scope: parseAsStringLiteral(GOAL_DETAIL_QUERY.scopeOptions).withDefault(
    GOAL_DETAIL_QUERY.scopeDefault,
  ),
  tab: parseAsStringLiteral(GOAL_DETAIL_QUERY.tabOptions).withDefault(GOAL_DETAIL_QUERY.tabDefault),
};

export type GoalActivityType = ReadingGoalsControllerListActivityType;

export type GoalBooksScope = ReadingGoalsControllerListBooksScope;

export type GoalDetailQueryState = inferParserType<typeof GOAL_DETAIL_QUERY_PARSERS>;

export type GoalDetailSection =
  | { activityType: Nullable<GoalActivityType>; tab: "activity" }
  | { scope: GoalBooksScope; tab: "books" }
  | { tab: "overview" };

export type GoalDetailTab = (typeof GOAL_DETAIL_QUERY.tabOptions)[number];

type GoalDetailQueryPatch = {
  [Key in keyof GoalDetailQueryState]?: Nullable<GoalDetailQueryState[Key]>;
};

const GOAL_DETAIL_TAB_RESET = {
  activity: { scope: null },
  books: { activityType: null },
  overview: { activityType: null, scope: null },
} as const satisfies Record<GoalDetailTab, GoalDetailQueryPatch>;

export function toGoalDetailSection(state: GoalDetailQueryState): GoalDetailSection {
  switch (state.tab) {
    case "activity":
      return { activityType: state.activityType, tab: "activity" };
    case "books":
      return { scope: state.scope, tab: "books" };
    case "overview":
      return { tab: "overview" };
    default:
      return assertNever(state.tab);
  }
}

export function toGoalDetailTab(value: string): GoalDetailTab {
  return GOAL_DETAIL_QUERY.tabOptions.find((tab) => tab === value) ?? GOAL_DETAIL_QUERY.tabDefault;
}

export function toGoalDetailTabPatch(tab: GoalDetailTab): GoalDetailQueryPatch {
  return { ...GOAL_DETAIL_TAB_RESET[tab], tab };
}

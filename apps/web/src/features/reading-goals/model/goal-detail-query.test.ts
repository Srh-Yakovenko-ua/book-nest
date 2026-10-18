import { createLoader, createSerializer } from "nuqs/server";
import { describe, expect, it } from "vitest";

import type { GoalDetailQueryState, GoalDetailTab } from "./goal-detail-query";

import {
  GOAL_DETAIL_QUERY,
  GOAL_DETAIL_QUERY_PARSERS,
  toGoalDetailSection,
  toGoalDetailTab,
  toGoalDetailTabPatch,
} from "./goal-detail-query";

const loadGoalDetailQuery = createLoader(GOAL_DETAIL_QUERY_PARSERS);
const serializeGoalDetailQuery = createSerializer(GOAL_DETAIL_QUERY_PARSERS);

const DEFAULT_STATE: GoalDetailQueryState = { activityType: null, scope: "all", tab: "overview" };
const STALE_PARAMS = "scope=counted&activityType=book_counted";

function sectionFrom(search: string) {
  return toGoalDetailSection(stateFrom(search));
}

function stateFrom(search: string): GoalDetailQueryState {
  return loadGoalDetailQuery(new URLSearchParams(search));
}

function urlAfterTabChange(search: string, tab: GoalDetailTab): string {
  const serialized = serializeGoalDetailQuery(`?${search}`, toGoalDetailTabPatch(tab));
  return new URLSearchParams(serialized).toString();
}

describe("goal detail URL state", () => {
  it("opens the overview with the whole book scope for an empty URL", () => {
    expect(stateFrom("")).toEqual(DEFAULT_STATE);
    expect(toGoalDetailSection(DEFAULT_STATE)).toEqual({ tab: "overview" });
  });

  it("reads a books scope and an activity type the server supports", () => {
    expect(stateFrom("tab=books&scope=remaining").scope).toBe("remaining");
    expect(stateFrom("tab=activity&activityType=deadline_changed").activityType).toBe(
      "deadline_changed",
    );
  });

  it("falls back for values the server does not know", () => {
    expect(stateFrom("tab=stats&scope=everything&activityType=book_liked")).toEqual(DEFAULT_STATE);
    expect(toGoalDetailTab("stats")).toBe("overview");
  });

  it("hands each tab only the params that belong to it", () => {
    expect(sectionFrom(`tab=overview&${STALE_PARAMS}`)).toEqual({ tab: "overview" });
    expect(sectionFrom(`tab=books&${STALE_PARAMS}`)).toEqual({ scope: "counted", tab: "books" });
    expect(sectionFrom(`tab=activity&${STALE_PARAMS}`)).toEqual({
      activityType: "book_counted",
      tab: "activity",
    });
  });

  it("drops the params of the tab being left", () => {
    expect(urlAfterTabChange("tab=books&scope=counted", "activity")).toBe("tab=activity");
    expect(urlAfterTabChange("tab=activity&activityType=goal_renamed", "books")).toBe("tab=books");
    expect(urlAfterTabChange(`tab=activity&${STALE_PARAMS}`, "overview")).toBe("");
  });

  it("offers the three tabs, the three book scopes and all nine activity types", () => {
    expect(GOAL_DETAIL_QUERY.tabOptions).toEqual(["overview", "books", "activity"]);
    expect(GOAL_DETAIL_QUERY.scopeOptions).toEqual(["counted", "remaining", "all"]);
    expect(GOAL_DETAIL_QUERY.activityTypeOptions).toHaveLength(9);
  });
});

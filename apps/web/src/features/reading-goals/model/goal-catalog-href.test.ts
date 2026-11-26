import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GoalsQueryState } from "./goals-query";

import { toGoalDetailHref, toGoalsCatalogHref } from "./goal-catalog-href";

const DEFAULT_STATE: GoalsQueryState = { sort: "created_desc", status: null, view: "grid" };

function catalogParamOf(href: string): Nullable<string> {
  return new URL(href, "http://localhost").searchParams.get("catalog");
}

describe("goal detail href", () => {
  it("links a default catalog to the bare detail path", () => {
    expect(toGoalDetailHref({ catalog: DEFAULT_STATE, goalId: "goal-1" })).toBe("/goals/goal-1");
  });

  it("carries status, sort and view in one catalog param without the defaults", () => {
    const href = toGoalDetailHref({
      catalog: { sort: "risk_desc", status: "completed", view: "list" },
      goalId: "goal-1",
    });

    expect(new URL(href, "http://localhost").pathname).toBe("/goals/goal-1");
    expect(catalogParamOf(href)).toBe("sort=risk_desc&status=completed&view=list");
  });

  it("leaves the default sort and view out of the catalog param", () => {
    const href = toGoalDetailHref({
      catalog: { ...DEFAULT_STATE, status: "archived" },
      goalId: "goal-1",
    });

    expect(catalogParamOf(href)).toBe("status=archived");
  });
});

describe("goals catalog href", () => {
  it("opens the default catalog when the detail was opened directly", () => {
    expect(toGoalsCatalogHref(null)).toBe("/goals");
  });

  it("restores the catalog the reader came from", () => {
    const href = toGoalDetailHref({
      catalog: { sort: "risk_desc", status: "completed", view: "list" },
      goalId: "goal-1",
    });

    expect(toGoalsCatalogHref(catalogParamOf(href))).toBe(
      "/goals?sort=risk_desc&status=completed&view=list",
    );
  });

  it("falls back to the defaults for values the catalog does not know", () => {
    expect(toGoalsCatalogHref("status=bogus&sort=sideways&view=tiles")).toBe("/goals");
  });

  it("drops keys that are not part of the catalog state", () => {
    expect(toGoalsCatalogHref("status=expired&returnTo=lists")).toBe("/goals?status=expired");
  });
});

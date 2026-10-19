import { createLoader, createSerializer } from "nuqs/server";
import { describe, expect, it } from "vitest";

import type { GoalsQueryState } from "./goals-query";

import { GOALS_QUERY, GOALS_QUERY_PARSERS, toGoalsListParams } from "./goals-query";

const loadGoalsQuery = createLoader(GOALS_QUERY_PARSERS);
const serializeGoalsQuery = createSerializer(GOALS_QUERY_PARSERS);

const DEFAULT_STATE: GoalsQueryState = { sort: "created_desc", status: null, view: "grid" };

function stateFrom(search: string): GoalsQueryState {
  return loadGoalsQuery(new URLSearchParams(search));
}

describe("goals catalog URL state", () => {
  it("falls back to the canonical defaults for an empty URL", () => {
    expect(stateFrom("")).toEqual(DEFAULT_STATE);
  });

  it("reads one status, a server sort and the list view", () => {
    expect(stateFrom("status=expired&sort=risk_desc&view=list")).toEqual({
      sort: "risk_desc",
      status: "expired",
      view: "list",
    });
  });

  it("falls back to the defaults for values the server does not know", () => {
    expect(stateFrom("status=done&sort=title_asc&view=table")).toEqual(DEFAULT_STATE);
  });

  it("refuses several statuses at once", () => {
    expect(stateFrom("status=active,completed").status).toBeNull();
  });

  it("offers exactly the seven server sorts and the four statuses", () => {
    expect(GOALS_QUERY.sortOptions).toEqual([
      "created_desc",
      "created_asc",
      "deadline_asc",
      "deadline_desc",
      "progress_desc",
      "progress_asc",
      "risk_desc",
    ]);
    expect(GOALS_QUERY.statusOptions).toEqual(["active", "completed", "expired", "archived"]);
  });

  it("keeps the canonical defaults out of the URL", () => {
    expect(serializeGoalsQuery(DEFAULT_STATE)).toBe("");

    const url = new URLSearchParams(
      serializeGoalsQuery({ sort: "deadline_asc", status: "archived", view: "list" }),
    );
    expect(url.get("sort")).toBe("deadline_asc");
    expect(url.get("status")).toBe("archived");
    expect(url.get("view")).toBe("list");
  });
});

describe("toGoalsListParams", () => {
  it("asks for 20 goals sorted by the chosen order and leaves an absent status out", () => {
    expect(toGoalsListParams(DEFAULT_STATE)).toEqual({ limit: 20, sort: "created_desc" });
  });

  it("passes a chosen status through and never carries the view", () => {
    const params = toGoalsListParams({ sort: "progress_asc", status: "active", view: "list" });

    expect(params).toEqual({ limit: 20, sort: "progress_asc", status: "active" });
    expect(params).not.toHaveProperty("view");
    expect(params).not.toHaveProperty("cursor");
  });
});

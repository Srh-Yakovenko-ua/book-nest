import { describe, expect, it } from "vitest";

import type { ListDetailQueryState } from "./list-detail-query";

import {
  activeListDetailFilterCount,
  listDetailEmptyReason,
  toListDetailParams,
} from "./list-detail-query";
import { activeListDetailTab, listDetailStatusPatch, listDetailTabPatch } from "./list-detail-tabs";

function makeState(overrides: Partial<ListDetailQueryState> = {}): ListDetailQueryState {
  return {
    author: [],
    bookType: null,
    format: [],
    genre: [],
    inQueue: null,
    isFavorite: null,
    owner: [],
    q: "",
    sort: "position",
    status: [],
    tab: "all",
    view: "grid",
    ...overrides,
  };
}

describe("activeListDetailFilterCount", () => {
  it("counts a multiselect with three values as one condition", () => {
    const state = makeState({ status: ["reading", "paused", "finished"] });
    expect(activeListDetailFilterCount(state)).toBe(1);
  });

  it("counts every filled group once", () => {
    const state = makeState({
      author: ["author-1"],
      bookType: "solo",
      format: ["paper", "ebook"],
      genre: ["fantasy"],
      inQueue: true,
      isFavorite: true,
      owner: ["owned"],
      status: ["reading"],
    });
    expect(activeListDetailFilterCount(state)).toBe(8);
  });

  it("ignores the search query, the tab, the sort and the view mode", () => {
    const state = makeState({ q: "толкін", sort: "title_asc", tab: "finished", view: "list" });
    expect(activeListDetailFilterCount(state)).toBe(0);
  });
});

describe("list detail tabs", () => {
  it("highlights a tab only while no explicit status is selected", () => {
    expect(activeListDetailTab(makeState({ tab: "finished" }))).toBe("finished");
    expect(activeListDetailTab(makeState({ status: ["reading"], tab: "finished" }))).toBeNull();
  });

  it("clears the statuses when a tab is picked", () => {
    expect(listDetailTabPatch("finished")).toEqual({ status: null, tab: "finished" });
    expect(listDetailTabPatch("all")).toEqual({ status: null, tab: null });
  });

  it("returns the tab to all when explicit statuses are picked", () => {
    expect(listDetailStatusPatch(["finished", "dnf"])).toEqual({
      status: ["finished", "dnf"],
      tab: null,
    });
  });

  it("leaves the tab alone when the statuses are cleared", () => {
    expect(listDetailStatusPatch([])).toEqual({ status: null });
  });
});

describe("listDetailEmptyReason", () => {
  it("blames the filters before the search", () => {
    expect(listDetailEmptyReason(makeState({ genre: ["fantasy"], q: "толкін" }))).toBe("filters");
  });

  it("blames the search when no filter is active", () => {
    expect(listDetailEmptyReason(makeState({ q: "толкін" }))).toBe("search");
  });

  it("blames the tab when nothing else is active", () => {
    expect(listDetailEmptyReason(makeState({ tab: "finished" }))).toBe("tab");
  });

  it("blames nothing on an untouched query", () => {
    expect(listDetailEmptyReason(makeState())).toBe("none");
  });
});

describe("toListDetailParams", () => {
  it("keeps the page size and drops the untouched conditions", () => {
    expect(toListDetailParams(makeState())).toEqual({
      author: [],
      format: [],
      genre: [],
      owner: [],
      pageSize: 24,
      sort: "position",
      status: [],
      tab: "all",
    });
  });

  it("serialises the tri-state and boolean conditions as strings", () => {
    const params = toListDetailParams(
      makeState({ inQueue: false, isFavorite: true, q: "  толкін  " }),
    );
    expect(params.inQueue).toBe("false");
    expect(params.isFavorite).toBe("true");
    expect(params.search).toBe("толкін");
  });
});

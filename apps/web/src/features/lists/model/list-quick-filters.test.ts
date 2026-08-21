import { describe, expect, it } from "vitest";

import {
  activeListQuickFilter,
  listDetailStatusPatch,
  listQuickFilterPatch,
} from "./list-quick-filters";
import { makeListDetailQueryState as makeState } from "./lists.fixtures";

const CLEARED = { bookType: null, inQueue: null, isFavorite: null, status: null, tab: null };

describe("activeListQuickFilter", () => {
  it("highlights all while no group axis is set", () => {
    expect(activeListQuickFilter(makeState())).toBe("all");
  });

  it("recognises a tab picked by the chips", () => {
    expect(activeListQuickFilter(makeState({ tab: "finished" }))).toBe("finished");
    expect(activeListQuickFilter(makeState({ tab: "not_started" }))).toBe("not_started");
    expect(activeListQuickFilter(makeState({ tab: "reading" }))).toBe("reading");
  });

  it("recognises the statuses the advanced filters sheet writes for a reading chip", () => {
    expect(activeListQuickFilter(makeState({ status: ["reading", "rereading"] }))).toBe("reading");
    expect(activeListQuickFilter(makeState({ status: ["rereading", "reading"] }))).toBe("reading");
    expect(activeListQuickFilter(makeState({ status: ["want_to_read", "not_started"] }))).toBe(
      "not_started",
    );
    expect(activeListQuickFilter(makeState({ status: ["finished"] }))).toBe("finished");
  });

  it("highlights nothing for a status subset that no chip covers", () => {
    expect(activeListQuickFilter(makeState({ status: ["reading"] }))).toBeNull();
    expect(activeListQuickFilter(makeState({ status: ["finished", "dnf"] }))).toBeNull();
  });

  it("recognises the favourites, queue and series axes only in their positive form", () => {
    expect(activeListQuickFilter(makeState({ isFavorite: true }))).toBe("favorites");
    expect(activeListQuickFilter(makeState({ isFavorite: false }))).toBeNull();
    expect(activeListQuickFilter(makeState({ inQueue: true }))).toBe("in_queue");
    expect(activeListQuickFilter(makeState({ inQueue: false }))).toBeNull();
    expect(activeListQuickFilter(makeState({ bookType: "series_part" }))).toBe("series");
    expect(activeListQuickFilter(makeState({ bookType: "solo" }))).toBeNull();
  });

  it("highlights nothing while two group axes are in play", () => {
    expect(activeListQuickFilter(makeState({ isFavorite: true, tab: "finished" }))).toBeNull();
    expect(
      activeListQuickFilter(makeState({ status: ["reading", "rereading"], tab: "finished" })),
    ).toBeNull();
    expect(activeListQuickFilter(makeState({ bookType: "series_part", inQueue: true }))).toBeNull();
  });

  it("ignores the axes the chips do not own", () => {
    expect(activeListQuickFilter(makeState({ genre: ["fantasy"], q: "толкін" }))).toBe("all");
  });
});

describe("listQuickFilterPatch", () => {
  it("clears every group axis for all", () => {
    expect(listQuickFilterPatch("all")).toEqual(CLEARED);
  });

  it("sets a single tab and clears the rest", () => {
    expect(listQuickFilterPatch("not_started")).toEqual({ ...CLEARED, tab: "not_started" });
    expect(listQuickFilterPatch("reading")).toEqual({ ...CLEARED, tab: "reading" });
    expect(listQuickFilterPatch("finished")).toEqual({ ...CLEARED, tab: "finished" });
  });

  it("sets a single boolean or type axis and clears the rest", () => {
    expect(listQuickFilterPatch("favorites")).toEqual({ ...CLEARED, isFavorite: true });
    expect(listQuickFilterPatch("in_queue")).toEqual({ ...CLEARED, inQueue: true });
    expect(listQuickFilterPatch("series")).toEqual({ ...CLEARED, bookType: "series_part" });
  });
});

describe("listDetailStatusPatch", () => {
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

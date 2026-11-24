import type { HomeAttentionGroup, HomeAttentionSeverity, HomeAttentionView } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  homeAttentionCardState,
  homeAttentionPresence,
  homeCriticalBanner,
} from "./home-attention";

function group(id: string, severity: HomeAttentionSeverity = "high"): HomeAttentionGroup {
  return {
    count: 1,
    dueDate: null,
    id,
    reason: "delivery_ready_for_pickup",
    severity,
    unit: "parcels",
  };
}

function listIds(state: ReturnType<typeof homeAttentionCardState>) {
  if (state.kind !== "list") return null;
  return {
    hidden: state.list.hidden.map(({ id }) => id),
    isIncomplete: state.list.isIncomplete,
    visible: state.list.visible.map(({ id }) => id),
  };
}

function view(overrides: Partial<HomeAttentionView> = {}): HomeAttentionView {
  return { groups: [], unavailableSources: [], ...overrides };
}

describe("homeCriticalBanner", () => {
  it("raises the first critical group to the banner", () => {
    const banner = homeCriticalBanner(
      view({
        groups: [group("high-1"), group("critical-1", "critical"), group("critical-2", "critical")],
      }),
    );

    expect(banner?.id).toBe("critical-1");
  });

  it("shows no banner when no group is critical", () => {
    const groups = [group("high-1"), group("low-1", "low")];

    expect(homeCriticalBanner(view({ groups }))).toBeNull();
  });

  it("shows no banner before the first response", () => {
    expect(homeCriticalBanner(undefined)).toBeNull();
  });
});

describe("homeAttentionCardState", () => {
  it("is loading before the first response", () => {
    expect(homeAttentionCardState({ data: undefined, isError: false })).toEqual({
      kind: "loading",
    });
  });

  it("is an error when the first request fails", () => {
    expect(homeAttentionCardState({ data: undefined, isError: true })).toEqual({ kind: "error" });
  });

  it("removes the banner group from the list and keeps the other critical ones", () => {
    const state = homeAttentionCardState({
      data: view({
        groups: [group("critical-1", "critical"), group("high-1"), group("critical-2", "critical")],
      }),
      isError: false,
    });

    expect(listIds(state)).toEqual({
      hidden: [],
      isIncomplete: false,
      visible: ["high-1", "critical-2"],
    });
  });

  it("shows three groups and puts the rest behind more", () => {
    const state = homeAttentionCardState({
      data: view({
        groups: [group("g-1"), group("g-2"), group("g-3"), group("g-4"), group("g-5")],
      }),
      isError: false,
    });

    expect(listIds(state)).toEqual({
      hidden: ["g-4", "g-5"],
      isIncomplete: false,
      visible: ["g-1", "g-2", "g-3"],
    });
  });

  it("does not count the banner group among the three visible ones", () => {
    const state = homeAttentionCardState({
      data: view({
        groups: [
          group("critical-1", "critical"),
          group("g-1"),
          group("g-2"),
          group("g-3"),
          group("g-4"),
        ],
      }),
      isError: false,
    });

    expect(listIds(state)).toEqual({
      hidden: ["g-4"],
      isIncomplete: false,
      visible: ["g-1", "g-2", "g-3"],
    });
  });

  it("hides the card when every source answered with nothing", () => {
    expect(homeAttentionCardState({ data: view(), isError: false })).toEqual({ kind: "hidden" });
  });

  it("hides the card when its only group went to the banner", () => {
    expect(
      homeAttentionCardState({
        data: view({ groups: [group("critical-1", "critical")] }),
        isError: false,
      }),
    ).toEqual({ kind: "hidden" });
  });

  it("stays visible with the incomplete note when the list is empty because a source failed", () => {
    const state = homeAttentionCardState({
      data: view({ unavailableSources: ["loans"] }),
      isError: false,
    });

    expect(listIds(state)).toEqual({ hidden: [], isIncomplete: true, visible: [] });
  });

  it("keeps the cached groups while a refetch is failing", () => {
    const state = homeAttentionCardState({
      data: view({ groups: [group("g-1")] }),
      isError: true,
    });

    expect(listIds(state)).toEqual({ hidden: [], isIncomplete: false, visible: ["g-1"] });
  });
});

describe("homeAttentionPresence", () => {
  it("is unknown before the first response", () => {
    expect(homeAttentionPresence(undefined)).toBe("unknown");
  });

  it("is present when any group came back", () => {
    expect(homeAttentionPresence(view({ groups: [group("g-1", "low")] }))).toBe("present");
  });

  it("is absent when every source answered with nothing", () => {
    expect(homeAttentionPresence(view())).toBe("absent");
  });

  it("is unknown when nothing came back because a source failed", () => {
    expect(homeAttentionPresence(view({ unavailableSources: ["deliveries"] }))).toBe("unknown");
  });
});

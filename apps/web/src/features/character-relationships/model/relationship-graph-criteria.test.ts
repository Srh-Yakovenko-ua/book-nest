import { describe, expect, it } from "vitest";

import type { RelationshipGraphCriteria } from "./relationship-graph-criteria";

import {
  RELATIONSHIP_GRAPH_CRITERIA,
  toRelationshipGraphParams,
  withRelationshipGraphMode,
} from "./relationship-graph-criteria";
import { RELATIONSHIP_FIXTURE } from "./relationships.fixtures";

const FOCUS_ID = RELATIONSHIP_FIXTURE.geralt.id;

const DEFAULTS: RelationshipGraphCriteria = RELATIONSHIP_GRAPH_CRITERIA.defaults;

const EVERY_CRITERION: RelationshipGraphCriteria = {
  categories: ["family", "romantic"],
  clusterBy: "group",
  depth: 3,
  focusCharacterId: FOCUS_ID,
  mode: "all",
  relationshipTypes: ["guardian_of", "enemy_of"],
};

describe("toRelationshipGraphParams", () => {
  it("asks for the whole graph in the chosen mode when nothing else is set", () => {
    expect(toRelationshipGraphParams(DEFAULTS)).toEqual({ mode: "all" });
  });

  it("drops the depth while no character is in focus", () => {
    expect(toRelationshipGraphParams({ ...DEFAULTS, depth: 3 })).toEqual({ mode: "all" });
  });

  it("sends the depth together with the focused character", () => {
    expect(
      toRelationshipGraphParams({ ...DEFAULTS, depth: 2, focusCharacterId: FOCUS_ID }),
    ).toEqual({ depth: 2, focusCharacterId: FOCUS_ID, mode: "all" });
  });

  it("sends the chosen categories, types and clustering as they are", () => {
    expect(
      toRelationshipGraphParams({
        ...DEFAULTS,
        categories: ["family", "romantic"],
        clusterBy: "importance",
        mode: "family",
        relationshipTypes: ["guardian_of"],
      }),
    ).toEqual({
      categories: ["family", "romantic"],
      clusterBy: "importance",
      mode: "family",
      relationshipTypes: ["guardian_of"],
    });
  });

  it("never asks the server to reveal edges, even with every criterion set", () => {
    expect(Object.keys(toRelationshipGraphParams(EVERY_CRITERION)).sort()).toEqual([
      "categories",
      "clusterBy",
      "depth",
      "focusCharacterId",
      "mode",
      "relationshipTypes",
    ]);
  });
});

describe("withRelationshipGraphMode", () => {
  it("clears category and type filters but keeps the focus, depth and clustering", () => {
    expect(withRelationshipGraphMode({ criteria: EVERY_CRITERION, mode: "family" })).toEqual({
      categories: [],
      clusterBy: "group",
      depth: 3,
      focusCharacterId: FOCUS_ID,
      mode: "family",
      relationshipTypes: [],
    });
  });
});

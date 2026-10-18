import type { CharacterGraphClusterView } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  computeRelationshipGraphAutoLayout,
  resolveRelationshipGraphPlacements,
} from "./relationship-graph-layout";
import { makeRelationshipGraphNode, RELATIONSHIP_FIXTURE } from "./relationships.fixtures";

const { ciri: CIRI, geralt: GERALT, yennefer: YENNEFER } = RELATIONSHIP_FIXTURE;

const DANDELION = { id: "a4a4a4a4-0000-4000-8000-000000000007", name: "Dandelion" };

const GHOST_ID = "d0d0d0d0-0000-4000-8000-000000000006";

const CLUSTER_ID = "importance:major";

const NODES = [
  makeRelationshipGraphNode({ degree: 3 }),
  makeRelationshipGraphNode({ ...CIRI, degree: 2 }),
  makeRelationshipGraphNode({ ...YENNEFER, degree: 2 }),
  makeRelationshipGraphNode({ ...DANDELION, clusterId: CLUSTER_ID, degree: 1 }),
];

const CLUSTERS: CharacterGraphClusterView[] = [
  { id: CLUSTER_ID, importance: "major", kind: "importance", size: 1 },
];

const AUTO_POSITIONS = {
  [CIRI.id]: { x: 140, y: 0 },
  [GERALT.id]: { x: 0, y: 0 },
};

describe("computeRelationshipGraphAutoLayout", () => {
  it("places every character of the graph at a point of its own", () => {
    const positions = computeRelationshipGraphAutoLayout({
      clusters: CLUSTERS,
      focusCharacterId: null,
      nodes: NODES,
    });

    expect(Object.keys(positions).sort()).toEqual(NODES.map((node) => node.id).sort());
    expect(new Set(Object.values(positions).map(({ x, y }) => `${x}:${y}`)).size).toBe(
      NODES.length,
    );
  });

  it("lays the same graph out identically whatever order its nodes arrive in", () => {
    const forward = computeRelationshipGraphAutoLayout({
      clusters: CLUSTERS,
      focusCharacterId: YENNEFER.id,
      nodes: NODES,
    });
    const reversed = computeRelationshipGraphAutoLayout({
      clusters: CLUSTERS,
      focusCharacterId: YENNEFER.id,
      nodes: [...NODES].reverse(),
    });

    expect(reversed).toEqual(forward);
  });
});

describe("resolveRelationshipGraphPlacements", () => {
  it("restores saved coordinates only for characters that are still on the graph", () => {
    const placements = resolveRelationshipGraphPlacements({
      auto: AUTO_POSITIONS,
      nodes: [makeRelationshipGraphNode(), makeRelationshipGraphNode(CIRI)],
      saved: { [GERALT.id]: { x: 40, y: -20 }, [GHOST_ID]: { x: 999, y: 999 } },
    });

    expect(placements).toEqual([
      { id: GERALT.id, position: { x: 40, y: -20 } },
      { id: CIRI.id, position: { x: 140, y: 0 } },
    ]);
  });

  it("uses the automatic layout when nothing is saved", () => {
    const placements = resolveRelationshipGraphPlacements({
      auto: AUTO_POSITIONS,
      nodes: [makeRelationshipGraphNode(), makeRelationshipGraphNode(CIRI)],
      saved: null,
    });

    expect(placements).toEqual([
      { id: GERALT.id, position: { x: 0, y: 0 } },
      { id: CIRI.id, position: { x: 140, y: 0 } },
    ]);
  });
});

import { describe, expect, it } from "vitest";

import {
  toRelationshipGraphEdgeGeometry,
  toRelationshipGraphEdgeLanes,
} from "./relationship-graph-geometry";
import { RELATIONSHIP_FIXTURE } from "./relationships.fixtures";

const { ciri: CIRI, geralt: GERALT } = RELATIONSHIP_FIXTURE;

const NODE_BOXES = {
  left: { height: 40, width: 120, x: 0, y: 0 },
  right: { height: 40, width: 120, x: 400, y: 0 },
};

describe("toRelationshipGraphEdgeGeometry", () => {
  it("ends a directed edge in an arrowhead touching the target node", () => {
    expect(
      toRelationshipGraphEdgeGeometry({
        isDirected: true,
        lane: 0,
        source: NODE_BOXES.left,
        target: NODE_BOXES.right,
      }),
    ).toEqual({
      arrow: "400,20 389,25 389,15",
      label: { x: 260, y: 20 },
      path: "M 120,20 L 389,20",
    });
  });

  it("draws an undirected edge from border to border with no arrowhead", () => {
    expect(
      toRelationshipGraphEdgeGeometry({
        isDirected: false,
        lane: 0,
        source: NODE_BOXES.left,
        target: NODE_BOXES.right,
      }),
    ).toEqual({ arrow: null, label: { x: 260, y: 20 }, path: "M 120,20 L 400,20" });
  });

  it("draws nothing between two nodes in the same spot", () => {
    expect(
      toRelationshipGraphEdgeGeometry({
        isDirected: true,
        lane: 0,
        source: NODE_BOXES.left,
        target: NODE_BOXES.left,
      }),
    ).toBeNull();
  });
});

describe("toRelationshipGraphEdgeLanes", () => {
  it("keeps a lone edge on the centre line", () => {
    const lanes = toRelationshipGraphEdgeLanes([
      { id: "rel-1", source: GERALT.id, target: CIRI.id },
    ]);

    expect(lanes.get("rel-1")).toBe(0);
  });

  it("spreads two edges between the same characters to either side of the centre line", () => {
    const lanes = toRelationshipGraphEdgeLanes([
      { id: "rel-2", source: GERALT.id, target: CIRI.id },
      { id: "rel-1", source: GERALT.id, target: CIRI.id },
    ]);

    expect([lanes.get("rel-1"), lanes.get("rel-2")]).toEqual([-0.5, 0.5]);
  });
});

import type { CharacterGraphClusterView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { NetworkScene } from "./graph-network-scene";
import type { NetworkGrouping } from "./graph-workspace-params";

import {
  makeRelationshipGraph,
  makeRelationshipGraphEdge,
  makeRelationshipGraphNode,
} from "../relationships.fixtures";
import {
  buildNetworkScene,
  EMPTY_NETWORK_EXPANSION,
  toggleNetworkCluster,
} from "./graph-network-scene";

const BUCKET_ID_PATTERN = /^cluster:(group|components|importance):[a-z0-9_-]+$/;

const GROUP = {
  north: "f1f1f1f1-0000-4000-8000-000000000001",
  south: "f2f2f2f2-0000-4000-8000-000000000002",
} as const;

const CHARACTER = {
  loner: "a3a3a3a3-0000-4000-8000-000000000001",
  northFirst: "a1a1a1a1-0000-4000-8000-000000000001",
  northSecond: "a1a1a1a1-0000-4000-8000-000000000002",
  southFirst: "a2a2a2a2-0000-4000-8000-000000000001",
  southSecond: "a2a2a2a2-0000-4000-8000-000000000002",
} as const;

const RELATIONSHIP = {
  first: "e1e1e1e1-0000-4000-8000-000000000001",
  second: "e2e2e2e2-0000-4000-8000-000000000002",
  third: "e3e3e3e3-0000-4000-8000-000000000003",
} as const;

const TWO_GROUPS = makeRelationshipGraph({
  clusters: [groupCluster(GROUP.north, 2), groupCluster(GROUP.south, 2)],
  edges: [
    makeRelationshipGraphEdge({
      id: RELATIONSHIP.first,
      source: CHARACTER.northFirst,
      target: CHARACTER.southFirst,
    }),
    makeRelationshipGraphEdge({
      id: RELATIONSHIP.second,
      source: CHARACTER.northSecond,
      target: CHARACTER.southSecond,
    }),
  ],
  nodes: [
    makeRelationshipGraphNode({ clusterId: GROUP.north, id: CHARACTER.northFirst }),
    makeRelationshipGraphNode({ clusterId: GROUP.north, id: CHARACTER.northSecond }),
    makeRelationshipGraphNode({ clusterId: GROUP.south, id: CHARACTER.southFirst }),
    makeRelationshipGraphNode({ clusterId: GROUP.south, id: CHARACTER.southSecond }),
  ],
});

const MIXED_GRAPH = makeRelationshipGraph({
  clusters: [groupCluster(GROUP.north, 1)],
  edges: [
    makeRelationshipGraphEdge({
      id: RELATIONSHIP.third,
      source: CHARACTER.northFirst,
      target: CHARACTER.southFirst,
    }),
  ],
  nodes: [
    makeRelationshipGraphNode({
      clusterId: GROUP.north,
      id: CHARACTER.northFirst,
      importance: "central",
    }),
    makeRelationshipGraphNode({ clusterId: null, id: CHARACTER.loner, importance: null }),
    makeRelationshipGraphNode({ clusterId: null, id: CHARACTER.southFirst, importance: "major" }),
  ],
});

describe("buildNetworkScene", () => {
  it("falls back to connected fragments when grouping by group finds no group clusters", () => {
    const graph = makeRelationshipGraph({
      clusters: [
        {
          id: "f3f3f3f3-0000-4000-8000-000000000003",
          importance: "major",
          kind: "importance",
          size: 2,
        },
      ],
      edges: [],
      nodes: [
        makeRelationshipGraphNode({ id: CHARACTER.northFirst }),
        makeRelationshipGraphNode({ id: CHARACTER.southFirst }),
      ],
    });
    const scene = buildNetworkScene({
      expansion: EMPTY_NETWORK_EXPANSION,
      graph,
      grouping: "group",
    });

    expect(scene).toMatchObject({ effectiveGrouping: "components", usedFallback: true });
  });

  it("groups by named groups when the graph has them", () => {
    const scene = buildNetworkScene({
      expansion: EMPTY_NETWORK_EXPANSION,
      graph: TWO_GROUPS,
      grouping: "group",
    });

    expect(scene).toMatchObject({ effectiveGrouping: "group", usedFallback: false });
  });

  it("puts characters without a group into the ungrouped bucket", () => {
    const scene = buildNetworkScene({
      expansion: EMPTY_NETWORK_EXPANSION,
      graph: MIXED_GRAPH,
      grouping: "group",
    });
    const ungrouped = scene.buckets.find((bucket) => bucket.id === "cluster:group:none");

    expect(new Set(ungrouped?.memberIds)).toEqual(new Set([CHARACTER.loner, CHARACTER.southFirst]));
  });

  it.each([
    { count: 12, hasMoreBuckets: false },
    { count: 13, hasMoreBuckets: true },
  ])("shows twelve buckets of $count fragments, more: $hasMoreBuckets", (row) => {
    const graph = makeRelationshipGraph({
      clusters: [],
      edges: [],
      nodes: characterIds(row.count).map((id) => makeRelationshipGraphNode({ id })),
    });
    const scene = buildNetworkScene({
      expansion: EMPTY_NETWORK_EXPANSION,
      graph,
      grouping: "components",
    });

    expect(scene.buckets).toHaveLength(12);
    expect(scene.hasMoreBuckets).toBe(row.hasMoreBuckets);
  });

  it("shows twelve members of an expanded bucket and reports more", () => {
    const graph = makeRelationshipGraph({
      clusters: [groupCluster(GROUP.north, 13)],
      edges: [],
      nodes: [CHARACTER.northFirst, ...characterIds(12)].map((id) =>
        makeRelationshipGraphNode({ clusterId: GROUP.north, id }),
      ),
    });
    const collapsed = buildNetworkScene({
      expansion: EMPTY_NETWORK_EXPANSION,
      graph,
      grouping: "group",
    });
    const bucketId = bucketIdOf(collapsed, CHARACTER.northFirst);
    const scene = buildNetworkScene({
      expansion: toggleNetworkCluster({ bucketId, expansion: EMPTY_NETWORK_EXPANSION }),
      graph,
      grouping: "group",
    });

    expect(scene.nodes).toHaveLength(12);
    expect(scene.moreMembersIds).toEqual(new Set([bucketId]));
  });

  it("draws the relationships between two collapsed buckets as one aggregate connector", () => {
    const scene = buildNetworkScene({
      expansion: EMPTY_NETWORK_EXPANSION,
      graph: TWO_GROUPS,
      grouping: "group",
    });
    const endpoints = scene.aggregates.map((aggregate) => [aggregate.sourceId, aggregate.targetId]);
    const north = bucketIdOf(scene, CHARACTER.northFirst);
    const south = bucketIdOf(scene, CHARACTER.southFirst);

    expect(endpoints.map((pair) => new Set(pair))).toEqual([new Set([north, south])]);
  });

  it("keeps aggregated relationships out of the edges and out of the connector id", () => {
    const scene = buildNetworkScene({
      expansion: EMPTY_NETWORK_EXPANSION,
      graph: TWO_GROUPS,
      grouping: "group",
    });
    const aggregateIds = scene.aggregates.map(({ id }) => id);

    expect(scene.edges).toEqual([]);
    expect(aggregateIds).toHaveLength(1);
    expect(aggregateIds).not.toContain(RELATIONSHIP.first);
    expect(aggregateIds).not.toContain(RELATIONSHIP.second);
  });

  it("draws the relationships between two shown members as edges", () => {
    const collapsed = buildNetworkScene({
      expansion: EMPTY_NETWORK_EXPANSION,
      graph: TWO_GROUPS,
      grouping: "group",
    });
    const northExpanded = toggleNetworkCluster({
      bucketId: bucketIdOf(collapsed, CHARACTER.northFirst),
      expansion: EMPTY_NETWORK_EXPANSION,
    });
    const scene = buildNetworkScene({
      expansion: toggleNetworkCluster({
        bucketId: bucketIdOf(collapsed, CHARACTER.southFirst),
        expansion: northExpanded,
      }),
      graph: TWO_GROUPS,
      grouping: "group",
    });

    expect(scene.edges.map(({ id }) => id)).toEqual([RELATIONSHIP.first, RELATIONSHIP.second]);
    expect(scene.aggregates).toEqual([]);
  });

  it.each<{ count: number; grouping: NetworkGrouping }>([
    { count: 2, grouping: "group" },
    { count: 2, grouping: "components" },
    { count: 3, grouping: "importance" },
  ])("names every $grouping bucket with a cluster id", ({ count, grouping }) => {
    const scene = buildNetworkScene({
      expansion: EMPTY_NETWORK_EXPANSION,
      graph: MIXED_GRAPH,
      grouping,
    });

    expect(scene.buckets.map(({ id }) => id)).toEqual(
      Array.from({ length: count }, () => expect.stringMatching(BUCKET_ID_PATTERN)),
    );
  });
});

function bucketIdOf(scene: NetworkScene, memberId: string): string {
  return scene.buckets.find((bucket) => bucket.memberIds.includes(memberId))?.id ?? "";
}

function characterIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const suffix = String(index + 1).padStart(12, "0");
    return `b1b1b1b1-0000-4000-8000-${suffix}`;
  });
}

function groupCluster(id: string, size: number): CharacterGraphClusterView {
  return { groupType: "family", id, kind: "group", name: "Kaer Morhen", size };
}

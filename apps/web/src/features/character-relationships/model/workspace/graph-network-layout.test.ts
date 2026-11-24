import type { CharacterGraphClusterView, CharacterGraphView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { NetworkIndex } from "./graph-network-index";
import type { NetworkExpansion, NetworkScene } from "./graph-network-scene";
import type { GraphWorkspacePositions } from "./graph-workspace-layout";

import {
  makeRelationshipGraph,
  makeRelationshipGraphEdge,
  makeRelationshipGraphNode,
} from "../relationships.fixtures";
import { buildNetworkIndex, isNetworkClusterId } from "./graph-network-index";
import { layoutNetworkScene, NETWORK_LAYOUT } from "./graph-network-layout";
import {
  buildNetworkScene,
  EMPTY_NETWORK_EXPANSION,
  withMoreNetworkMembers,
  withNetworkFocus,
} from "./graph-network-scene";
import { GRAPH_NODE_BOX } from "./graph-workspace-layout";

type FocusScene = Extract<NetworkScene, { kind: "focus" }>;

const LARGE = {
  characters: 176,
  groups: 21,
  membersPerGroup: 8,
  offsets: [1, 3, 5, 8, 11, 16],
  pairs: 335,
  stride: 37,
} as const;

const CROWD_BUCKET = "cluster:group:crowd";

const CROWD = groupedGraph({
  links: [
    ...range(1, 29).map((position): [string, string] => [
      `crowd-${pad(position)}`,
      `crowd-${pad(position + 1)}`,
    ]),
    ...range(1, 12).map((position): [string, string] => [
      `crowd-${pad(position)}`,
      `r${pad(position)}-01`,
    ]),
  ],
  memberIds: [
    ...range(1, 30).map((position) => `crowd-${pad(position)}`),
    ...range(1, 12).map((position) => `r${pad(position)}-01`),
  ],
});

const TOPOLOGY = groupedGraph({
  links: [
    ["kilo-01", "alpha-01"],
    ["kilo-01", "alpha-02"],
    ["kilo-02", "alpha-03"],
    ["kilo-02", "bravo-01"],
  ],
  memberIds: [
    "alpha-01",
    "alpha-02",
    "alpha-03",
    "bravo-01",
    "bravo-02",
    "kilo-01",
    "kilo-02",
    "zulu-01",
    "zulu-02",
  ],
});

describe("layoutNetworkScene overview", () => {
  it("keeps the twelve shown group cards of a large map apart", () => {
    const positions = layoutNetworkScene(overviewOf(indexOf(largeGraph()), 0));

    expect({ overlaps: overlapsOf(positions), placed: positions.size }).toEqual({
      overlaps: [],
      placed: 12,
    });
  });

  it("keeps every group card of a large map apart once all groups are shown", () => {
    const positions = layoutNetworkScene(overviewOf(indexOf(largeGraph()), 1));

    expect({ overlaps: overlapsOf(positions), placed: positions.size }).toEqual({
      overlaps: [],
      placed: 22,
    });
  });

  it("puts the group with the most pairs at the origin", () => {
    const positions = layoutNetworkScene(overviewOf(indexOf(TOPOLOGY), 0));

    expect(positions.get("cluster:group:kilo")).toEqual({ x: 0, y: 0 });
  });

  it("puts the group most paired with the first one in a neighbouring cell", () => {
    const positions = layoutNetworkScene(overviewOf(indexOf(TOPOLOGY), 0));
    const hub = positions.get("cluster:group:kilo") ?? { x: Infinity, y: Infinity };
    const partner = positions.get("cluster:group:alpha") ?? { x: -Infinity, y: -Infinity };
    const cell = {
      height: GRAPH_NODE_BOX.cluster.height + NETWORK_LAYOUT.overview.bucketGap,
      width: GRAPH_NODE_BOX.cluster.width + NETWORK_LAYOUT.overview.bucketGap,
    };

    const cellDistance = Math.max(
      Math.abs(partner.x - hub.x) / cell.width,
      Math.abs(partner.y - hub.y) / cell.height,
    );

    expect(cellDistance).toBe(1);
  });

  it("places the groups the same way on every run", () => {
    const first = layoutNetworkScene(overviewOf(indexOf(largeGraph()), 1));
    const second = layoutNetworkScene(overviewOf(indexOf(largeGraph()), 1));

    expect(second).toEqual(first);
  });

  it("places the groups the same way whatever order the response lists them in", () => {
    const listed = layoutNetworkScene(overviewOf(indexOf(largeGraph()), 1));
    const reordered = layoutNetworkScene(overviewOf(indexOf(reversed(largeGraph())), 1));

    expect(reordered).toEqual(listed);
  });
});

describe("layoutNetworkScene focus", () => {
  it("keeps member and neighbour cards apart in every group of a large map", () => {
    const index = indexOf(largeGraph());
    const problems = index.buckets.flatMap((bucket) => {
      const scene = focusOf({ bucketId: bucket.id, index });
      const positions = layoutNetworkScene(scene);
      const unplaced = [...scene.memberIds, ...scene.neighbors.map((neighbor) => neighbor.id)]
        .filter((id) => !positions.has(id))
        .map((id) => `${id} is not placed`);
      return [...overlapsOf(positions), ...unplaced];
    });

    expect({ buckets: index.buckets.length, problems }).toEqual({ buckets: 22, problems: [] });
  });

  it("keeps the cards of a crowded group apart once all its pages are shown", () => {
    const expansion = withMoreNetworkMembers(withMoreNetworkMembers(focusing(CROWD_BUCKET)));
    const positions = layoutNetworkScene(
      focusOf({ bucketId: CROWD_BUCKET, expansion, index: indexOf(CROWD) }),
    );

    expect({ overlaps: overlapsOf(positions), placed: positions.size }).toEqual({
      overlaps: [],
      placed: 40,
    });
  });

  it("places neighbour cards outside the box around the members", () => {
    const index = indexOf(largeGraph());
    const scenes = index.buckets.map((bucket) => focusOf({ bucketId: bucket.id, index }));
    const intrusions = scenes.flatMap((scene) => intrusionsOf(scene, layoutNetworkScene(scene)));
    const checked = scenes.reduce((sum, scene) => sum + scene.neighbors.length, 0);

    expect({ checked, intrusions }).toEqual({ checked: 220, intrusions: [] });
  });

  it("keeps placed members in place when twelve more are shown", () => {
    const index = indexOf(CROWD);
    const shown = focusOf({ bucketId: CROWD_BUCKET, index });
    const expansion = withMoreNetworkMembers(focusing(CROWD_BUCKET));
    const grown = focusOf({ bucketId: CROWD_BUCKET, expansion, index });
    const before = layoutNetworkScene(shown);
    const after = layoutNetworkScene(grown);

    expect(shown.memberIds.map((id) => after.get(id))).toEqual(
      shown.memberIds.map((id) => before.get(id)),
    );
    expect({ grown: grown.memberIds.length, placedBefore: before.size }).toEqual({
      grown: 24,
      placedBefore: 22,
    });
  });

  it("keeps placed members in place when a member is revealed", () => {
    const index = indexOf(CROWD);
    const shown = focusOf({ bucketId: CROWD_BUCKET, index });
    const expansion = focusing(CROWD_BUCKET, ["crowd-30"]);
    const revealed = focusOf({ bucketId: CROWD_BUCKET, expansion, index });
    const before = layoutNetworkScene(shown);
    const after = layoutNetworkScene(revealed);
    const isRevealed = revealed.memberIds.includes("crowd-30");

    expect(shown.memberIds.map((id) => after.get(id))).toEqual(
      shown.memberIds.map((id) => before.get(id)),
    );
    expect({ isRevealed, placedBefore: before.size }).toEqual({
      isRevealed: true,
      placedBefore: 22,
    });
  });

  it("places a focused group the same way whatever order the response lists it in", () => {
    const listed = indexOf(largeGraph());
    const reordered = indexOf(reversed(largeGraph()));
    const bucketId = "cluster:group:g00";

    expect(layoutNetworkScene(focusOf({ bucketId, index: reordered }))).toEqual(
      layoutNetworkScene(focusOf({ bucketId, index: listed })),
    );
  });
});

function boxOf(id: string) {
  return isNetworkClusterId(id) ? GRAPH_NODE_BOX.cluster : GRAPH_NODE_BOX.character;
}

function focusing(bucketId: string, revealIds: readonly string[] = []): NetworkExpansion {
  return withNetworkFocus({ bucketId, expansion: EMPTY_NETWORK_EXPANSION, revealIds });
}

function focusOf({
  bucketId,
  expansion = EMPTY_NETWORK_EXPANSION,
  index,
}: {
  bucketId: string;
  expansion?: NetworkExpansion;
  index: NetworkIndex;
}): FocusScene {
  const scene = buildNetworkScene({ expansion, focusBucketId: bucketId, index });
  if (scene.kind !== "focus") throw new Error(`no focus scene for ${bucketId}`);
  return scene;
}

function groupedGraph({
  links,
  memberIds,
}: {
  links: readonly (readonly [string, string])[];
  memberIds: readonly string[];
}): CharacterGraphView {
  const groupOf = (id: string) => id.slice(0, id.lastIndexOf("-"));
  return makeRelationshipGraph({
    clusters: [...new Set(memberIds.map(groupOf))].map(toGroupCluster),
    edges: links.map(([source, target]) =>
      makeRelationshipGraphEdge({ id: `edge:${source}:${target}`, source, target }),
    ),
    nodes: memberIds.map((id) => makeRelationshipGraphNode({ clusterId: groupOf(id), id })),
  });
}

function indexOf(graph: CharacterGraphView): NetworkIndex {
  return buildNetworkIndex({ graph, grouping: "group" });
}

function intrusionsOf(scene: FocusScene, positions: GraphWorkspacePositions): string[] {
  const members = scene.memberIds.flatMap((id) => positions.get(id) ?? []);
  const member = GRAPH_NODE_BOX.character;
  const card = GRAPH_NODE_BOX.cluster;
  const box = {
    maxX: Math.max(...members.map((point) => point.x)) + member.width / 2,
    maxY: Math.max(...members.map((point) => point.y)) + member.height / 2,
    minX: Math.min(...members.map((point) => point.x)) - member.width / 2,
    minY: Math.min(...members.map((point) => point.y)) - member.height / 2,
  };
  return scene.neighbors.flatMap((neighbor) => {
    const point = positions.get(neighbor.id);
    if (point === undefined) return [`${neighbor.id} is not placed`];
    const isApart =
      point.x + card.width / 2 <= box.minX ||
      point.x - card.width / 2 >= box.maxX ||
      point.y + card.height / 2 <= box.minY ||
      point.y - card.height / 2 >= box.maxY;
    return isApart ? [] : [`${neighbor.id} sits among the members of ${scene.bucket.id}`];
  });
}

function largeGraph(): CharacterGraphView {
  const groupIds = range(0, LARGE.groups - 1).map((position) => `g${pad(position)}`);
  const grouped = LARGE.groups * LARGE.membersPerGroup;
  return makeRelationshipGraph({
    clusters: groupIds.map(toGroupCluster),
    edges: range(0, LARGE.pairs - 1).map((position) => {
      const source = (position * LARGE.stride) % LARGE.characters;
      const offset = LARGE.offsets[position % LARGE.offsets.length] ?? 1;
      return makeRelationshipGraphEdge({
        id: `e${pad(position, 3)}`,
        source: `c${pad(source, 3)}`,
        target: `c${pad((source + offset) % LARGE.characters, 3)}`,
      });
    }),
    nodes: range(0, LARGE.characters - 1).map((position) =>
      makeRelationshipGraphNode({
        clusterId: position < grouped ? `g${pad(position % LARGE.groups)}` : null,
        id: `c${pad(position, 3)}`,
      }),
    ),
  });
}

function overlapsOf(positions: GraphWorkspacePositions): string[] {
  const placed = [...positions];
  return placed.flatMap(([leftId, left], position) =>
    placed.slice(position + 1).flatMap(([rightId, right]) => {
      const leftBox = boxOf(leftId);
      const rightBox = boxOf(rightId);
      const isApart =
        Math.abs(left.x - right.x) >= (leftBox.width + rightBox.width) / 2 ||
        Math.abs(left.y - right.y) >= (leftBox.height + rightBox.height) / 2;
      return isApart ? [] : [`${leftId} overlaps ${rightId}`];
    }),
  );
}

function overviewOf(index: NetworkIndex, extraClusters: number): NetworkScene {
  return buildNetworkScene({
    expansion: { ...EMPTY_NETWORK_EXPANSION, extraClusters },
    focusBucketId: null,
    index,
  });
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function range(first: number, last: number): number[] {
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
}

function reversed(graph: CharacterGraphView): CharacterGraphView {
  return {
    ...graph,
    clusters: [...graph.clusters].reverse(),
    edges: [...graph.edges].reverse(),
    nodes: [...graph.nodes].reverse(),
  };
}

function toGroupCluster(id: string): CharacterGraphClusterView {
  return { groupType: "family", id, kind: "group", name: id, size: 1 };
}

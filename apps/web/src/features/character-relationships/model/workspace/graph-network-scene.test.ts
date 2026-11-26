import type {
  CharacterGraphClusterView,
  CharacterGraphEdgeView,
  CharacterGraphView,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { NetworkAggregateLink, NetworkIndex } from "./graph-network-index";
import type { NetworkExpansion, NetworkScene } from "./graph-network-scene";

import {
  makeRelationshipGraph,
  makeRelationshipGraphEdge,
  makeRelationshipGraphNode,
} from "../relationships.fixtures";
import { buildNetworkIndex } from "./graph-network-index";
import {
  buildNetworkScene,
  EMPTY_NETWORK_EXPANSION,
  summarizeNetworkLink,
  toNetworkLinkExplore,
  withMoreNetworkMembers,
  withNetworkFocus,
} from "./graph-network-scene";

type FocusScene = Extract<NetworkScene, { kind: "focus" }>;

type OverviewScene = Extract<NetworkScene, { kind: "overview" }>;

const BUCKET = {
  big: "cluster:group:big",
  north: "cluster:group:north",
  other: "cluster:group:other",
  south: "cluster:group:south",
} as const;

const MANY_GROUPS = groupedGraph({
  edges: [relation("g01-01", "g02-01"), relation("g01-01", "g13-01")],
  memberIds: numbered("g", 1, 14).flatMap((groupId) => [`${groupId}-01`, `${groupId}-02`]),
  ungroupedIds: ["loner"],
});

const BIG_GROUP = groupedGraph({
  edges: [],
  memberIds: [...numbered("big-", 1, 30), "other-01", "other-02"],
});

const HUB = groupedGraph({
  edges: [
    ...numbered("n", 1, 12).map((groupId) => relation("hub-01", `${groupId}-01`)),
    relation("hub-01", "n11-02"),
    relation("hub-01", "n12-02"),
    relation("hub-01", "n12-03"),
  ],
  memberIds: [
    "hub-01",
    ...numbered("n", 1, 12).map((groupId) => `${groupId}-01`),
    "n05-02",
    "n05-03",
    "n11-02",
    "n12-02",
    "n12-03",
  ],
});

const SHOWN_FIRST = groupedGraph({
  edges: [
    ...numbered("core-", 1, 11).map((id, position) =>
      relation(id, `core-${String(position + 2).padStart(2, "0")}`),
    ),
    relation("core-12", "core-01"),
    relation("core-01", "yank-01"),
    relation("core-13", "xray-01"),
    relation("core-14", "xray-02"),
    relation("core-15", "xray-03"),
  ],
  memberIds: [...numbered("core-", 1, 15), ...numbered("xray-", 1, 3), "yank-01"],
});

const STAR = groupedGraph({
  edges: [
    ...numbered("star-", 2, 13).map((id) => relation("star-01", id)),
    relation("star-02", "star-01"),
  ],
  memberIds: numbered("star-", 1, 13),
});

const EXPLORE = groupedGraph({
  edges: [
    relation("north-01", "north-03"),
    relation("north-01", "north-04"),
    relation("north-01", "north-05"),
    relation("north-01", "south-01"),
    relation("north-02", "south-01"),
    relation("north-02", "south-02"),
  ],
  memberIds: [...numbered("north-", 1, 5), "south-01", "south-02"],
});

describe("buildNetworkScene overview", () => {
  it("shows the first twelve groups and counts the rest as hidden", () => {
    const scene = overviewOf({ extraClusters: 0, graph: MANY_GROUPS });

    expect({
      bucketIds: scene.buckets.map((bucket) => bucket.id),
      hasMoreBuckets: scene.hasMoreBuckets,
      hiddenBucketCount: scene.hiddenBucketCount,
    }).toEqual({
      bucketIds: numbered("cluster:group:g", 1, 12),
      hasMoreBuckets: true,
      hiddenBucketCount: 3,
    });
  });

  it("reaches every group, the ungrouped one included, on the next page", () => {
    const scene = overviewOf({ extraClusters: 1, graph: MANY_GROUPS });

    expect({
      bucketIds: scene.buckets.map((bucket) => bucket.id),
      hasMoreBuckets: scene.hasMoreBuckets,
      hiddenBucketCount: scene.hiddenBucketCount,
    }).toEqual({
      bucketIds: [...numbered("cluster:group:g", 1, 14), "cluster:group:none"],
      hasMoreBuckets: false,
      hiddenBucketCount: 0,
    });
  });

  it("links only the groups shown on the page", () => {
    const scene = overviewOf({ extraClusters: 0, graph: MANY_GROUPS });

    expect(scene.links.map((link) => link.id)).toEqual([
      "aggregate:cluster:group:g01:cluster:group:g02",
    ]);
  });

  it("adds the link to a group once its page is shown", () => {
    const scene = overviewOf({ extraClusters: 1, graph: MANY_GROUPS });

    expect(scene.links.map((link) => link.id)).toEqual([
      "aggregate:cluster:group:g01:cluster:group:g02",
      "aggregate:cluster:group:g01:cluster:group:g13",
    ]);
  });

  it("shows the overview when the focused group is not on the map", () => {
    const scene = buildNetworkScene({
      expansion: EMPTY_NETWORK_EXPANSION,
      focusBucketId: "cluster:group:missing",
      index: indexOf(MANY_GROUPS),
    });

    expect(scene.kind).toBe("overview");
  });
});

describe("buildNetworkScene focus members", () => {
  it("shows the first twelve members of the focused group", () => {
    const scene = focusOf({ bucketId: BUCKET.big, graph: BIG_GROUP });

    expect(membersOf(scene)).toEqual({
      hasMoreMembers: true,
      hiddenMemberCount: 18,
      memberIds: numbered("big-", 1, 12),
    });
  });

  it("shows twelve more members for each extra page", () => {
    const expansion = withMoreNetworkMembers(focusing(BUCKET.big));
    const scene = focusOf({ bucketId: BUCKET.big, expansion, graph: BIG_GROUP });

    expect(membersOf(scene)).toEqual({
      hasMoreMembers: true,
      hiddenMemberCount: 6,
      memberIds: numbered("big-", 1, 24),
    });
  });

  it("shows every member once the pages cover the group", () => {
    const expansion = withMoreNetworkMembers(withMoreNetworkMembers(focusing(BUCKET.big)));
    const scene = focusOf({ bucketId: BUCKET.big, expansion, graph: BIG_GROUP });

    expect(membersOf(scene)).toEqual({
      hasMoreMembers: false,
      hiddenMemberCount: 0,
      memberIds: numbered("big-", 1, 30),
    });
  });

  it("appends revealed members beyond the first page in reveal order", () => {
    const expansion = focusing(BUCKET.big, ["big-20", "big-15", "big-03"]);
    const scene = focusOf({ bucketId: BUCKET.big, expansion, graph: BIG_GROUP });

    expect(scene.memberIds).toEqual([...numbered("big-", 1, 12), "big-20", "big-15"]);
  });

  it("ignores revealed characters that belong to another group", () => {
    const expansion = focusing(BUCKET.big, ["other-01", "nobody"]);
    const scene = focusOf({ bucketId: BUCKET.big, expansion, graph: BIG_GROUP });

    expect(scene.memberIds).toEqual(numbered("big-", 1, 12));
  });

  it("ignores the pages and reveals recorded for another group", () => {
    const expansion = withMoreNetworkMembers(focusing(BUCKET.other, ["big-20"]));
    const scene = focusOf({ bucketId: BUCKET.big, expansion, graph: BIG_GROUP });

    expect(scene.memberIds).toEqual(numbered("big-", 1, 12));
  });
});

describe("buildNetworkScene focus neighbours", () => {
  it("shows the ten groups with the most pairs and counts the rest as hidden", () => {
    const scene = focusOf({ bucketId: "cluster:group:hub", graph: HUB });

    expect({
      hiddenNeighborCount: scene.hiddenNeighborCount,
      neighborIds: scene.neighbors.map((neighbor) => neighbor.id),
    }).toEqual({
      hiddenNeighborCount: 2,
      neighborIds: ["cluster:group:n12", "cluster:group:n11", ...numbered("cluster:group:n", 1, 8)],
    });
  });

  it("ranks a group paired with shown members above one paired only with hidden members", () => {
    const scene = focusOf({ bucketId: "cluster:group:core", graph: SHOWN_FIRST });

    expect(scene.neighbors.map((neighbor) => neighbor.id)).toEqual([
      "cluster:group:yank",
      "cluster:group:xray",
    ]);
  });

  it("links a shown member to each shown group it has pairs with", () => {
    const scene = focusOf({ bucketId: "cluster:group:core", graph: SHOWN_FIRST });

    expect(
      scene.links.map((link) => ({
        connectionIds: link.connectionIds,
        ends: [link.sourceId, link.targetId].sort(),
        pairCount: link.pairCount,
      })),
    ).toEqual([
      {
        connectionIds: ["pair:core-01:yank-01"],
        ends: ["cluster:group:yank", "core-01"],
        pairCount: 1,
      },
    ]);
  });

  it("draws no link to a group beyond the ten shown", () => {
    const scene = focusOf({ bucketId: "cluster:group:hub", graph: HUB });
    const linkedIds = scene.links.map((link) =>
      link.sourceId === "hub-01" ? link.targetId : link.sourceId,
    );

    expect(linkedIds.sort()).toEqual([
      ...numbered("cluster:group:n", 1, 8),
      "cluster:group:n11",
      "cluster:group:n12",
    ]);
  });
});

describe("buildNetworkScene focus pairs", () => {
  it("keeps only the pairs between shown members", () => {
    const scene = focusOf({ bucketId: "cluster:group:star", graph: STAR });

    expect(scene.connections.map((connection) => connection.id)).toEqual(
      numbered("star-", 2, 12).map((id) => `pair:star-01:${id}`),
    );
  });

  it("keeps every relation record of a shown pair", () => {
    const scene = focusOf({ bucketId: "cluster:group:star", graph: STAR });
    const pair = scene.connections.find((connection) => connection.id === "pair:star-01:star-02");

    expect(pair?.edgeIds).toEqual(["edge:star-01:star-02", "edge:star-02:star-01"]);
  });
});

describe("withNetworkFocus", () => {
  it("resets the pages and reveals when the focus moves to another group", () => {
    const expansion: NetworkExpansion = {
      extraClusters: 1,
      focus: { bucketId: BUCKET.big, pages: 2, revealedIds: ["big-30"] },
    };

    expect(withNetworkFocus({ bucketId: BUCKET.other, expansion })).toEqual({
      extraClusters: 1,
      focus: { bucketId: BUCKET.other, pages: 0, revealedIds: [] },
    });
  });

  it("appends each new reveal once while the focus stays on the group", () => {
    const expansion: NetworkExpansion = {
      extraClusters: 0,
      focus: { bucketId: BUCKET.big, pages: 1, revealedIds: ["big-20", "big-21"] },
    };
    const revealIds = ["big-21", "big-22", "big-22"];

    expect(withNetworkFocus({ bucketId: BUCKET.big, expansion, revealIds }).focus).toEqual({
      bucketId: BUCKET.big,
      pages: 1,
      revealedIds: ["big-20", "big-21", "big-22"],
    });
  });
});

describe("toNetworkLinkExplore", () => {
  it.each([
    { bucketId: BUCKET.north, revealIds: ["north-02", "north-01"] },
    { bucketId: BUCKET.south, revealIds: ["south-01", "south-02"] },
  ])("focuses $bucketId as the explored end and reveals its members paired across", (row) => {
    const index = indexOf(EXPLORE);

    expect(
      toNetworkLinkExplore({ bucketId: row.bucketId, index, link: onlyLinkOf(index) }),
    ).toEqual(row);
  });

  it("explores nothing from a group that is not an end of the link", () => {
    const index = indexOf(
      groupedGraph({
        edges: [relation("north-01", "south-01"), relation("north-01", "other-01")],
        memberIds: ["north-01", "other-01", "south-01"],
      }),
    );
    const link = index.bucketLinks.find(
      (candidate) => candidate.sourceId === BUCKET.north && candidate.targetId === BUCKET.south,
    );

    expect(link && toNetworkLinkExplore({ bucketId: BUCKET.other, index, link })).toBeNull();
  });

  it("reveals at most twelve members", () => {
    const index = indexOf(
      groupedGraph({
        edges: numbered("north-", 1, 14).map((id) => relation(id, "south-01")),
        memberIds: [...numbered("north-", 1, 14), "south-01"],
      }),
    );

    expect(
      toNetworkLinkExplore({ bucketId: BUCKET.north, index, link: onlyLinkOf(index) }),
    ).toEqual({
      bucketId: BUCKET.north,
      revealIds: numbered("north-", 1, 12),
    });
  });

  it("focuses the group end of a member link and reveals members paired with that member", () => {
    const index = indexOf(EXPLORE);
    const scene = buildNetworkScene({
      expansion: EMPTY_NETWORK_EXPANSION,
      focusBucketId: BUCKET.north,
      index,
    });
    const link = scene.links.find((candidate) =>
      [candidate.sourceId, candidate.targetId].includes("north-01"),
    );

    expect(link && toNetworkLinkExplore({ bucketId: BUCKET.south, index, link })).toEqual({
      bucketId: BUCKET.south,
      revealIds: ["south-01"],
    });
  });
});

describe("summarizeNetworkLink", () => {
  it("breaks a link down by category and leaves masked relations out of the counts", () => {
    const index = indexOf(
      groupedGraph({
        edges: [
          relation("north-01", "south-01"),
          relation("north-02", "south-02"),
          relation("north-01", "south-02", { category: "social", type: "friend_of" }),
          relation("south-01", "north-01", { type: null, typeHidden: true }),
        ],
        memberIds: ["north-01", "north-02", "south-01", "south-02"],
      }),
    );

    expect(summarizeNetworkLink({ index, link: onlyLinkOf(index) })).toEqual({
      categories: [
        { category: "family", count: 2 },
        { category: "social", count: 1 },
      ],
      hasMaskedDetails: true,
    });
  });

  it("reports no masked details when every relation is visible", () => {
    const index = indexOf(
      groupedGraph({
        edges: [relation("north-01", "south-01"), relation("north-02", "south-02")],
        memberIds: ["north-01", "north-02", "south-01", "south-02"],
      }),
    );

    expect(summarizeNetworkLink({ index, link: onlyLinkOf(index) })).toEqual({
      categories: [{ category: "family", count: 2 }],
      hasMaskedDetails: false,
    });
  });
});

function focusing(bucketId: string, revealIds: readonly string[] = []): NetworkExpansion {
  return withNetworkFocus({ bucketId, expansion: EMPTY_NETWORK_EXPANSION, revealIds });
}

function focusOf({
  bucketId,
  expansion = EMPTY_NETWORK_EXPANSION,
  graph,
}: {
  bucketId: string;
  expansion?: NetworkExpansion;
  graph: CharacterGraphView;
}): FocusScene {
  const scene = buildNetworkScene({ expansion, focusBucketId: bucketId, index: indexOf(graph) });
  if (scene.kind !== "focus") throw new Error(`no focus scene for ${bucketId}`);
  return scene;
}

function groupedGraph({
  edges,
  memberIds,
  ungroupedIds = [],
}: {
  edges: CharacterGraphEdgeView[];
  memberIds: readonly string[];
  ungroupedIds?: readonly string[];
}): CharacterGraphView {
  const groupIds = [...new Set(memberIds.map(groupOf))];
  return makeRelationshipGraph({
    clusters: groupIds.map((id): CharacterGraphClusterView => ({
      groupType: "family",
      id,
      kind: "group",
      name: id,
      size: 1,
    })),
    edges,
    nodes: [
      ...memberIds.map((id) => makeRelationshipGraphNode({ clusterId: groupOf(id), id })),
      ...ungroupedIds.map((id) => makeRelationshipGraphNode({ clusterId: null, id })),
    ],
  });
}

function groupOf(memberId: string): string {
  return memberId.slice(0, memberId.lastIndexOf("-"));
}

function indexOf(graph: CharacterGraphView): NetworkIndex {
  return buildNetworkIndex({ graph, grouping: "group" });
}

function membersOf(scene: FocusScene) {
  return {
    hasMoreMembers: scene.hasMoreMembers,
    hiddenMemberCount: scene.hiddenMemberCount,
    memberIds: scene.memberIds,
  };
}

function numbered(prefix: string, first: number, last: number): string[] {
  return Array.from(
    { length: last - first + 1 },
    (_, offset) => `${prefix}${String(first + offset).padStart(2, "0")}`,
  );
}

function onlyLinkOf(index: NetworkIndex): NetworkAggregateLink {
  const [link] = index.bucketLinks;
  if (link === undefined || index.bucketLinks.length > 1) throw new Error("expected one link");
  return link;
}

function overviewOf({
  extraClusters,
  graph,
}: {
  extraClusters: number;
  graph: CharacterGraphView;
}): OverviewScene {
  const scene = buildNetworkScene({
    expansion: { ...EMPTY_NETWORK_EXPANSION, extraClusters },
    focusBucketId: null,
    index: indexOf(graph),
  });
  if (scene.kind !== "overview") throw new Error("no overview scene");
  return scene;
}

function relation(
  source: string,
  target: string,
  overrides: Partial<CharacterGraphEdgeView> = {},
): CharacterGraphEdgeView {
  const id = `edge:${source}:${target}`;

  return makeRelationshipGraphEdge({ id, source, target, ...overrides });
}

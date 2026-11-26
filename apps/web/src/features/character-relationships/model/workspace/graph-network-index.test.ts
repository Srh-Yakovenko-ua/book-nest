import type {
  BookCharacterImportance,
  CharacterGraphClusterView,
  CharacterGraphEdgeView,
  CharacterGraphNodeView,
  CharacterGraphView,
  Nullable,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { NetworkGrouping } from "./graph-workspace-params";

import {
  makeRelationshipGraph,
  makeRelationshipGraphEdge,
  makeRelationshipGraphNode,
} from "../relationships.fixtures";
import { buildNetworkIndex, toNetworkBucketId } from "./graph-network-index";
import { NETWORK_GROUPINGS } from "./graph-workspace-params";

const IMPORTANCE_CLUSTER: CharacterGraphClusterView = {
  id: "importance-major",
  importance: "major",
  kind: "importance",
  size: 1,
};

const SHOUTING_GROUP = "F2F2F2F2-0000-4000-8000-00000000000A";

const MIXED_CASE = makeRelationshipGraph({
  clusters: [group(SHOUTING_GROUP)],
  edges: [relation("AB-1", "AB-2")],
  nodes: [
    character("AB-1", { clusterId: SHOUTING_GROUP, importance: "central" }),
    character("AB-2", { importance: "not_specified" }),
    character("CD-1", { importance: null }),
  ],
});

const TWO_GROUPS = makeRelationshipGraph({
  clusters: [group("north"), group("south")],
  edges: [
    relation("north-01", "south-01"),
    relation("south-01", "north-01"),
    relation("north-02", "south-02"),
    relation("north-01", "north-02"),
  ],
  nodes: [
    character("north-01", { clusterId: "north" }),
    character("north-02", { clusterId: "north" }),
    character("south-01", { clusterId: "south" }),
    character("south-02", { clusterId: "south" }),
  ],
});

describe("buildNetworkIndex by group", () => {
  it("makes a bucket per named group and one for characters without a group", () => {
    const index = indexOf(
      makeRelationshipGraph({
        clusters: [group("north", "Kaer Morhen"), group("south", "Vengerberg"), IMPORTANCE_CLUSTER],
        edges: [],
        nodes: [
          character("north-01", { clusterId: "north" }),
          character("north-02", { clusterId: "north" }),
          character("south-01", { clusterId: "south" }),
          character("loner", { clusterId: null }),
          character("stray", { clusterId: IMPORTANCE_CLUSTER.id }),
        ],
      }),
    );

    expect(index.buckets).toEqual([
      {
        id: "cluster:group:none",
        key: "none",
        label: { kind: "ungrouped" },
        memberIds: ["loner", "stray"],
      },
      {
        id: "cluster:group:north",
        key: "north",
        label: { kind: "group", name: "Kaer Morhen" },
        memberIds: ["north-01", "north-02"],
      },
      {
        id: "cluster:group:south",
        key: "south",
        label: { kind: "group", name: "Vengerberg" },
        memberIds: ["south-01"],
      },
    ]);
  });

  it("lowercases the group id into the bucket key", () => {
    const index = indexOf(
      makeRelationshipGraph({
        clusters: [group(SHOUTING_GROUP)],
        edges: [],
        nodes: [character("north-01", { clusterId: SHOUTING_GROUP })],
      }),
    );

    expect({
      bucketId: index.bucketIdByNodeId.get("north-01"),
      keys: index.buckets.map((bucket) => bucket.key),
    }).toEqual({
      bucketId: "cluster:group:f2f2f2f2-0000-4000-8000-00000000000a",
      keys: ["f2f2f2f2-0000-4000-8000-00000000000a"],
    });
  });

  it("falls back to connected fragments when the graph has no named group", () => {
    const index = indexOf(
      makeRelationshipGraph({
        clusters: [IMPORTANCE_CLUSTER],
        edges: [relation("ann", "bob")],
        nodes: [character("ann", { clusterId: IMPORTANCE_CLUSTER.id }), character("bob")],
      }),
    );

    expect({
      bucketIds: index.buckets.map((bucket) => bucket.id),
      effectiveGrouping: index.effectiveGrouping,
      grouping: index.grouping,
      usedFallback: index.usedFallback,
    }).toEqual({
      bucketIds: ["cluster:components:ann"],
      effectiveGrouping: "components",
      grouping: "group",
      usedFallback: true,
    });
  });

  it.each<{ graph: CharacterGraphView; grouping: NetworkGrouping }>([
    { graph: TWO_GROUPS, grouping: "group" },
    { graph: makeRelationshipGraph(), grouping: "components" },
    { graph: makeRelationshipGraph(), grouping: "importance" },
  ])("keeps the $grouping grouping it was asked for", ({ graph, grouping }) => {
    const { effectiveGrouping, usedFallback } = indexOf(graph, grouping);

    expect({ effectiveGrouping, usedFallback }).toEqual({
      effectiveGrouping: grouping,
      usedFallback: false,
    });
  });
});

describe("buildNetworkIndex by fragment", () => {
  it("numbers the connected fragments from the largest and keys each by its anchor", () => {
    const index = indexOf(
      makeRelationshipGraph({
        clusters: [],
        edges: [relation("c3", "c2"), relation("c2", "c1"), relation("d2", "d1")],
        nodes: ["c1", "c2", "c3", "d1", "d2", "e1"].map((id) => character(id)),
      }),
      "components",
    );

    expect(index.buckets.map(({ id, key, label }) => ({ id, key, label }))).toEqual([
      { id: "cluster:components:c1", key: "c1", label: { index: 1, kind: "fragment" } },
      { id: "cluster:components:d1", key: "d1", label: { index: 2, kind: "fragment" } },
      { id: "cluster:components:e1", key: "e1", label: { index: 3, kind: "fragment" } },
    ]);
  });

  it("lowercases the fragment anchor into the bucket key", () => {
    const index = indexOf(
      makeRelationshipGraph({
        clusters: [],
        edges: [relation("AB-1", "AB-2")],
        nodes: [character("AB-1"), character("AB-2")],
      }),
      "components",
    );

    expect(index.buckets.map(({ id, key }) => ({ id, key }))).toEqual([
      { id: "cluster:components:ab-1", key: "ab-1" },
    ]);
  });
});

describe("buildNetworkIndex by importance", () => {
  it("makes a bucket per importance and one for characters without importance", () => {
    const graph = graphOfImportances(["central", "major", null, "central", "not_specified"]);
    const index = indexOf(graph, "importance");

    expect(index.buckets.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: "central", label: { importance: "central", kind: "importance" } },
      { key: "major", label: { importance: "major", kind: "importance" } },
      { key: "not_specified", label: { importance: "not_specified", kind: "importance" } },
      { key: "unassigned", label: { importance: null, kind: "importance" } },
    ]);
  });

  it.each<{
    expected: boolean;
    grouping: NetworkGrouping;
    importances: Nullable<BookCharacterImportance>[];
    label: string;
  }>([
    {
      expected: true,
      grouping: "importance",
      importances: [null, "not_specified"],
      label: "no character has a known importance",
    },
    {
      expected: false,
      grouping: "importance",
      importances: [null, "major"],
      label: "one character has a known importance",
    },
    {
      expected: false,
      grouping: "group",
      importances: [null, null],
      label: "the map is grouped otherwise",
    },
    { expected: false, grouping: "importance", importances: [], label: "the map is empty" },
  ])("reports unknown importance as $expected when $label", (row) => {
    const index = indexOf(graphOfImportances(row.importances), row.grouping);

    expect(index.isImportanceUnknown).toBe(row.expected);
  });
});

describe("buildNetworkIndex single fragment", () => {
  it.each<{
    edges: CharacterGraphEdgeView[];
    expected: boolean;
    grouping: NetworkGrouping;
    label: string;
  }>([
    {
      edges: [relation("ann", "bob"), relation("bob", "cid")],
      expected: true,
      grouping: "components",
      label: "every character is connected",
    },
    {
      edges: [relation("ann", "bob")],
      expected: false,
      grouping: "components",
      label: "a character stands apart",
    },
    {
      edges: [relation("ann", "bob"), relation("bob", "cid")],
      expected: false,
      grouping: "group",
      label: "the map is grouped by one named group",
    },
  ])("reports a single fragment as $expected when $label", ({ edges, expected, grouping }) => {
    const graph = makeRelationshipGraph({
      clusters: [group("north")],
      edges,
      nodes: ["ann", "bob", "cid"].map((id) => character(id, { clusterId: "north" })),
    });

    expect(indexOf(graph, grouping).isSingleComponent).toBe(expected);
  });
});

describe("buildNetworkIndex aggregates", () => {
  it("counts relation records and character pairs of a group link separately", () => {
    expect(indexOf(TWO_GROUPS).bucketLinks).toEqual([
      {
        connectionIds: ["pair:north-01:south-01", "pair:north-02:south-02"],
        edgeCount: 3,
        id: "aggregate:cluster:group:north:cluster:group:south",
        pairCount: 2,
        sourceId: "cluster:group:north",
        targetId: "cluster:group:south",
      },
    ]);
  });

  it("counts a masked relation as one more record of its pair", () => {
    const masked = relation("south-02", "north-02", {
      category: null,
      type: null,
      typeHidden: true,
    });
    const index = indexOf({ ...TWO_GROUPS, edges: [...TWO_GROUPS.edges, masked] });
    const counts = index.bucketLinks.map(({ edgeCount, pairCount }) => ({ edgeCount, pairCount }));

    expect(counts).toEqual([{ edgeCount: 4, pairCount: 2 }]);
  });

  it("totals the characters, groups, pairs and relation records of the response", () => {
    const { totals } = indexOf(TWO_GROUPS);

    expect(totals).toEqual({ characters: 4, groups: 2, pairs: 3, relations: 4 });
  });

  it("takes no count from the degrees and hidden-content flags of the response", () => {
    const graph: CharacterGraphView = {
      ...TWO_GROUPS,
      hiddenContent: { hasHiddenEdges: true, hasLockedEdges: true, truncated: true },
      nodes: TWO_GROUPS.nodes.map((node) => ({ ...node, degree: 40 })),
    };

    expect(indexOf(graph).totals).toEqual({ characters: 4, groups: 2, pairs: 3, relations: 4 });
  });

  it("summarizes the pairs inside each group and towards other groups", () => {
    const index = indexOf(
      makeRelationshipGraph({
        clusters: [group("east"), group("north"), group("south")],
        edges: [
          relation("north-01", "north-02"),
          relation("north-01", "south-01"),
          relation("north-02", "south-01"),
          relation("north-01", "east-01"),
        ],
        nodes: [
          character("north-01", { clusterId: "north" }),
          character("north-02", { clusterId: "north" }),
          character("south-01", { clusterId: "south" }),
          character("east-01", { clusterId: "east" }),
        ],
      }),
    );

    expect(Object.fromEntries(index.summaryByBucketId)).toEqual({
      "cluster:group:east": { externalPairCount: 1, internalPairCount: 0, linkedBucketCount: 1 },
      "cluster:group:north": { externalPairCount: 3, internalPairCount: 1, linkedBucketCount: 2 },
      "cluster:group:south": { externalPairCount: 2, internalPairCount: 0, linkedBucketCount: 1 },
    });
  });
});

describe("buildNetworkIndex member priority", () => {
  it("orders members by pairs, then pairs to other groups, then display name, then id", () => {
    const index = indexOf(
      makeRelationshipGraph({
        clusters: [group("north"), group("south")],
        edges: [
          relation("north-7", "north-4"),
          relation("north-7", "north-3"),
          relation("north-7", "north-1"),
          relation("north-6", "south-1"),
          relation("north-6", "south-2"),
          relation("north-5", "north-2"),
          relation("north-5", "south-1"),
        ],
        nodes: [
          character("north-1", { clusterId: "north", displayName: "Zoltan", name: "Zoltan" }),
          character("north-2", { clusterId: "north", displayName: "Zoltan", name: "Zoltan" }),
          character("north-3", { clusterId: "north", displayName: "Borch", name: "Alpha" }),
          character("north-4", { clusterId: "north", displayName: "Aard", name: "Zeta" }),
          character("north-5", { clusterId: "north" }),
          character("north-6", { clusterId: "north" }),
          character("north-7", { clusterId: "north" }),
          character("south-1", { clusterId: "south" }),
          character("south-2", { clusterId: "south" }),
        ],
      }),
    );

    expect(index.bucketById.get("cluster:group:north")?.memberIds).toEqual([
      "north-7",
      "north-6",
      "north-5",
      "north-4",
      "north-3",
      "north-1",
      "north-2",
    ]);
  });

  it("ranks members by the pairs of the response, not by the degree it reports", () => {
    const index = indexOf(
      makeRelationshipGraph({
        clusters: [group("north")],
        edges: [relation("north-2", "north-3"), relation("north-2", "north-1")],
        nodes: [
          character("north-1", { clusterId: "north", degree: 40 }),
          character("north-2", { clusterId: "north", degree: 2 }),
          character("north-3", { clusterId: "north", degree: 1 }),
        ],
      }),
    );

    expect(index.buckets[0]?.memberIds).toEqual(["north-2", "north-1", "north-3"]);
  });
});

describe("toNetworkBucketId", () => {
  it("joins the grouping and the key into the bucket id", () => {
    expect(toNetworkBucketId({ grouping: "importance", key: "unassigned" })).toBe(
      "cluster:importance:unassigned",
    );
  });

  it.each(NETWORK_GROUPINGS)("finds every %s bucket again from its key", (grouping) => {
    const index = indexOf(MIXED_CASE, grouping);
    const bucketIds = index.buckets.map((bucket) =>
      toNetworkBucketId({ grouping: index.effectiveGrouping, key: bucket.key }),
    );

    expect(bucketIds).toEqual(index.buckets.map((bucket) => bucket.id));
  });

  it.each(NETWORK_GROUPINGS)("keys every %s bucket with a value the URL accepts", (grouping) => {
    const keys = indexOf(MIXED_CASE, grouping).buckets.map((bucket) => bucket.key);

    expect(keys).toEqual(keys.map(() => expect.stringMatching(/^[a-z0-9_-]{1,64}$/)));
  });
});

function character(
  id: string,
  overrides: Partial<CharacterGraphNodeView> = {},
): CharacterGraphNodeView {
  return makeRelationshipGraphNode({ id, ...overrides });
}

function graphOfImportances(
  importances: readonly Nullable<BookCharacterImportance>[],
): CharacterGraphView {
  return makeRelationshipGraph({
    clusters: [],
    edges: [],
    nodes: importances.map((importance, position) =>
      character(`person-${position + 1}`, { importance }),
    ),
  });
}

function group(id: string, name = id): CharacterGraphClusterView {
  return { groupType: "family", id, kind: "group", name, size: 1 };
}

function indexOf(graph: CharacterGraphView, grouping: NetworkGrouping = "group") {
  return buildNetworkIndex({ graph, grouping });
}

function relation(
  source: string,
  target: string,
  overrides: Partial<CharacterGraphEdgeView> = {},
): CharacterGraphEdgeView {
  const id = `edge:${source}:${target}`;

  return makeRelationshipGraphEdge({ id, source, target, ...overrides });
}

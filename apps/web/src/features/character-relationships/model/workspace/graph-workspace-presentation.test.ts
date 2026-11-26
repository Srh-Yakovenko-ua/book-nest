import type {
  BookFamilyTreeView,
  CharacterGraphClusterView,
  CharacterGraphHiddenContentView,
  CharacterGraphView,
  FamilyTreeGraphView,
  FamilyTreeLineageView,
  Nullable,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GenealogyExpansion } from "./graph-genealogy-scene";
import type { NetworkExpansion, NetworkScene } from "./graph-network-scene";
import type { TreeOptions } from "./graph-tree-scene";
import type {
  GraphWorkspaceParams,
  GraphWorkspaceView,
  NetworkGrouping,
} from "./graph-workspace-params";
import type {
  GraphPresentationEmpty,
  GraphPresentationNotice,
} from "./graph-workspace-presentation";

import {
  makeRelationshipGraph,
  makeRelationshipGraphEdge,
  makeRelationshipGraphNode,
} from "../relationships.fixtures";
import { EMPTY_GENEALOGY_EXPANSION } from "./graph-genealogy-scene";
import { EMPTY_NETWORK_EXPANSION } from "./graph-network-scene";
import { EMPTY_PERSON_EXPANSION } from "./graph-person-scene";
import { TREE_SCENE } from "./graph-tree-scene";
import { buildGraphWorkspacePresentation } from "./graph-workspace-presentation";

const CHARACTER = {
  ciri: "c1c1c1c1-0000-4000-8000-000000000001",
  geralt: "9e9e9e9e-0000-4000-8000-000000000002",
  strangerFirst: "a4a4a4a4-0000-4000-8000-000000000001",
  strangerSecond: "a4a4a4a4-0000-4000-8000-000000000002",
  yennefer: "e1e1e1e1-0000-4000-8000-000000000003",
} as const;

const GROUP = {
  shouting: "F1F1F1F1-0000-4000-8000-00000000000A",
} as const;

const RELATIONSHIP = {
  ciriToGeralt: "e2e2e2e2-0000-4000-8000-000000000002",
  geraltToCiri: "e1e1e1e1-0000-4000-8000-000000000001",
  geraltToYennefer: "e3e3e3e3-0000-4000-8000-000000000003",
  strangers: "e4e4e4e4-0000-4000-8000-000000000004",
} as const;

const DEFAULT_PARAMS: GraphWorkspaceParams = {
  categories: [],
  characterId: null,
  depth: 1,
  from: null,
  networkFocus: null,
  networkGroup: "group",
  path: false,
  to: null,
  treeDown: 2,
  treeLinks: ["marriages", "siblings", "guardians", "distant"],
  treeScope: "branch",
  treeUp: 2,
  types: [],
  view: "person",
};

const PERSON_PARAMS: GraphWorkspaceParams = { ...DEFAULT_PARAMS, characterId: CHARACTER.geralt };

const NETWORK_PARAMS: GraphWorkspaceParams = { ...DEFAULT_PARAMS, view: "network" };

const PERSON_GRAPH = makeRelationshipGraph({
  edges: [
    makeRelationshipGraphEdge({
      id: RELATIONSHIP.geraltToCiri,
      source: CHARACTER.geralt,
      target: CHARACTER.ciri,
    }),
    makeRelationshipGraphEdge({
      id: RELATIONSHIP.ciriToGeralt,
      source: CHARACTER.ciri,
      target: CHARACTER.geralt,
    }),
    makeRelationshipGraphEdge({
      id: RELATIONSHIP.geraltToYennefer,
      source: CHARACTER.geralt,
      target: CHARACTER.yennefer,
    }),
    makeRelationshipGraphEdge({
      id: RELATIONSHIP.strangers,
      source: CHARACTER.strangerFirst,
      target: CHARACTER.strangerSecond,
    }),
  ],
  nodes: Object.values(CHARACTER).map((id) => makeRelationshipGraphNode({ id })),
});

const LONE_GRAPH = makeRelationshipGraph({
  edges: [],
  nodes: [makeRelationshipGraphNode({ id: CHARACTER.geralt })],
});

const OVERVIEW_GRAPH = makeGroupedGraph({
  links: [
    ["g01-01", "g02-01"],
    ["g02-01", "g01-01"],
    ["g01-01", "g03-01"],
  ],
  memberIds: numbered("g", 1, 14).map((groupId) => `${groupId}-01`),
});

const FOCUS_PARTNER_IDS = [
  ...numbered("north-", 2, 14),
  ...numbered("s", 1, 11).map((groupId) => `${groupId}-01`),
];

const FOCUS_GRAPH = makeGroupedGraph({
  links: FOCUS_PARTNER_IDS.map((id): [string, string] => ["north-01", id]),
  memberIds: ["north-01", ...FOCUS_PARTNER_IDS],
});

const UNRANKED_GRAPH = makeRelationshipGraph({
  nodes: [
    makeRelationshipGraphNode({ id: CHARACTER.geralt, importance: null }),
    makeRelationshipGraphNode({ id: CHARACTER.ciri, importance: "not_specified" }),
  ],
});

const KIN = {
  child: "d1d1d1d1-0000-4000-8000-000000000001",
  parent: "d1d1d1d1-0000-4000-8000-000000000002",
  root: "d1d1d1d1-0000-4000-8000-000000000003",
  spouse: "d1d1d1d1-0000-4000-8000-000000000004",
} as const;

const KIN_EDGE = {
  child: makeRelationshipGraphEdge({
    id: "d2d2d2d2-0000-4000-8000-000000000001",
    source: KIN.root,
    target: KIN.child,
    type: "biological_parent_of",
  }),
  guardian: makeRelationshipGraphEdge({
    id: "d2d2d2d2-0000-4000-8000-000000000002",
    source: KIN.parent,
    target: KIN.root,
    type: "guardian_of",
  }),
  parent: makeRelationshipGraphEdge({
    id: "d2d2d2d2-0000-4000-8000-000000000003",
    source: KIN.parent,
    target: KIN.root,
    type: "biological_parent_of",
  }),
  spouse: makeRelationshipGraphEdge({
    directionality: "symmetric",
    id: "d2d2d2d2-0000-4000-8000-000000000004",
    source: KIN.root,
    target: KIN.spouse,
    type: "spouse_of",
  }),
};

const KIN_LINK = {
  child: {
    childId: KIN.child,
    kind: "biological",
    parentId: KIN.root,
    relationshipId: KIN_EDGE.child.id,
  },
  parent: {
    childId: KIN.root,
    kind: "biological",
    parentId: KIN.parent,
    relationshipId: KIN_EDGE.parent.id,
  },
} satisfies Record<string, FamilyTreeLineageView>;

const LINE = {
  child: "b5b5b5b5-0000-4000-8000-000000000002",
  founder: "b5b5b5b5-0000-4000-8000-000000000001",
  grandchild: "b5b5b5b5-0000-4000-8000-000000000003",
  spouse: "b5b5b5b5-0000-4000-8000-000000000004",
} as const;

const OUTSIDER = {
  child: "c5c5c5c5-0000-4000-8000-000000000002",
  parent: "c5c5c5c5-0000-4000-8000-000000000001",
} as const;

const LINE_EDGE = {
  child: makeRelationshipGraphEdge({
    id: "b6b6b6b6-0000-4000-8000-000000000001",
    source: LINE.founder,
    target: LINE.child,
    type: "biological_parent_of",
  }),
  grandchild: makeRelationshipGraphEdge({
    id: "b6b6b6b6-0000-4000-8000-000000000002",
    source: LINE.child,
    target: LINE.grandchild,
    type: "biological_parent_of",
  }),
  guardian: makeRelationshipGraphEdge({
    id: "b6b6b6b6-0000-4000-8000-000000000003",
    source: LINE.founder,
    target: LINE.child,
    type: "guardian_of",
  }),
  outsider: makeRelationshipGraphEdge({
    id: "b6b6b6b6-0000-4000-8000-000000000004",
    source: OUTSIDER.parent,
    target: OUTSIDER.child,
    type: "biological_parent_of",
  }),
  spouse: makeRelationshipGraphEdge({
    directionality: "symmetric",
    id: "b6b6b6b6-0000-4000-8000-000000000005",
    source: LINE.child,
    target: LINE.spouse,
    type: "spouse_of",
  }),
};

const LINE_LINK = {
  child: {
    childId: LINE.child,
    kind: "biological",
    parentId: LINE.founder,
    relationshipId: LINE_EDGE.child.id,
  },
  grandchild: {
    childId: LINE.grandchild,
    kind: "biological",
    parentId: LINE.child,
    relationshipId: LINE_EDGE.grandchild.id,
  },
  outsider: {
    childId: OUTSIDER.child,
    kind: "biological",
    parentId: OUTSIDER.parent,
    relationshipId: LINE_EDGE.outsider.id,
  },
} satisfies Record<string, FamilyTreeLineageView>;

describe("buildGraphWorkspacePresentation", () => {
  it("counts the characters, raw relationships and character pairs of the person view", () => {
    const presentation = presentationFor({ graph: PERSON_GRAPH, params: PERSON_PARAMS });

    expect(presentation?.counters).toEqual({ edges: 3, kind: "person", nodes: 3, pairs: 2 });
  });

  it("places the person root at hop 0 and its direct neighbours at hop 1", () => {
    const characters = presentationFor({ graph: PERSON_GRAPH, params: PERSON_PARAMS })?.characters;

    expect({
      ciri: characters?.get(CHARACTER.ciri)?.hop,
      geralt: characters?.get(CHARACTER.geralt)?.hop,
      yennefer: characters?.get(CHARACTER.yennefer)?.hop,
    }).toEqual({ ciri: 1, geralt: 0, yennefer: 1 });
  });

  it("leaves the hop of network characters unset", () => {
    const presentation = presentationFor({
      graph: FOCUS_GRAPH,
      networkFocus: "north",
      params: NETWORK_PARAMS,
    });
    const hops = [...(presentation?.characters.values() ?? [])].map((character) => character.hop);

    expect(hops).toEqual(Array.from({ length: 12 }, () => null));
  });

  it("draws groups without characters or character pairs in the network overview", () => {
    const presentation = presentationFor({ graph: OVERVIEW_GRAPH, params: NETWORK_PARAMS });

    expect({
      characters: presentation?.characters.size,
      clusters: presentation?.clusters.size,
      connections: presentation?.connections,
      edges: presentation?.edges,
    }).toEqual({ characters: 0, clusters: 12, connections: [], edges: [] });
  });

  it("counts every received character, group, pair and relation next to the shown groups", () => {
    const presentation = presentationFor({ graph: OVERVIEW_GRAPH, params: NETWORK_PARAMS });

    expect(presentation?.counters).toEqual({
      characters: 14,
      groups: 14,
      kind: "networkOverview",
      pairs: 2,
      relations: 3,
      shownGroups: 12,
    });
  });

  it.each<{ extraClusters: number; hasMoreBuckets: boolean }>([
    { extraClusters: 0, hasMoreBuckets: true },
    { extraClusters: 1, hasMoreBuckets: false },
  ])("offers more groups as $hasMoreBuckets after $extraClusters extra pages", (row) => {
    const network = { ...EMPTY_NETWORK_EXPANSION, extraClusters: row.extraClusters };
    const scene = presentationFor({
      graph: OVERVIEW_GRAPH,
      network,
      params: NETWORK_PARAMS,
    })?.network?.scene;

    expect(scene).toMatchObject({ hasMoreBuckets: row.hasMoreBuckets, kind: "overview" });
  });

  it("counts relation records and character pairs of each group link separately", () => {
    const presentation = presentationFor({ graph: OVERVIEW_GRAPH, params: NETWORK_PARAMS });
    const aggregates = presentation?.aggregates.map(({ edgeCount, id, pairCount }) => ({
      edgeCount,
      id,
      pairCount,
    }));

    expect(aggregates).toEqual([
      { edgeCount: 2, id: "aggregate:cluster:group:g01:cluster:group:g02", pairCount: 1 },
      { edgeCount: 1, id: "aggregate:cluster:group:g01:cluster:group:g03", pairCount: 1 },
    ]);
  });

  it("counts the shown members and their pairs apart from the whole focused group", () => {
    const presentation = presentationFor({
      graph: FOCUS_GRAPH,
      networkFocus: "north",
      params: NETWORK_PARAMS,
    });

    expect(presentation?.counters).toEqual({
      kind: "networkFocus",
      members: 14,
      neighborGroups: 11,
      pairs: 11,
      shownMembers: 12,
    });
  });

  it("places every shown member and neighbour group of the focused group", () => {
    const presentation = presentationFor({
      graph: FOCUS_GRAPH,
      networkFocus: "north",
      params: NETWORK_PARAMS,
    });

    expect([...(presentation?.positions.keys() ?? [])].sort()).toEqual([
      ...numbered("cluster:group:s", 1, 10),
      ...numbered("north-", 1, 12),
    ]);
  });

  it.each<{
    focusMissing: boolean;
    kind: NetworkScene["kind"];
    label: string;
    networkFocus: Nullable<string>;
  }>([
    { focusMissing: false, kind: "focus", label: "a group on the map", networkFocus: "north" },
    {
      focusMissing: true,
      kind: "overview",
      label: "a group missing from the map",
      networkFocus: "missing",
    },
    { focusMissing: false, kind: "overview", label: "no group", networkFocus: null },
  ])("shows the network $kind for $label", ({ focusMissing, kind, networkFocus }) => {
    const presentation = presentationFor({
      graph: FOCUS_GRAPH,
      networkFocus,
      params: NETWORK_PARAMS,
    });

    expect({
      focusMissing: presentation?.network?.focusMissing,
      kind: presentation?.network?.scene.kind,
    }).toEqual({ focusMissing, kind });
  });

  it("focuses a group whose id arrives in upper case", () => {
    const cluster: CharacterGraphClusterView = {
      groupType: "family",
      id: GROUP.shouting,
      kind: "group",
      name: "Kaer Morhen",
      size: 2,
    };
    const graph = makeRelationshipGraph({
      clusters: [cluster],
      nodes: [CHARACTER.geralt, CHARACTER.ciri].map((id) =>
        makeRelationshipGraphNode({ clusterId: GROUP.shouting, id }),
      ),
    });
    const presentation = presentationFor({
      graph,
      networkFocus: "f1f1f1f1-0000-4000-8000-00000000000a",
      params: NETWORK_PARAMS,
    });

    expect(presentation?.network?.scene.kind).toBe("focus");
  });

  it("focuses a connected fragment when the network has no named group", () => {
    const presentation = presentationFor({
      graph: PERSON_GRAPH,
      networkFocus: CHARACTER.strangerFirst,
      params: NETWORK_PARAMS,
    });

    expect(presentation?.network?.scene).toMatchObject({
      kind: "focus",
      memberIds: [CHARACTER.strangerFirst, CHARACTER.strangerSecond],
    });
  });

  it.each<{
    graph: CharacterGraphView;
    label: string;
    networkGroup: NetworkGrouping;
    notices: GraphPresentationNotice[];
  }>([
    {
      graph: {
        ...OVERVIEW_GRAPH,
        hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: true },
      },
      label: "a truncated network",
      networkGroup: "group",
      notices: ["networkTruncated"],
    },
    {
      graph: {
        ...OVERVIEW_GRAPH,
        hiddenContent: { hasHiddenEdges: false, hasLockedEdges: true, truncated: false },
      },
      label: "a network with locked relationships",
      networkGroup: "group",
      notices: ["locked"],
    },
    {
      graph: PERSON_GRAPH,
      label: "a network without named groups",
      networkGroup: "group",
      notices: ["fallbackComponents"],
    },
    {
      graph: UNRANKED_GRAPH,
      label: "a network without known importance",
      networkGroup: "importance",
      notices: ["importanceUnknown"],
    },
    {
      graph: makeRelationshipGraph(),
      label: "a network of one fragment",
      networkGroup: "components",
      notices: ["singleComponent"],
    },
    {
      graph: OVERVIEW_GRAPH,
      label: "a complete grouped network",
      networkGroup: "group",
      notices: [],
    },
  ])("shows the network notices for $label", ({ graph, networkGroup, notices }) => {
    const params = { ...NETWORK_PARAMS, networkGroup };

    expect(presentationFor({ graph, params })?.notices).toEqual(notices);
  });

  it.each<{
    empty: GraphPresentationEmpty;
    filters: Pick<GraphWorkspaceParams, "categories" | "types">;
    view: GraphWorkspaceView;
  }>([
    { empty: "filteredEmpty", filters: { categories: ["social"], types: [] }, view: "person" },
    { empty: "filteredEmpty", filters: { categories: [], types: ["friend_of"] }, view: "network" },
    { empty: "noRelations", filters: { categories: [], types: [] }, view: "person" },
    { empty: "networkEmpty", filters: { categories: [], types: [] }, view: "network" },
  ])("explains an empty $view map as $empty", ({ empty, filters, view }) => {
    const params = { ...PERSON_PARAMS, ...filters, view };

    expect(presentationFor({ graph: LONE_GRAPH, params })?.empty).toBe(empty);
  });

  it("explains nothing when the map has relationships", () => {
    const presentation = presentationFor({ graph: PERSON_GRAPH, params: PERSON_PARAMS });

    expect(presentation?.empty).toBeNull();
  });

  it.each<{
    hiddenContent: CharacterGraphHiddenContentView;
    label: string;
    notices: GraphPresentationNotice[];
  }>([
    {
      hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: true },
      label: "a truncated graph",
      notices: ["truncated"],
    },
    {
      hiddenContent: { hasHiddenEdges: false, hasLockedEdges: true, truncated: false },
      label: "locked relationships",
      notices: ["locked"],
    },
    {
      hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: false },
      label: "a complete graph",
      notices: [],
    },
  ])("shows the notices for $label", ({ hiddenContent, notices }) => {
    const graph = { ...PERSON_GRAPH, hiddenContent };

    expect(presentationFor({ graph, params: PERSON_PARAMS })?.notices).toEqual(notices);
  });

  it.each<GraphWorkspaceView>(["person", "network"])(
    "carries no family tree in the %s view",
    (view) => {
      const params = { ...PERSON_PARAMS, view };

      expect(presentationFor({ graph: PERSON_GRAPH, params })?.tree).toBeNull();
    },
  );
});

describe("buildGraphWorkspacePresentation for the family tree", () => {
  it("counts characters, character pairs and individual relationships separately", () => {
    const presentation = treePresentationFor(
      makeTree({
        edges: [KIN_EDGE.parent, KIN_EDGE.guardian, KIN_EDGE.spouse],
        lineage: [KIN_LINK.parent],
      }),
    );

    expect(presentation?.counters).toEqual({ edges: 3, kind: "tree", nodes: 3, pairs: 2 });
  });

  it("carries the family tree scene rooted at the focus character", () => {
    const presentation = treePresentationFor(
      makeTree({ edges: [KIN_EDGE.parent], lineage: [KIN_LINK.parent] }),
    );

    expect(presentation?.tree?.scene.rootId).toBe(KIN.root);
  });

  it("explains a tree with only its root as treeRootOnly", () => {
    const presentation = treePresentationFor(makeTree({ edges: [], lineage: [] }));

    expect(presentation?.empty).toBe("treeRootOnly");
  });

  it("tells hidden relatives apart from missing ones when the options hide every link", () => {
    const presentation = treePresentationFor(makeTree({ edges: [KIN_EDGE.spouse], lineage: [] }), {
      ...TREE_SCENE.defaultOptions,
      marriages: false,
    });

    expect(presentation?.empty).toBe("treeFiltered");
    expect(presentation?.counters).toEqual({ edges: 0, kind: "tree", nodes: 1, pairs: 0 });
  });

  it.each<{ label: string; notices: GraphPresentationNotice[]; tree: FamilyTreeGraphView }>([
    {
      label: "a truncated tree",
      notices: ["treeTruncated"],
      tree: makeTree({
        hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: true },
      }),
    },
    {
      label: "a spouse without any lineage",
      notices: ["noAncestry"],
      tree: makeTree({ edges: [KIN_EDGE.spouse], lineage: [] }),
    },
    {
      label: "fewer ancestors than requested",
      notices: ["treeFewerAncestors"],
      tree: makeTree({ ancestors: 3 }),
    },
    {
      label: "a tree that reaches as far as requested",
      notices: [],
      tree: makeTree(),
    },
  ])("shows the tree notices for $label", ({ notices, tree }) => {
    expect(treePresentationFor(tree)?.notices).toEqual(notices);
  });
});

describe("buildGraphWorkspacePresentation for the whole genealogy", () => {
  it("counts characters, generations, character pairs and individual relationships", () => {
    expect(genealogyPresentationFor(makeGenealogy())?.counters).toEqual({
      edges: 4,
      generations: 3,
      kind: "genealogy",
      nodes: 4,
      pairs: 3,
    });
  });

  it("carries the genealogy scene with no root and no branch tree", () => {
    const presentation = genealogyPresentationFor(makeGenealogy());

    expect({
      genealogyNodes: presentation?.genealogy?.scene.nodes.length,
      rootId: presentation?.rootId,
      tree: presentation?.tree,
    }).toEqual({ genealogyNodes: 4, rootId: null, tree: null });
  });

  it("explains a genealogy without relationships as genealogyEmpty", () => {
    const presentation = genealogyPresentationFor(makeGenealogy({ edges: [], lineage: [] }));

    expect(presentation?.empty).toBe("genealogyEmpty");
  });

  it.each<{
    expansion: GenealogyExpansion;
    genealogy: BookFamilyTreeView;
    label: string;
    notices: GraphPresentationNotice[];
  }>([
    {
      expansion: EMPTY_GENEALOGY_EXPANSION,
      genealogy: makeGenealogy({
        edges: [LINE_EDGE.child, LINE_EDGE.grandchild, LINE_EDGE.outsider],
        lineage: [LINE_LINK.child, LINE_LINK.grandchild, LINE_LINK.outsider],
      }),
      label: "two unrelated families",
      notices: ["genealogyComponents"],
    },
    {
      expansion: EMPTY_GENEALOGY_EXPANSION,
      genealogy: makeGenealogy({
        hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: true },
      }),
      label: "a truncated genealogy",
      notices: ["genealogyTruncated"],
    },
    {
      expansion: { collapsedIds: new Set([LINE.child]) },
      genealogy: makeGenealogy(),
      label: "a collapsed branch",
      notices: ["genealogyCollapsed"],
    },
    {
      expansion: EMPTY_GENEALOGY_EXPANSION,
      genealogy: makeGenealogy(),
      label: "one complete family",
      notices: [],
    },
  ])("shows the genealogy notices for $label", ({ expansion, genealogy, notices }) => {
    expect(genealogyPresentationFor(genealogy, expansion)?.notices).toEqual(notices);
  });
});

function genealogyPresentationFor(
  genealogy: BookFamilyTreeView,
  expansion: GenealogyExpansion = EMPTY_GENEALOGY_EXPANSION,
) {
  return buildGraphWorkspacePresentation({
    data: { genealogy, kind: "genealogy" },
    genealogy: expansion,
    network: EMPTY_NETWORK_EXPANSION,
    networkFocus: null,
    params: { ...DEFAULT_PARAMS, treeScope: "full", view: "tree" },
    person: EMPTY_PERSON_EXPANSION,
    treeOptions: TREE_SCENE.defaultOptions,
  });
}

function makeGenealogy(overrides: Partial<BookFamilyTreeView> = {}): BookFamilyTreeView {
  return {
    diagnostics: [],
    edges: [LINE_EDGE.child, LINE_EDGE.guardian, LINE_EDGE.grandchild, LINE_EDGE.spouse],
    graphVersion: "genealogy-v1",
    hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: false },
    houses: [],
    lineage: [LINE_LINK.child, LINE_LINK.grandchild],
    nodes: [...Object.values(LINE), ...Object.values(OUTSIDER)].map((id) =>
      makeRelationshipGraphNode({ id }),
    ),
    scope: "book",
    updatedAt: null,
    ...overrides,
  };
}

function makeGroupedGraph({
  links,
  memberIds,
}: {
  links: readonly (readonly [string, string])[];
  memberIds: readonly string[];
}): CharacterGraphView {
  const groupOf = (id: string) => id.slice(0, id.lastIndexOf("-"));
  return makeRelationshipGraph({
    clusters: [...new Set(memberIds.map(groupOf))].map((id): CharacterGraphClusterView => ({
      groupType: "family",
      id,
      kind: "group",
      name: id,
      size: 1,
    })),
    edges: links.map(([source, target]) =>
      makeRelationshipGraphEdge({ id: `edge:${source}:${target}`, source, target }),
    ),
    nodes: memberIds.map((id) => makeRelationshipGraphNode({ clusterId: groupOf(id), id })),
  });
}

function makeTree(overrides: Partial<FamilyTreeGraphView> = {}): FamilyTreeGraphView {
  return {
    ancestors: 1,
    descendants: 1,
    diagnostics: [],
    edges: [KIN_EDGE.parent, KIN_EDGE.child],
    focusCharacterId: KIN.root,
    graphVersion: "tree-v1",
    hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: false },
    lineage: [KIN_LINK.parent, KIN_LINK.child],
    nodes: Object.values(KIN).map((id) => makeRelationshipGraphNode({ id })),
    projection: "family_tree",
    updatedAt: null,
    ...overrides,
  };
}

function numbered(prefix: string, first: number, last: number): string[] {
  return Array.from(
    { length: last - first + 1 },
    (_, offset) => `${prefix}${String(first + offset).padStart(2, "0")}`,
  );
}

function presentationFor({
  graph,
  network = EMPTY_NETWORK_EXPANSION,
  networkFocus = null,
  params,
}: {
  graph: CharacterGraphView;
  network?: NetworkExpansion;
  networkFocus?: Nullable<string>;
  params: GraphWorkspaceParams;
}) {
  return buildGraphWorkspacePresentation({
    data: { graph, kind: "graph" },
    genealogy: EMPTY_GENEALOGY_EXPANSION,
    network,
    networkFocus,
    params,
    person: EMPTY_PERSON_EXPANSION,
    treeOptions: TREE_SCENE.defaultOptions,
  });
}

function treePresentationFor(
  tree: FamilyTreeGraphView,
  treeOptions: TreeOptions = TREE_SCENE.defaultOptions,
) {
  return buildGraphWorkspacePresentation({
    data: { kind: "tree", tree },
    genealogy: EMPTY_GENEALOGY_EXPANSION,
    network: EMPTY_NETWORK_EXPANSION,
    networkFocus: null,
    params: { ...DEFAULT_PARAMS, characterId: tree.focusCharacterId, view: "tree" },
    person: EMPTY_PERSON_EXPANSION,
    treeOptions,
  });
}

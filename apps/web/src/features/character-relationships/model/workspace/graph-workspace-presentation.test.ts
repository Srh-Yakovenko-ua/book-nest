import type {
  CharacterGraphHiddenContentView,
  CharacterGraphView,
  FamilyTreeGraphView,
  FamilyTreeLineageView,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { NetworkExpansion } from "./graph-network-scene";
import type { GraphWorkspaceParams, GraphWorkspaceView } from "./graph-workspace-params";
import type {
  GraphPresentationEmpty,
  GraphPresentationNotice,
} from "./graph-workspace-presentation";

import {
  makeRelationshipGraph,
  makeRelationshipGraphEdge,
  makeRelationshipGraphNode,
} from "../relationships.fixtures";
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
  north: "f1f1f1f1-0000-4000-8000-000000000001",
  south: "f2f2f2f2-0000-4000-8000-000000000002",
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
  networkGroup: "group",
  path: false,
  to: null,
  treeDown: 2,
  treeLinks: ["marriages", "siblings", "guardians", "distant"],
  treeUp: 2,
  types: [],
  view: "person",
};

const PERSON_PARAMS: GraphWorkspaceParams = { ...DEFAULT_PARAMS, characterId: CHARACTER.geralt };

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
    const params: GraphWorkspaceParams = { ...DEFAULT_PARAMS, view: "network" };
    const collapsed = presentationFor({ graph: PERSON_GRAPH, params });
    const network = {
      ...EMPTY_NETWORK_EXPANSION,
      expandedIds: new Set(collapsed?.clusters.keys()),
    };
    const presentation = presentationFor({ graph: PERSON_GRAPH, network, params });
    const hops = [...(presentation?.characters.values() ?? [])].map((character) => character.hop);

    expect(hops).toEqual([null, null, null, null, null]);
  });

  it("counts groups in the network view while no group is expanded", () => {
    const graph = makeRelationshipGraph({
      clusters: [
        { groupType: "family", id: GROUP.north, kind: "group", name: "Kaer Morhen", size: 2 },
        { groupType: "family", id: GROUP.south, kind: "group", name: "Vengerberg", size: 1 },
      ],
      edges: [
        makeRelationshipGraphEdge({
          id: RELATIONSHIP.geraltToCiri,
          source: CHARACTER.geralt,
          target: CHARACTER.ciri,
        }),
      ],
      nodes: [
        makeRelationshipGraphNode({ clusterId: GROUP.north, id: CHARACTER.ciri }),
        makeRelationshipGraphNode({ clusterId: GROUP.north, id: CHARACTER.geralt }),
        makeRelationshipGraphNode({ clusterId: GROUP.south, id: CHARACTER.yennefer }),
      ],
    });
    const presentation = presentationFor({ graph, params: { ...DEFAULT_PARAMS, view: "network" } });

    expect(presentation?.counters).toEqual({ groups: 2, kind: "groups" });
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

function presentationFor({
  graph,
  network = EMPTY_NETWORK_EXPANSION,
  params,
}: {
  graph: CharacterGraphView;
  network?: NetworkExpansion;
  params: GraphWorkspaceParams;
}) {
  return buildGraphWorkspacePresentation({
    data: { graph, kind: "graph" },
    network,
    params,
    person: EMPTY_PERSON_EXPANSION,
    treeOptions: TREE_SCENE.defaultOptions,
  });
}

function treePresentationFor(tree: FamilyTreeGraphView, treeOptions = TREE_SCENE.defaultOptions) {
  return buildGraphWorkspacePresentation({
    data: { kind: "tree", tree },
    network: EMPTY_NETWORK_EXPANSION,
    params: { ...DEFAULT_PARAMS, characterId: tree.focusCharacterId, view: "tree" },
    person: EMPTY_PERSON_EXPANSION,
    treeOptions,
  });
}

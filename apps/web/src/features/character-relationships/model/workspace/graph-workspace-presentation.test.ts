import type { CharacterGraphHiddenContentView, CharacterGraphView } from "@app/shared";

import { describe, expect, it } from "vitest";

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

describe("buildGraphWorkspacePresentation", () => {
  it("counts the rendered characters and rendered raw relationships of the person view", () => {
    const presentation = presentationFor({ graph: PERSON_GRAPH, params: PERSON_PARAMS });

    expect(presentation?.counters).toEqual({ edges: 3, kind: "people", nodes: 3 });
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
});

function presentationFor({
  graph,
  params,
}: {
  graph: CharacterGraphView;
  params: GraphWorkspaceParams;
}) {
  return buildGraphWorkspacePresentation({
    data: { graph, kind: "graph" },
    network: EMPTY_NETWORK_EXPANSION,
    params,
    person: EMPTY_PERSON_EXPANSION,
    treeOptions: TREE_SCENE.defaultOptions,
  });
}

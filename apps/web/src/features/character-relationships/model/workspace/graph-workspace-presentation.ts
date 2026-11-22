import type {
  CharacterGraphEdgeView,
  CharacterGraphHiddenContentView,
  CharacterGraphNodeView,
  Nullable,
} from "@app/shared";

import type { GraphConnection } from "./graph-connections";
import type { NetworkAggregate, NetworkBucket, NetworkExpansion } from "./graph-network-scene";
import type { PersonExpansion } from "./graph-person-scene";
import type { TreeLayoutRow } from "./graph-tree-layout";
import type { TreePairSemantics } from "./graph-tree-pairs";
import type { TreeOptions, TreeScene } from "./graph-tree-scene";
import type { GraphWorkspacePositions } from "./graph-workspace-layout";
import type { GraphWorkspaceParams } from "./graph-workspace-params";
import type { GraphWorkspaceSceneData } from "./graph-workspace-request";

import { toGraphConnections } from "./graph-connections";
import { buildNetworkScene } from "./graph-network-scene";
import { buildPersonScene } from "./graph-person-scene";
import { layoutTreeScene } from "./graph-tree-layout";
import { toTreePairSemanticsById } from "./graph-tree-pairs";
import { buildTreeScene } from "./graph-tree-scene";
import { layoutNetworkScene, layoutPersonScene } from "./graph-workspace-layout";

export type GraphPresentationCharacter = {
  canCollapse: boolean;
  canExpand: boolean;
  hop: Nullable<number>;
  isRoot: boolean;
  node: CharacterGraphNodeView;
};

export type GraphPresentationCluster = {
  bucket: NetworkBucket;
  hasMoreMembers: boolean;
  isExpanded: boolean;
};

export type GraphPresentationCounters =
  | { edges: number; kind: "expanded"; nodes: number }
  | { edges: number; kind: "person"; nodes: number; pairs: number }
  | { edges: number; kind: "tree"; nodes: number; pairs: number }
  | { groups: number; kind: "groups" };

export type GraphPresentationEmpty =
  "filteredEmpty" | "networkEmpty" | "noRelations" | "treeFiltered" | "treeRootOnly";

export type GraphPresentationNotice =
  | "fallbackComponents"
  | "locked"
  | "noAncestry"
  | "overBudget"
  | "treeConflicts"
  | "treeFewerAncestors"
  | "treeFewerDescendants"
  | "treeMultiLine"
  | "treeTruncated"
  | "truncated";

export type GraphTreePresentation = {
  arcPairIds: ReadonlySet<string>;
  pairs: ReadonlyMap<string, TreePairSemantics>;
  rows: readonly TreeLayoutRow[];
  scene: TreeScene;
};

export type GraphWorkspacePresentation = {
  aggregates: readonly NetworkAggregate[];
  characters: ReadonlyMap<string, GraphPresentationCharacter>;
  clusters: ReadonlyMap<string, GraphPresentationCluster>;
  connections: readonly GraphConnection[];
  counters: GraphPresentationCounters;
  edges: readonly CharacterGraphEdgeView[];
  empty: Nullable<GraphPresentationEmpty>;
  hasMoreClusters: boolean;
  moreHops: readonly number[];
  notices: readonly GraphPresentationNotice[];
  positions: GraphWorkspacePositions;
  rootId: Nullable<string>;
  tree: Nullable<GraphTreePresentation>;
};

type BuildPresentationInput = {
  data: GraphWorkspaceSceneData;
  network: NetworkExpansion;
  params: GraphWorkspaceParams;
  person: PersonExpansion;
  treeOptions: TreeOptions;
};

export function buildGraphWorkspacePresentation(
  input: BuildPresentationInput,
): Nullable<GraphWorkspacePresentation> {
  const { data, params } = input;
  if (data.kind === "tree") return buildTreePresentation(input);
  if (params.view === "network") return buildNetworkPresentation(input);
  if (params.characterId === null) return null;
  return buildPersonPresentation({ ...input, rootId: params.characterId });
}

function baseNotices(hiddenContent: CharacterGraphHiddenContentView): GraphPresentationNotice[] {
  return [
    ...(hiddenContent.truncated ? (["truncated"] as const) : []),
    ...(hiddenContent.hasLockedEdges ? (["locked"] as const) : []),
  ];
}

function buildNetworkPresentation({
  data,
  network,
  params,
}: BuildPresentationInput): Nullable<GraphWorkspacePresentation> {
  if (data.kind !== "graph") return null;
  const scene = buildNetworkScene({
    expansion: network,
    graph: data.graph,
    grouping: params.networkGroup,
  });
  const hasExpanded = scene.shownMembersByBucket.size > 0;
  return {
    aggregates: scene.aggregates,
    characters: new Map(
      scene.nodes.map((node): [string, GraphPresentationCharacter] => [
        node.id,
        { canCollapse: false, canExpand: false, hop: null, isRoot: false, node },
      ]),
    ),
    clusters: new Map(
      scene.buckets.map((bucket): [string, GraphPresentationCluster] => [
        bucket.id,
        {
          bucket,
          hasMoreMembers: scene.moreMembersIds.has(bucket.id),
          isExpanded: scene.shownMembersByBucket.has(bucket.id),
        },
      ]),
    ),
    connections: toGraphConnections(scene.edges),
    counters: hasExpanded
      ? { edges: scene.edges.length, kind: "expanded", nodes: scene.nodes.length }
      : { groups: scene.buckets.length, kind: "groups" },
    edges: scene.edges,
    empty: data.graph.edges.length === 0 ? toEmptyReason({ empty: "networkEmpty", params }) : null,
    hasMoreClusters: scene.hasMoreBuckets,
    moreHops: [],
    notices: [
      ...baseNotices(data.graph.hiddenContent),
      ...(scene.usedFallback ? (["fallbackComponents"] as const) : []),
      ...(scene.overSoftLimit ? (["overBudget"] as const) : []),
    ],
    positions: layoutNetworkScene(scene),
    rootId: null,
    tree: null,
  };
}

function buildPersonPresentation({
  data,
  params,
  person,
  rootId,
}: BuildPresentationInput & { rootId: string }): Nullable<GraphWorkspacePresentation> {
  if (data.kind !== "graph") return null;
  const scene = buildPersonScene({
    edges: data.graph.edges,
    expansion: person,
    nodes: data.graph.nodes,
    rootId,
  });
  if (scene === null) return null;
  const visibleIds = new Set(scene.nodes.map((node) => node.id));
  const hasVisibleChildren = (id: string) => {
    const hop = scene.hopById.get(id) ?? 0;
    return scene.edges.some((edge) => {
      if (edge.source !== id && edge.target !== id) return false;
      const other = edge.source === id ? edge.target : edge.source;
      return visibleIds.has(other) && scene.hopById.get(other) === hop + 1;
    });
  };
  const connections = toGraphConnections(scene.edges);
  return {
    aggregates: [],
    characters: new Map(
      scene.nodes.map((node): [string, GraphPresentationCharacter] => {
        const canExpand = scene.expandableIds.has(node.id);
        return [
          node.id,
          {
            canCollapse: !canExpand && node.id !== rootId && hasVisibleChildren(node.id),
            canExpand: canExpand && node.id !== rootId,
            hop: scene.hopById.get(node.id) ?? null,
            isRoot: node.id === rootId,
            node,
          },
        ];
      }),
    ),
    clusters: new Map(),
    connections,
    counters: {
      edges: scene.edges.length,
      kind: "person",
      nodes: scene.nodes.length,
      pairs: connections.length,
    },
    edges: scene.edges,
    empty: data.graph.edges.length === 0 ? toEmptyReason({ empty: "noRelations", params }) : null,
    hasMoreClusters: false,
    moreHops: [...scene.moreByHop].sort((left, right) => left - right),
    notices: [
      ...baseNotices(data.graph.hiddenContent),
      ...(scene.overSoftLimit ? (["overBudget"] as const) : []),
    ],
    positions: layoutPersonScene(scene),
    rootId,
    tree: null,
  };
}

function buildTreePresentation({
  data,
  treeOptions,
}: BuildPresentationInput): Nullable<GraphWorkspacePresentation> {
  if (data.kind !== "tree") return null;
  const { tree } = data;
  const scene = buildTreeScene({ options: treeOptions, tree });
  if (!scene.nodes.some((node) => node.id === scene.rootId)) return null;
  const connections = toGraphConnections(scene.edges);
  const pairs = toTreePairSemanticsById({ connections, entryByEdgeId: scene.entryByEdgeId });
  const layout = layoutTreeScene({ connections, pairs, scene });
  const hasLineage = scene.lineage.length > 0;
  return {
    aggregates: [],
    characters: new Map(
      scene.nodes.map((node): [string, GraphPresentationCharacter] => [
        node.id,
        {
          canCollapse: false,
          canExpand: false,
          hop: null,
          isRoot: node.id === scene.rootId,
          node,
        },
      ]),
    ),
    clusters: new Map(),
    connections,
    counters: {
      edges: scene.edges.length,
      kind: "tree",
      nodes: scene.nodes.length,
      pairs: connections.length,
    },
    edges: scene.edges,
    empty: toTreeEmpty({ shown: scene.edges.length, total: tree.edges.length }),
    hasMoreClusters: false,
    moreHops: [],
    notices: [
      ...(tree.hiddenContent.truncated ? (["treeTruncated"] as const) : []),
      ...(scene.hasConflicts ? (["treeConflicts"] as const) : []),
      ...(!hasLineage && scene.edges.length > 0 ? (["noAncestry"] as const) : []),
      ...(hasLineage && scene.reach.ancestors < tree.ancestors
        ? (["treeFewerAncestors"] as const)
        : []),
      ...(hasLineage && scene.reach.descendants < tree.descendants
        ? (["treeFewerDescendants"] as const)
        : []),
      ...(scene.hasMultiLineLinks ? (["treeMultiLine"] as const) : []),
    ],
    positions: layout.positions,
    rootId: scene.rootId,
    tree: { arcPairIds: layout.arcPairIds, pairs, rows: layout.rows, scene },
  };
}

function toEmptyReason({
  empty,
  params,
}: {
  empty: Exclude<GraphPresentationEmpty, "filteredEmpty">;
  params: GraphWorkspaceParams;
}): GraphPresentationEmpty {
  return params.categories.length > 0 || params.types.length > 0 ? "filteredEmpty" : empty;
}

function toTreeEmpty({
  shown,
  total,
}: {
  shown: number;
  total: number;
}): Nullable<GraphPresentationEmpty> {
  if (shown > 0) return null;
  return total > 0 ? "treeFiltered" : "treeRootOnly";
}

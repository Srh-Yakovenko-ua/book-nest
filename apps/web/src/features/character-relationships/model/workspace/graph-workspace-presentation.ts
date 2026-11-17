import type {
  CharacterGraphEdgeView,
  CharacterGraphHiddenContentView,
  CharacterGraphNodeView,
  Nullable,
} from "@app/shared";

import type { GraphConnection } from "./graph-connections";
import type { NetworkAggregate, NetworkBucket, NetworkExpansion } from "./graph-network-scene";
import type { PersonExpansion } from "./graph-person-scene";
import type { TreeOptions } from "./graph-tree-scene";
import type { GraphWorkspacePositions } from "./graph-workspace-layout";
import type { GraphWorkspaceParams } from "./graph-workspace-params";
import type { GraphWorkspaceSceneData } from "./graph-workspace-request";

import { toGraphConnections } from "./graph-connections";
import { buildNetworkScene } from "./graph-network-scene";
import { buildPersonScene } from "./graph-person-scene";
import { buildTreeScene } from "./graph-tree-scene";
import { layoutNetworkScene, layoutPersonScene, layoutTreeScene } from "./graph-workspace-layout";

export type GraphPresentationCharacter = {
  canCollapse: boolean;
  canExpand: boolean;
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
  | { edges: number; kind: "people"; nodes: number }
  | { groups: number; kind: "groups" };

export type GraphPresentationEmpty = "filteredEmpty" | "networkEmpty" | "noRelations";

export type GraphPresentationNotice =
  "fallbackComponents" | "irregular" | "locked" | "noAncestry" | "overBudget" | "truncated";

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
        { canCollapse: false, canExpand: false, isRoot: false, node },
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
            isRoot: node.id === rootId,
            node,
          },
        ];
      }),
    ),
    clusters: new Map(),
    connections: toGraphConnections(scene.edges),
    counters: { edges: scene.edges.length, kind: "people", nodes: scene.nodes.length },
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
  };
}

function buildTreePresentation({
  data,
  treeOptions,
}: BuildPresentationInput): Nullable<GraphWorkspacePresentation> {
  if (data.kind !== "tree") return null;
  const scene = buildTreeScene({ options: treeOptions, tree: data.tree });
  if (!scene.nodes.some((node) => node.id === scene.rootId)) return null;
  return {
    aggregates: [],
    characters: new Map(
      scene.nodes.map((node): [string, GraphPresentationCharacter] => [
        node.id,
        { canCollapse: false, canExpand: false, isRoot: node.id === scene.rootId, node },
      ]),
    ),
    clusters: new Map(),
    connections: toGraphConnections(scene.edges),
    counters: { edges: scene.edges.length, kind: "people", nodes: scene.nodes.length },
    edges: scene.edges,
    empty: null,
    hasMoreClusters: false,
    moreHops: [],
    notices: [
      ...baseNotices(data.tree.hiddenContent),
      ...(data.tree.lineage.length === 0 ? (["noAncestry"] as const) : []),
      ...(scene.hasIrregularGenerations ? (["irregular"] as const) : []),
    ],
    positions: layoutTreeScene(scene),
    rootId: scene.rootId,
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

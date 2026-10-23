import type {
  CharacterGraphEdgeView,
  CharacterGraphMode,
  CharacterGraphNodeView,
  CharacterRelationshipPathView,
  Nullable,
  RelationshipCategory,
  RelationshipType,
} from "@app/shared";

import type { GraphEdgeSource, GraphNodeSource, PreparedEdge } from "./character-graph.js";
import type { RelationshipReaderContext } from "./relationship-reader-projection.js";

import {
  computeDegrees,
  computeVisibleGraphEdges,
  toGraphEdgeView,
  toGraphNodeView,
} from "./character-graph.js";

type Adjacent = { edge: PreparedEdge; to: string };

type PathSearchResult =
  { kind: "exhausted" } | { kind: "found"; trace: PathTrace } | { kind: "limited" };

type PathStep = { edge: PreparedEdge; from: string };

type PathTrace = { edges: PreparedEdge[]; nodeIds: string[] };

export function findVisibleRelationshipPath({
  categoryFilter,
  edges,
  fromId,
  maxVisitedNodes,
  mode,
  nodes,
  partNumberById,
  readerContext,
  revealEdgeIds,
  toId,
  typeFilter,
}: {
  categoryFilter: Nullable<Set<RelationshipCategory>>;
  edges: GraphEdgeSource[];
  fromId: string;
  maxVisitedNodes: number;
  mode: CharacterGraphMode;
  nodes: GraphNodeSource[];
  partNumberById: Map<string, Nullable<number>>;
  readerContext: RelationshipReaderContext;
  revealEdgeIds: Set<string>;
  toId: string;
  typeFilter: Nullable<Set<RelationshipType>>;
}): CharacterRelationshipPathView {
  const visibleEdges = computeVisibleGraphEdges({
    categoryFilter,
    edges,
    mode,
    nodes,
    readerContext,
    revealEdgeIds,
    typeFilter,
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const degreeById = computeDegrees(visibleEdges);
  const notConnected: CharacterRelationshipPathView = {
    edges: [],
    found: false,
    fromId,
    nodes: [],
    searchLimited: false,
    toId,
  };

  if (!nodeById.has(fromId) || !nodeById.has(toId)) {
    return notConnected;
  }

  const buildNodeView = (id: string): Nullable<CharacterGraphNodeView> => {
    const node = nodeById.get(id);
    if (node === undefined) {
      return null;
    }
    return toGraphNodeView({ degree: degreeById.get(id) ?? 0, node, partNumberById });
  };

  if (fromId === toId) {
    const single = buildNodeView(fromId);
    if (single === null) {
      return notConnected;
    }
    return { edges: [], found: true, fromId, nodes: [single], searchLimited: false, toId };
  }

  const search = traceShortestPath({ edges: visibleEdges, fromId, maxVisitedNodes, toId });
  if (search.kind === "limited") {
    return { ...notConnected, searchLimited: true };
  }
  if (search.kind === "exhausted") {
    return notConnected;
  }
  const trace = search.trace;

  const pathNodes: CharacterGraphNodeView[] = [];
  for (const id of trace.nodeIds) {
    const view = buildNodeView(id);
    if (view === null) {
      return notConnected;
    }
    pathNodes.push(view);
  }
  const pathEdges: CharacterGraphEdgeView[] = trace.edges.map((edge) => toGraphEdgeView(edge));

  return { edges: pathEdges, found: true, fromId, nodes: pathNodes, searchLimited: false, toId };
}

function addAdjacent({
  adjacency,
  edge,
  from,
  to,
}: {
  adjacency: Map<string, Adjacent[]>;
  edge: PreparedEdge;
  from: string;
  to: string;
}): void {
  const neighbors = adjacency.get(from) ?? [];
  neighbors.push({ edge, to });
  adjacency.set(from, neighbors);
}

function buildAdjacency(edges: PreparedEdge[]): Map<string, Adjacent[]> {
  const adjacency = new Map<string, Adjacent[]>();
  const ordered = [...edges].sort((left, right) => left.id.localeCompare(right.id));
  for (const edge of ordered) {
    addAdjacent({ adjacency, edge, from: edge.source, to: edge.target });
    addAdjacent({ adjacency, edge, from: edge.target, to: edge.source });
  }
  return adjacency;
}

function reconstructPath({
  fromId,
  predecessorById,
  toId,
}: {
  fromId: string;
  predecessorById: Map<string, PathStep>;
  toId: string;
}): Nullable<PathTrace> {
  const nodeIds: string[] = [toId];
  const edges: PreparedEdge[] = [];
  let current = toId;
  while (current !== fromId) {
    const step = predecessorById.get(current);
    if (step === undefined) {
      return null;
    }
    edges.push(step.edge);
    nodeIds.push(step.from);
    current = step.from;
  }
  nodeIds.reverse();
  edges.reverse();
  return { edges, nodeIds };
}

function traceShortestPath({
  edges,
  fromId,
  maxVisitedNodes,
  toId,
}: {
  edges: PreparedEdge[];
  fromId: string;
  maxVisitedNodes: number;
  toId: string;
}): PathSearchResult {
  const adjacency = buildAdjacency(edges);
  const predecessorById = new Map<string, PathStep>();
  const visited = new Set<string>([fromId]);
  let frontier = [fromId];

  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const node of frontier) {
      for (const neighbor of adjacency.get(node) ?? []) {
        if (visited.has(neighbor.to)) {
          continue;
        }
        if (visited.size >= maxVisitedNodes) {
          return { kind: "limited" };
        }
        visited.add(neighbor.to);
        predecessorById.set(neighbor.to, { edge: neighbor.edge, from: node });
        if (neighbor.to === toId) {
          const trace = reconstructPath({ fromId, predecessorById, toId });
          return trace === null ? { kind: "exhausted" } : { kind: "found", trace };
        }
        nextFrontier.push(neighbor.to);
      }
    }
    frontier = nextFrontier;
  }
  return { kind: "exhausted" };
}

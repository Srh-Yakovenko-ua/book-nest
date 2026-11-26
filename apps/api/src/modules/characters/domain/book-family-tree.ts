import type {
  BookFamilyTreeView,
  CharacterGraphEdgeView,
  CharacterGraphNodeView,
  FamilyTreeLineageView,
  Nullable,
} from "@app/shared";

import { BOOK_FAMILY_TREE } from "@app/shared";
import { createHash } from "node:crypto";

import type {
  GraphEdgeSource,
  GraphMembershipSource,
  GraphNodeSource,
  PreparedEdge,
} from "./character-graph.js";
import type { RelationshipReaderContext } from "./relationship-reader-projection.js";

import {
  addAdjacency,
  computeDegrees,
  computeGroupClusters,
  computeUpdatedAt,
  toGraphEdgeView,
  toGraphNodeView,
} from "./character-graph.js";
import {
  collectLineageLinks,
  collectVisibleFamilyEdges,
  compareTreeNodes,
  isAuxiliaryEdge,
  separateLineageConflicts,
} from "./family-tree.js";

const BOOK_FAMILY_TREE_RULES = {
  houseGroupTypes: new Set<string>(BOOK_FAMILY_TREE.houseGroupTypes),
  versionLength: 16,
  versionPrefix: "family_tree_book",
} as const;

type BuildBookFamilyTreeInput = {
  allowedBookIds: ReadonlySet<string>;
  edgeLimit: number;
  edges: GraphEdgeSource[];
  memberships: GraphMembershipSource[];
  nodeLimit: number;
  nodes: GraphNodeSource[];
  partNumberById: Map<string, Nullable<number>>;
  readerContext: RelationshipReaderContext;
};

type FamilyComponent = {
  ids: string[];
  smallestId: string;
};

export function buildBookFamilyTree(input: BuildBookFamilyTreeInput): BookFamilyTreeView {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const familyEdges = collectVisibleFamilyEdges({
    edges: input.edges,
    nodes: input.nodes,
    readerContext: input.readerContext,
  });
  const links = collectLineageLinks(familyEdges);
  const linkEdgeIds = new Set(links.map((link) => link.edge.id));
  const auxiliaryEdges = familyEdges.filter(
    (edge) => !linkEdgeIds.has(edge.id) && isAuxiliaryEdge(edge),
  );
  const genealogyEdges = [...links.map((link) => link.edge), ...auxiliaryEdges];
  const adjacency = buildSortedAdjacency(genealogyEdges);
  const includedIds = selectIncludedIds({
    adjacency,
    degreeById: computeDegrees(genealogyEdges),
    nodeLimit: input.nodeLimit,
  });

  const includedLinks = links
    .filter((link) => includedIds.has(link.view.parentId) && includedIds.has(link.view.childId))
    .sort((left, right) => left.edge.id.localeCompare(right.edge.id));
  const includedAuxiliaryEdges = auxiliaryEdges
    .filter((edge) => includedIds.has(edge.source) && includedIds.has(edge.target))
    .sort((left, right) => left.id.localeCompare(right.id));
  const keptEdges = [...includedLinks.map((link) => link.edge), ...includedAuxiliaryEdges].slice(
    0,
    input.edgeLimit,
  );
  const keptEdgeIds = new Set(keptEdges.map((edge) => edge.id));
  const { diagnostics, lineage } = separateLineageConflicts(
    includedLinks.filter((link) => keptEdgeIds.has(link.edge.id)),
  );

  const degreeById = computeDegrees(keptEdges);
  const baseNodes = [...includedIds]
    .map((id) => nodeById.get(id))
    .filter((node): node is GraphNodeSource => node !== undefined)
    .map((node) =>
      toGraphNodeView({
        degree: degreeById.get(node.id) ?? 0,
        node,
        partNumberById: input.partNumberById,
      }),
    );
  const { clusterIdByNodeId, clusters } = computeGroupClusters({
    allowedBookIds: input.allowedBookIds,
    memberships: input.memberships.filter((membership) =>
      BOOK_FAMILY_TREE_RULES.houseGroupTypes.has(membership.group.type),
    ),
    nodes: baseNodes,
  });
  const nodes = baseNodes
    .map((node) => ({ ...node, clusterId: clusterIdByNodeId.get(node.id) ?? null }))
    .sort(compareTreeNodes);
  const edges = keptEdges
    .map((edge) => toGraphEdgeView(edge))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    diagnostics,
    edges,
    graphVersion: computeBookFamilyTreeVersion({ edges, lineage, nodes }),
    hiddenContent: {
      hasHiddenEdges: false,
      hasLockedEdges: false,
      truncated:
        adjacency.size > includedIds.size ||
        keptEdges.length < includedLinks.length + includedAuxiliaryEdges.length,
    },
    houses: clusters,
    lineage,
    nodes,
    scope: "book",
    updatedAt: computeUpdatedAt({ edges: keptEdges, nodeById, nodeIds: includedIds }),
  };
}

function buildSortedAdjacency(edges: PreparedEdge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    addAdjacency({ adjacency, from: edge.source, to: edge.target });
    addAdjacency({ adjacency, from: edge.target, to: edge.source });
  }
  for (const neighbors of adjacency.values()) {
    neighbors.sort((left, right) => left.localeCompare(right));
  }
  return adjacency;
}

function collectBreadthFirst({
  adjacency,
  capacity,
  seed,
}: {
  adjacency: Map<string, string[]>;
  capacity: number;
  seed: string;
}): string[] {
  if (capacity <= 0) {
    return [];
  }
  const visited = new Set<string>([seed]);
  let frontier = [seed];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (visited.size >= capacity) {
          return [...visited];
        }
        if (visited.has(neighbor)) {
          continue;
        }
        visited.add(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return [...visited];
}

function collectComponents(adjacency: Map<string, string[]>): FamilyComponent[] {
  const assignedIds = new Set<string>();
  const components: FamilyComponent[] = [];
  const startIds = [...adjacency.keys()].sort((left, right) => left.localeCompare(right));
  for (const startId of startIds) {
    if (assignedIds.has(startId)) {
      continue;
    }
    const ids = collectBreadthFirst({ adjacency, capacity: adjacency.size, seed: startId });
    for (const id of ids) {
      assignedIds.add(id);
    }
    components.push({ ids, smallestId: startId });
  }
  return components.sort(
    (left, right) =>
      right.ids.length - left.ids.length || left.smallestId.localeCompare(right.smallestId),
  );
}

function computeBookFamilyTreeVersion({
  edges,
  lineage,
  nodes,
}: {
  edges: CharacterGraphEdgeView[];
  lineage: FamilyTreeLineageView[];
  nodes: CharacterGraphNodeView[];
}): string {
  const serialized = [
    BOOK_FAMILY_TREE_RULES.versionPrefix,
    nodes
      .map((node) => node.id)
      .sort()
      .join(","),
    edges
      .map((edge) => `${edge.id}:${edge.status ?? ""}`)
      .sort()
      .join(","),
    lineage
      .map((link) => link.relationshipId)
      .sort()
      .join(","),
    nodes
      .map((node) => `${node.id}:${node.clusterId ?? ""}`)
      .sort()
      .join(","),
  ].join("|");
  return createHash("sha256")
    .update(serialized)
    .digest("hex")
    .slice(0, BOOK_FAMILY_TREE_RULES.versionLength);
}

function pickBreadthFirstSeed({
  degreeById,
  ids,
}: {
  degreeById: Map<string, number>;
  ids: string[];
}): string {
  return ids.reduce((best, candidate) => {
    const degreeGap = (degreeById.get(candidate) ?? 0) - (degreeById.get(best) ?? 0);
    const outranks = degreeGap > 0 || (degreeGap === 0 && candidate.localeCompare(best) < 0);
    return outranks ? candidate : best;
  });
}

function selectIncludedIds({
  adjacency,
  degreeById,
  nodeLimit,
}: {
  adjacency: Map<string, string[]>;
  degreeById: Map<string, number>;
  nodeLimit: number;
}): Set<string> {
  const includedIds = new Set<string>();
  for (const component of collectComponents(adjacency)) {
    const capacity = nodeLimit - includedIds.size;
    const admittedIds =
      component.ids.length <= capacity
        ? component.ids
        : collectBreadthFirst({
            adjacency,
            capacity,
            seed: pickBreadthFirstSeed({ degreeById, ids: component.ids }),
          });
    for (const id of admittedIds) {
      includedIds.add(id);
    }
    if (admittedIds.length < component.ids.length) {
      break;
    }
  }
  return includedIds;
}

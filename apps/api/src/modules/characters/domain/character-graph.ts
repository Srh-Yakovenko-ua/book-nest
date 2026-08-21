import type {
  BookCharacterImportance,
  CharacterGraphClusterBy,
  CharacterGraphClusterView,
  CharacterGraphEdgeView,
  CharacterGraphMode,
  CharacterGraphNodeView,
  CharacterGraphView,
  CharacterRelationshipDiagnosticView,
  Nullable,
  RelationshipBookStateStatus,
  RelationshipCategory,
  RelationshipDirectionality,
  RelationshipIntensity,
  RelationshipType,
} from "@app/shared";

import {
  BookCharacterImportanceSchema,
  CHARACTER_RELATIONSHIP_ERROR_CODES,
  CharacterEntityKindSchema,
  CharacterGroupTypeSchema,
  getFamilyAncestryRole,
  RelationshipBookStateStatusSchema,
  RelationshipCategorySchema,
  RelationshipDirectionalitySchema,
  RelationshipIntensitySchema,
  RelationshipTypeSchema,
} from "@app/shared";
import { compareAsc } from "date-fns";
import { createHash } from "node:crypto";

import type { RelationshipBookStateSource } from "./character-relationship.mapper.js";
import type { ReadingPositionGate } from "./reading-position.js";

import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import { isMembershipVisibleInContext } from "./character-group-visibility.js";
import { pickEffectiveBookState } from "./character-relationship.mapper.js";
import { isHiddenByReadingPosition } from "./reading-position.js";

const GRAPH_VERSION_LENGTH = 16;

const MODE_CATEGORIES: Record<CharacterGraphMode, Nullable<RelationshipCategory[]>> = {
  all: null,
  family: ["family", "romantic"],
};

export type GraphEdgeSource = {
  bookStates: RelationshipBookStateSource[];
  category: string;
  customType: Nullable<string>;
  directionality: string;
  id: string;
  sourceCharacterId: string;
  sourceLabel: Nullable<string>;
  targetCharacterId: string;
  targetLabel: Nullable<string>;
  type: string;
  updatedAt: Date;
};

export type GraphMembershipGroup = {
  id: string;
  isSpoiler: boolean;
  name: string;
  type: string;
};

export type GraphMembershipSource = {
  bookId: Nullable<string>;
  characterId: string;
  group: GraphMembershipGroup;
  isSpoiler: boolean;
};

export type GraphNodeAppearance = {
  bookId: string;
  createdAt: Date;
  hidePresenceAsSpoiler: boolean;
  importance: string;
};

export type GraphNodeSource = {
  appearances: GraphNodeAppearance[];
  entityKind: string;
  id: string;
  isFavorite: boolean;
  name: string;
  updatedAt: Date;
};

export type PreparedEdge = {
  category: Nullable<RelationshipCategory>;
  description: Nullable<string>;
  descriptionHidden: boolean;
  directionality: RelationshipDirectionality;
  id: string;
  intensity: Nullable<RelationshipIntensity>;
  revealed: boolean;
  source: string;
  sourceLabel: Nullable<string>;
  status: Nullable<RelationshipBookStateStatus>;
  target: string;
  targetLabel: Nullable<string>;
  type: Nullable<RelationshipType>;
  typeHidden: boolean;
  updatedAt: Date;
};

type AncestryEdge = {
  ancestorId: string;
  descendantId: string;
};

type BuildCharacterGraphInput = {
  allowedBookIds: string[];
  categoryFilter: Nullable<Set<RelationshipCategory>>;
  clusterBy: Nullable<CharacterGraphClusterBy>;
  depth: number;
  edgeLimit: number;
  edges: GraphEdgeSource[];
  focusCharacterId: Nullable<string>;
  memberships: GraphMembershipSource[];
  mode: CharacterGraphMode;
  nodeLimit: number;
  nodes: GraphNodeSource[];
  partNumberById: Map<string, Nullable<number>>;
  positionGate?: Nullable<ReadingPositionGate>;
  revealEdgeIds: Set<string>;
  typeFilter: Nullable<Set<RelationshipType>>;
};

type ClusterComputeInput = {
  allowedBookIds: Set<string>;
  memberships: GraphMembershipSource[];
  nodes: CharacterGraphNodeView[];
  presenceHiddenIds: Set<string>;
};

type ClusterResult = {
  clusterIdByNodeId: Map<string, string>;
  clusters: CharacterGraphClusterView[];
};

export function buildCharacterGraph(input: BuildCharacterGraphInput): CharacterGraphView {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const {
    edges: preparedEdges,
    hasHiddenEdges,
    presenceHiddenIds,
  } = computeVisibleGraphEdges({
    categoryFilter: input.categoryFilter,
    edges: input.edges,
    mode: input.mode,
    nodes: input.nodes,
    partNumberById: input.partNumberById,
    positionGate: input.positionGate,
    revealEdgeIds: input.revealEdgeIds,
    typeFilter: input.typeFilter,
  });

  const focused = applyFocus({
    depth: input.depth,
    edges: preparedEdges,
    focusCharacterId: input.focusCharacterId,
    nodeById,
    presenceHiddenIds,
  });
  const bounded = applyPayloadCap({
    edgeLimit: input.edgeLimit,
    edges: focused.edges,
    focusCharacterId: input.focusCharacterId,
    nodeIds: focused.nodeIds,
    nodeLimit: input.nodeLimit,
  });

  const degreeById = computeDegrees(bounded.edges);
  const baseNodes = [...bounded.nodeIds]
    .map((id) => nodeById.get(id))
    .filter((node): node is GraphNodeSource => node !== undefined)
    .map((node) =>
      toGraphNodeView({
        degree: degreeById.get(node.id) ?? 0,
        node,
        partNumberById: input.partNumberById,
      }),
    )
    .sort(
      (left, right) =>
        right.degree - left.degree ||
        UKRAINIAN_COLLATION.compare(left.name, right.name) ||
        left.id.localeCompare(right.id),
    );
  const { clusterIdByNodeId, clusters } = computeClusters({
    allowedBookIds: new Set(input.allowedBookIds),
    clusterBy: input.clusterBy,
    memberships: input.memberships,
    nodes: baseNodes,
    presenceHiddenIds,
  });
  const nodes = baseNodes.map((node) => ({
    ...node,
    clusterId: clusterIdByNodeId.get(node.id) ?? null,
  }));
  const edges = bounded.edges
    .map((edge) => toGraphEdgeView(edge))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    clusterBy: input.clusterBy,
    clusters,
    diagnostics: detectGraphFamilyDiagnostics(bounded.edges),
    edges,
    graphVersion: computeGraphVersion({
      depth: input.depth,
      edges,
      focusCharacterId: input.focusCharacterId,
      mode: input.mode,
      nodes,
    }),
    hiddenContent: {
      hasHiddenEdges,
      hasHiddenNodes: presenceHiddenIds.size > 0,
      hasLockedEdges: bounded.edges.some((edge) => edge.typeHidden),
      truncated: bounded.truncated,
    },
    mode: input.mode,
    nodes,
    updatedAt: computeUpdatedAt({ edges: bounded.edges, nodeById, nodeIds: bounded.nodeIds }),
  };
}

export function computeDegrees(edges: PreparedEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
  }
  return degrees;
}

export function computeVisibleGraphEdges({
  categoryFilter,
  edges,
  mode,
  nodes,
  partNumberById,
  positionGate,
  revealEdgeIds,
  typeFilter,
}: {
  categoryFilter: Nullable<Set<RelationshipCategory>>;
  edges: GraphEdgeSource[];
  mode: CharacterGraphMode;
  nodes: GraphNodeSource[];
  partNumberById: Map<string, Nullable<number>>;
  positionGate?: Nullable<ReadingPositionGate>;
  revealEdgeIds: Set<string>;
  typeFilter: Nullable<Set<RelationshipType>>;
}): { edges: PreparedEdge[]; hasHiddenEdges: boolean; presenceHiddenIds: Set<string> } {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const presenceHiddenIds = collectPresenceHiddenIds(nodes);
  const effectiveCategories = combineCategoryFilters({
    categoryFilter,
    modeCategories: computeModeCategories(mode),
  });

  let hasHiddenEdges = false;
  const preparedEdges: PreparedEdge[] = [];
  for (const edge of edges) {
    const effective = pickEffectiveBookState({ partNumberById, states: edge.bookStates });
    if (effective === null) {
      continue;
    }
    if (effective.hideRelationshipAsSpoiler) {
      hasHiddenEdges = true;
      continue;
    }
    if (
      isHiddenByReadingPosition({
        content: {
          audioSeconds: effective.introducedAudioSeconds,
          chapter: effective.introducedChapter,
          page: effective.introducedPage,
        },
        contentBookId: effective.bookId,
        gate: positionGate ?? null,
      })
    ) {
      hasHiddenEdges = true;
      continue;
    }
    if (
      presenceHiddenIds.has(edge.sourceCharacterId) ||
      presenceHiddenIds.has(edge.targetCharacterId) ||
      !nodeById.has(edge.sourceCharacterId) ||
      !nodeById.has(edge.targetCharacterId)
    ) {
      continue;
    }

    const revealable = effective.isTypeSpoiler || effective.isDescriptionSpoiler;
    const revealed = revealable && revealEdgeIds.has(edge.id);
    const typeHidden = effective.isTypeSpoiler && !revealed;
    const descriptionHidden = effective.isDescriptionSpoiler && !revealed;
    const category = typeHidden ? null : RelationshipCategorySchema.parse(edge.category);
    const type = typeHidden ? null : RelationshipTypeSchema.parse(edge.type);

    if (
      !passesCategoryFilter({ category, effectiveCategories }) ||
      !passesTypeFilter({ type, typeFilter })
    ) {
      continue;
    }

    preparedEdges.push({
      category,
      description: descriptionHidden ? null : effective.description,
      descriptionHidden,
      directionality: RelationshipDirectionalitySchema.parse(edge.directionality),
      id: edge.id,
      intensity:
        typeHidden || effective.intensity === null
          ? null
          : RelationshipIntensitySchema.parse(effective.intensity),
      revealed,
      source: edge.sourceCharacterId,
      sourceLabel: typeHidden ? null : edge.sourceLabel,
      status: RelationshipBookStateStatusSchema.parse(effective.status),
      target: edge.targetCharacterId,
      targetLabel: typeHidden ? null : edge.targetLabel,
      type,
      typeHidden,
      updatedAt: maxDate(edge.updatedAt, effective.updatedAt),
    });
  }

  return { edges: preparedEdges, hasHiddenEdges, presenceHiddenIds };
}

export function toGraphEdgeView(edge: PreparedEdge): CharacterGraphEdgeView {
  return {
    category: edge.category,
    description: edge.description,
    descriptionHidden: edge.descriptionHidden,
    directionality: edge.directionality,
    id: edge.id,
    intensity: edge.intensity,
    revealed: edge.revealed,
    source: edge.source,
    sourceLabel: edge.sourceLabel,
    status: edge.status,
    target: edge.target,
    targetLabel: edge.targetLabel,
    type: edge.type,
    typeHidden: edge.typeHidden,
  };
}

export function toGraphNodeView({
  degree,
  node,
  partNumberById,
}: {
  degree: number;
  node: GraphNodeSource;
  partNumberById: Map<string, Nullable<number>>;
}): CharacterGraphNodeView {
  const visibleAppearances = node.appearances.filter(
    (appearance) => !appearance.hidePresenceAsSpoiler,
  );
  const representative = pickEffectiveBookState({ partNumberById, states: visibleAppearances });
  const importance: Nullable<BookCharacterImportance> =
    representative === null ? null : BookCharacterImportanceSchema.parse(representative.importance);
  return {
    clusterId: null,
    degree,
    entityKind: CharacterEntityKindSchema.parse(node.entityKind),
    id: node.id,
    importance,
    isFavorite: node.isFavorite,
    name: node.name,
  };
}

function addAdjacency({
  adjacency,
  from,
  to,
}: {
  adjacency: Map<string, string[]>;
  from: string;
  to: string;
}): void {
  const neighbors = adjacency.get(from) ?? [];
  neighbors.push(to);
  adjacency.set(from, neighbors);
}

function applyFocus({
  depth,
  edges,
  focusCharacterId,
  nodeById,
  presenceHiddenIds,
}: {
  depth: number;
  edges: PreparedEdge[];
  focusCharacterId: Nullable<string>;
  nodeById: Map<string, GraphNodeSource>;
  presenceHiddenIds: Set<string>;
}): { edges: PreparedEdge[]; nodeIds: Set<string> } {
  if (focusCharacterId === null) {
    return { edges, nodeIds: collectEndpointIds(edges) };
  }
  if (!nodeById.has(focusCharacterId) || presenceHiddenIds.has(focusCharacterId)) {
    return { edges: [], nodeIds: new Set() };
  }
  const reachable = collectReachableIds({ depth, edges, start: focusCharacterId });
  const keptEdges = edges.filter(
    (edge) => reachable.has(edge.source) && reachable.has(edge.target),
  );
  return { edges: keptEdges, nodeIds: reachable };
}

function applyPayloadCap({
  edgeLimit,
  edges,
  focusCharacterId,
  nodeIds,
  nodeLimit,
}: {
  edgeLimit: number;
  edges: PreparedEdge[];
  focusCharacterId: Nullable<string>;
  nodeIds: Set<string>;
  nodeLimit: number;
}): { edges: PreparedEdge[]; nodeIds: Set<string>; truncated: boolean } {
  let truncated = false;
  let keptNodeIds = nodeIds;
  let keptEdges = edges;

  if (nodeIds.size > nodeLimit) {
    truncated = true;
    const degreeById = computeDegrees(edges);
    const ranked = [...nodeIds].sort((left, right) => {
      if (focusCharacterId !== null && left === focusCharacterId) {
        return -1;
      }
      if (focusCharacterId !== null && right === focusCharacterId) {
        return 1;
      }
      return (
        (degreeById.get(right) ?? 0) - (degreeById.get(left) ?? 0) || left.localeCompare(right)
      );
    });
    keptNodeIds = new Set(ranked.slice(0, nodeLimit));
    keptEdges = edges.filter(
      (edge) => keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target),
    );
  }

  if (keptEdges.length > edgeLimit) {
    truncated = true;
    keptEdges = [...keptEdges]
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, edgeLimit);
  }

  return { edges: keptEdges, nodeIds: keptNodeIds, truncated };
}

function collectEndpointIds(edges: PreparedEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const edge of edges) {
    ids.add(edge.source);
    ids.add(edge.target);
  }
  return ids;
}

function collectPresenceHiddenIds(nodes: GraphNodeSource[]): Set<string> {
  const hidden = new Set<string>();
  for (const node of nodes) {
    const hasVisibleAppearance = node.appearances.some(
      (appearance) => !appearance.hidePresenceAsSpoiler,
    );
    if (node.appearances.length > 0 && !hasVisibleAppearance) {
      hidden.add(node.id);
    }
  }
  return hidden;
}

function collectReachableIds({
  depth,
  edges,
  start,
}: {
  depth: number;
  edges: PreparedEdge[];
  start: string;
}): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    addAdjacency({ adjacency, from: edge.source, to: edge.target });
    addAdjacency({ adjacency, from: edge.target, to: edge.source });
  }
  const visited = new Set<string>([start]);
  let frontier = [start];
  for (let hop = 0; hop < depth; hop += 1) {
    const next: string[] = [];
    for (const node of frontier) {
      for (const neighbor of adjacency.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return visited;
}

function combineCategoryFilters({
  categoryFilter,
  modeCategories,
}: {
  categoryFilter: Nullable<Set<RelationshipCategory>>;
  modeCategories: Nullable<Set<RelationshipCategory>>;
}): Nullable<Set<RelationshipCategory>> {
  if (modeCategories === null) {
    return categoryFilter;
  }
  if (categoryFilter === null) {
    return modeCategories;
  }
  return new Set([...modeCategories].filter((category) => categoryFilter.has(category)));
}

function computeClusters({
  allowedBookIds,
  clusterBy,
  memberships,
  nodes,
  presenceHiddenIds,
}: ClusterComputeInput & { clusterBy: Nullable<CharacterGraphClusterBy> }): ClusterResult {
  if (clusterBy === null) {
    return { clusterIdByNodeId: new Map(), clusters: [] };
  }
  const builders: Record<CharacterGraphClusterBy, () => ClusterResult> = {
    group: () => computeGroupClusters({ allowedBookIds, memberships, nodes, presenceHiddenIds }),
    importance: () => computeImportanceClusters({ nodes }),
  };
  return builders[clusterBy]();
}

function computeGraphVersion({
  depth,
  edges,
  focusCharacterId,
  mode,
  nodes,
}: {
  depth: number;
  edges: CharacterGraphEdgeView[];
  focusCharacterId: Nullable<string>;
  mode: CharacterGraphMode;
  nodes: CharacterGraphNodeView[];
}): string {
  const nodeSignature = nodes
    .map((node) => node.id)
    .sort()
    .join(",");
  const edgeSignature = edges
    .map((edge) => `${edge.id}:${edge.typeHidden ? "1" : "0"}:${edge.status ?? ""}`)
    .sort()
    .join(",");
  const serialized = [
    mode,
    focusCharacterId ?? "",
    String(depth),
    nodeSignature,
    edgeSignature,
  ].join("|");
  return createHash("sha256").update(serialized).digest("hex").slice(0, GRAPH_VERSION_LENGTH);
}

function computeGroupClusters({
  allowedBookIds,
  memberships,
  nodes,
  presenceHiddenIds,
}: ClusterComputeInput): ClusterResult {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const context = {
    allowedBookIds,
    hiddenPresenceCharacterIds: presenceHiddenIds,
    hiddenProfileCharacterIds: new Set<string>(),
    revealedCharacterIds: nodeIds,
  };

  const visibleByCharacter = new Map<string, GraphMembershipSource[]>();
  for (const membership of memberships) {
    if (!nodeIds.has(membership.characterId)) {
      continue;
    }
    if (!isMembershipVisibleInContext({ context, membership })) {
      continue;
    }
    const current = visibleByCharacter.get(membership.characterId) ?? [];
    current.push(membership);
    visibleByCharacter.set(membership.characterId, current);
  }

  const clusterIdByNodeId = new Map<string, string>();
  const accumulator = new Map<string, { group: GraphMembershipGroup; size: number }>();
  for (const node of nodes) {
    const visible = visibleByCharacter.get(node.id);
    if (visible === undefined) {
      continue;
    }
    const representative = pickRepresentativeMembership(visible);
    clusterIdByNodeId.set(node.id, representative.group.id);
    const entry = accumulator.get(representative.group.id);
    if (entry === undefined) {
      accumulator.set(representative.group.id, { group: representative.group, size: 1 });
    } else {
      entry.size += 1;
    }
  }

  const clusters: CharacterGraphClusterView[] = [...accumulator.values()]
    .map(({ group, size }) => ({
      groupType: CharacterGroupTypeSchema.parse(group.type),
      id: group.id,
      kind: "group" as const,
      name: group.isSpoiler ? null : group.name,
      size,
    }))
    .sort((left, right) => right.size - left.size || left.id.localeCompare(right.id));

  return { clusterIdByNodeId, clusters };
}

function computeImportanceClusters({ nodes }: { nodes: CharacterGraphNodeView[] }): ClusterResult {
  const clusterIdByNodeId = new Map<string, string>();
  const sizeByImportance = new Map<BookCharacterImportance, number>();
  for (const node of nodes) {
    if (node.importance === null) {
      continue;
    }
    clusterIdByNodeId.set(node.id, node.importance);
    sizeByImportance.set(node.importance, (sizeByImportance.get(node.importance) ?? 0) + 1);
  }

  const order = BookCharacterImportanceSchema.options;
  const clusters: CharacterGraphClusterView[] = [...sizeByImportance.entries()]
    .map(([importance, size]) => ({
      id: importance,
      importance,
      kind: "importance" as const,
      size,
    }))
    .sort((left, right) => order.indexOf(left.importance) - order.indexOf(right.importance));

  return { clusterIdByNodeId, clusters };
}

function computeModeCategories(mode: CharacterGraphMode): Nullable<Set<RelationshipCategory>> {
  const categories = MODE_CATEGORIES[mode];
  return categories === null ? null : new Set(categories);
}

function computeUpdatedAt({
  edges,
  nodeById,
  nodeIds,
}: {
  edges: PreparedEdge[];
  nodeById: Map<string, GraphNodeSource>;
  nodeIds: Set<string>;
}): Nullable<string> {
  let latest: Nullable<Date> = null;
  for (const edge of edges) {
    latest = maxNullableDate(latest, edge.updatedAt);
  }
  for (const id of nodeIds) {
    const node = nodeById.get(id);
    if (node !== undefined) {
      latest = maxNullableDate(latest, node.updatedAt);
    }
  }
  return latest === null ? null : latest.toISOString();
}

function detectGraphFamilyDiagnostics(
  edges: PreparedEdge[],
): CharacterRelationshipDiagnosticView[] {
  const ancestryEdges: AncestryEdge[] = [];
  for (const edge of edges) {
    if (edge.typeHidden || edge.category !== "family" || edge.type === null) {
      continue;
    }
    const role = getFamilyAncestryRole(edge.type);
    if (role === undefined) {
      continue;
    }
    ancestryEdges.push(
      role === "ancestor"
        ? { ancestorId: edge.source, descendantId: edge.target }
        : { ancestorId: edge.target, descendantId: edge.source },
    );
  }

  const cycle = findAncestryCycle(ancestryEdges);
  if (cycle === null) {
    return [];
  }
  return [
    {
      characterIds: cycle,
      code: CHARACTER_RELATIONSHIP_ERROR_CODES.familyCycleDetected,
      message: "The visible family relationships form an ancestry cycle",
      severity: "conflict",
    },
  ];
}

function findAncestryCycle(edges: AncestryEdge[]): Nullable<string[]> {
  const adjacency = new Map<string, string[]>();
  const nodes = new Set<string>();
  for (const edge of edges) {
    nodes.add(edge.ancestorId);
    nodes.add(edge.descendantId);
    addAdjacency({ adjacency, from: edge.ancestorId, to: edge.descendantId });
  }

  const state = new Map<string, "done" | "visiting">();
  const stack: string[] = [];
  const visit = (node: string): Nullable<string[]> => {
    state.set(node, "visiting");
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const status = state.get(next);
      if (status === "visiting") {
        return stack.slice(stack.indexOf(next));
      }
      if (status === undefined) {
        const found = visit(next);
        if (found !== null) {
          return found;
        }
      }
    }
    stack.pop();
    state.set(node, "done");
    return null;
  };

  for (const node of nodes) {
    if (state.get(node) === undefined) {
      const found = visit(node);
      if (found !== null) {
        return found;
      }
    }
  }
  return null;
}

function maxDate(left: Date, right: Date): Date {
  return compareAsc(left, right) >= 0 ? left : right;
}

function maxNullableDate(current: Nullable<Date>, candidate: Date): Date {
  return current === null ? candidate : maxDate(current, candidate);
}

function passesCategoryFilter({
  category,
  effectiveCategories,
}: {
  category: Nullable<RelationshipCategory>;
  effectiveCategories: Nullable<Set<RelationshipCategory>>;
}): boolean {
  if (effectiveCategories === null) {
    return true;
  }
  return category !== null && effectiveCategories.has(category);
}

function passesTypeFilter({
  type,
  typeFilter,
}: {
  type: Nullable<RelationshipType>;
  typeFilter: Nullable<Set<RelationshipType>>;
}): boolean {
  if (typeFilter === null) {
    return true;
  }
  return type !== null && typeFilter.has(type);
}

function pickRepresentativeMembership(memberships: GraphMembershipSource[]): GraphMembershipSource {
  return memberships.reduce((best, candidate) =>
    candidate.group.id < best.group.id ? candidate : best,
  );
}

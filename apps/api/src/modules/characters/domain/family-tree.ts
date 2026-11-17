import type {
  CharacterGraphEdgeView,
  CharacterGraphNodeView,
  CharacterRelationshipDiagnosticView,
  FamilyTreeGraphView,
  FamilyTreeLineageKind,
  FamilyTreeLineageView,
  Nullable,
  RelationshipCategory,
  RelationshipType,
} from "@app/shared";

import { CHARACTER_RELATIONSHIP_ERROR_CODES } from "@app/shared";
import { createHash } from "node:crypto";

import type {
  AncestryEdge,
  GraphEdgeSource,
  GraphNodeSource,
  PreparedEdge,
} from "./character-graph.js";
import type { RelationshipReaderContext } from "./relationship-reader-projection.js";

import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import {
  computeDegrees,
  computeUpdatedAt,
  computeVisibleGraphEdges,
  findAncestryCycle,
  toGraphEdgeView,
  toGraphNodeView,
} from "./character-graph.js";

const FAMILY_TREE_VERSION_LENGTH = 16;

const LINEAGE_RULES: ReadonlyMap<RelationshipType, LineageRule> = new Map<
  RelationshipType,
  LineageRule
>([
  ["adoptive_child_of", { kind: "adoptive", parentSide: "target" }],
  ["adoptive_parent_of", { kind: "adoptive", parentSide: "source" }],
  ["biological_child_of", { kind: "biological", parentSide: "target" }],
  ["biological_parent_of", { kind: "biological", parentSide: "source" }],
  ["step_child_of", { kind: "step", parentSide: "target" }],
  ["step_parent_of", { kind: "step", parentSide: "source" }],
]);

const AUXILIARY_TYPES: ReadonlySet<RelationshipType> = new Set<RelationshipType>([
  "ancestor_of",
  "custom",
  "descendant_of",
  "ex_spouse_of",
  "guardian_of",
  "half_sibling_of",
  "relative_of",
  "sibling_of",
  "spouse_of",
  "step_sibling_of",
  "twin_of",
  "ward_of",
]);

type BuildFamilyTreeInput = {
  ancestors: number;
  descendants: number;
  edgeLimit: number;
  edges: GraphEdgeSource[];
  focusCharacterId: string;
  nodeLimit: number;
  nodes: GraphNodeSource[];
  partNumberById: Map<string, Nullable<number>>;
  readerContext: RelationshipReaderContext;
};

type LineageLink = {
  edge: PreparedEdge;
  view: FamilyTreeLineageView;
};

type LineageRule = {
  kind: FamilyTreeLineageKind;
  parentSide: "source" | "target";
};

type RankedNode = {
  distance: number;
  id: string;
};

export function buildFamilyTreeGraph(input: BuildFamilyTreeInput): FamilyTreeGraphView {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const familyEdges = computeVisibleGraphEdges({
    categoryFilter: new Set<RelationshipCategory>(["family"]),
    edges: input.edges,
    mode: "all",
    nodes: input.nodes,
    readerContext: input.readerContext,
    revealEdgeIds: new Set(),
    typeFilter: null,
  }).filter((edge) => !edge.typeHidden && edge.type !== null);
  const links = collectLineageLinks(familyEdges);
  const ranked = nodeById.has(input.focusCharacterId)
    ? rankLineageNodes({
        ancestors: input.ancestors,
        descendants: input.descendants,
        focusCharacterId: input.focusCharacterId,
        links,
      })
    : [];
  const rankedIds = ranked.slice(0, input.nodeLimit).map((node) => node.id);
  const includedIds = new Set(rankedIds);
  const lineageLinks = links
    .filter((link) => includedIds.has(link.view.parentId) && includedIds.has(link.view.childId))
    .sort((left, right) => left.edge.id.localeCompare(right.edge.id));
  const lineageEdgeIds = new Set(lineageLinks.map((link) => link.edge.id));

  const auxiliaryCandidates = familyEdges
    .filter(
      (edge) =>
        !lineageEdgeIds.has(edge.id) &&
        isAuxiliaryEdge(edge) &&
        (includedIds.has(edge.source) || includedIds.has(edge.target)),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  let sideNodesDropped = false;
  for (const edge of auxiliaryCandidates) {
    for (const endpoint of [edge.source, edge.target]) {
      if (includedIds.has(endpoint)) {
        continue;
      }
      if (includedIds.size >= input.nodeLimit) {
        sideNodesDropped = true;
        continue;
      }
      includedIds.add(endpoint);
    }
  }
  const auxiliaryEdges = auxiliaryCandidates.filter(
    (edge) => includedIds.has(edge.source) && includedIds.has(edge.target),
  );
  const keptEdges = [...lineageLinks.map((link) => link.edge), ...auxiliaryEdges].slice(
    0,
    input.edgeLimit,
  );
  const keptEdgeIds = new Set(keptEdges.map((edge) => edge.id));
  const { diagnostics, lineage } = separateLineageConflicts(
    lineageLinks.filter((link) => keptEdgeIds.has(link.edge.id)),
  );

  const degreeById = computeDegrees(keptEdges);
  const nodes = [...includedIds]
    .map((id) => nodeById.get(id))
    .filter((node): node is GraphNodeSource => node !== undefined)
    .map((node) =>
      toGraphNodeView({
        degree: degreeById.get(node.id) ?? 0,
        node,
        partNumberById: input.partNumberById,
      }),
    )
    .sort(compareTreeNodes);
  const edges = keptEdges
    .map((edge) => toGraphEdgeView(edge))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    ancestors: input.ancestors,
    descendants: input.descendants,
    diagnostics,
    edges,
    focusCharacterId: input.focusCharacterId,
    graphVersion: computeFamilyTreeVersion({ edges, input, lineage, nodes }),
    hiddenContent: {
      hasHiddenEdges: false,
      hasLockedEdges: false,
      truncated:
        ranked.length > rankedIds.length ||
        sideNodesDropped ||
        keptEdges.length < lineageLinks.length + auxiliaryEdges.length,
    },
    lineage,
    nodes,
    projection: "family_tree",
    updatedAt: computeUpdatedAt({ edges: keptEdges, nodeById, nodeIds: includedIds }),
  };
}

function collectLineageLinks(edges: PreparedEdge[]): LineageLink[] {
  const links: LineageLink[] = [];
  for (const edge of edges) {
    const rule = edge.type === null ? undefined : LINEAGE_RULES.get(edge.type);
    if (rule === undefined || edge.directionality !== "directed") {
      continue;
    }
    const parentId = rule.parentSide === "source" ? edge.source : edge.target;
    const childId = rule.parentSide === "source" ? edge.target : edge.source;
    if (parentId === childId) {
      continue;
    }
    links.push({
      edge,
      view: { childId, kind: rule.kind, parentId, relationshipId: edge.id },
    });
  }
  return links;
}

function compareTreeNodes(left: CharacterGraphNodeView, right: CharacterGraphNodeView): number {
  return (
    UKRAINIAN_COLLATION.compare(left.displayName, right.displayName) ||
    left.id.localeCompare(right.id)
  );
}

function computeFamilyTreeVersion({
  edges,
  input,
  lineage,
  nodes,
}: {
  edges: CharacterGraphEdgeView[];
  input: BuildFamilyTreeInput;
  lineage: FamilyTreeLineageView[];
  nodes: CharacterGraphNodeView[];
}): string {
  const serialized = [
    "family_tree",
    input.focusCharacterId,
    String(input.ancestors),
    String(input.descendants),
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
  ].join("|");
  return createHash("sha256").update(serialized).digest("hex").slice(0, FAMILY_TREE_VERSION_LENGTH);
}

function indexLinks({
  key,
  links,
}: {
  key: "childId" | "parentId";
  links: LineageLink[];
}): Map<string, LineageLink[]> {
  const index = new Map<string, LineageLink[]>();
  for (const link of links) {
    const owner = link.view[key];
    const current = index.get(owner) ?? [];
    current.push(link);
    index.set(owner, current);
  }
  for (const entries of index.values()) {
    entries.sort((left, right) => left.edge.id.localeCompare(right.edge.id));
  }
  return index;
}

function isAuxiliaryEdge(edge: PreparedEdge): boolean {
  return edge.type !== null && AUXILIARY_TYPES.has(edge.type);
}

function rankLineageNodes({
  ancestors,
  descendants,
  focusCharacterId,
  links,
}: {
  ancestors: number;
  descendants: number;
  focusCharacterId: string;
  links: LineageLink[];
}): RankedNode[] {
  const parentsByChild = indexLinks({ key: "childId", links });
  const childrenByParent = indexLinks({ key: "parentId", links });
  const distanceById = new Map<string, number>([[focusCharacterId, 0]]);
  const admit = (id: string, distance: number): boolean => {
    if (distanceById.has(id)) {
      return false;
    }
    distanceById.set(id, distance);
    return true;
  };

  let frontier = [focusCharacterId];
  for (let generation = 1; generation <= ancestors; generation += 1) {
    const next: string[] = [];
    for (const childId of frontier) {
      for (const link of parentsByChild.get(childId) ?? []) {
        if (admit(link.view.parentId, generation)) {
          next.push(link.view.parentId);
        }
      }
    }
    frontier = next;
  }

  frontier = [focusCharacterId];
  for (let generation = 1; generation <= descendants; generation += 1) {
    const next: string[] = [];
    for (const parentId of frontier) {
      for (const link of childrenByParent.get(parentId) ?? []) {
        if (admit(link.view.childId, generation)) {
          next.push(link.view.childId);
        }
      }
    }
    for (const childId of next) {
      for (const link of parentsByChild.get(childId) ?? []) {
        admit(link.view.parentId, generation);
      }
    }
    frontier = next;
  }

  return [...distanceById.entries()]
    .map(([id, distance]) => ({ distance, id }))
    .sort((left, right) => left.distance - right.distance || left.id.localeCompare(right.id));
}

function separateLineageConflicts(links: LineageLink[]): {
  diagnostics: CharacterRelationshipDiagnosticView[];
  lineage: FamilyTreeLineageView[];
} {
  const diagnostics: CharacterRelationshipDiagnosticView[] = [];
  let remaining = links;
  for (let attempt = 0; attempt < links.length; attempt += 1) {
    const ancestryEdges: AncestryEdge[] = remaining.map((link) => ({
      ancestorId: link.view.parentId,
      descendantId: link.view.childId,
    }));
    const cycle = findAncestryCycle(ancestryEdges);
    if (cycle === null) {
      break;
    }
    const cycleSteps = new Set(
      cycle.map((id, index) => `${id}>${cycle[(index + 1) % cycle.length]}`),
    );
    remaining = remaining.filter(
      (link) => !cycleSteps.has(`${link.view.parentId}>${link.view.childId}`),
    );
    diagnostics.push({
      characterIds: cycle,
      code: CHARACTER_RELATIONSHIP_ERROR_CODES.familyCycleDetected,
      message: "The visible parent and child relationships form a cycle",
      severity: "conflict",
    });
  }
  return { diagnostics, lineage: remaining.map((link) => link.view) };
}

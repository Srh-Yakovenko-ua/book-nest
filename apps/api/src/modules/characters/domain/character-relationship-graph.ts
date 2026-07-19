import type {
  Nullable,
  RelationshipDiagnosticSeverity,
  RelationshipDirectionality,
  RelationshipType,
} from "@app/shared";

import { CHARACTER_RELATIONSHIP_ERROR_CODES, getFamilyAncestryRole } from "@app/shared";

export type CanonicalEndpoints = {
  sourceCharacterId: string;
  sourceLabel: Nullable<string>;
  targetCharacterId: string;
  targetLabel: Nullable<string>;
};

export type FamilyDiagnostic = {
  characterIds: string[];
  code: string;
  message: string;
  severity: RelationshipDiagnosticSeverity;
};

export type RelationshipEdgeEndpoints = {
  sourceCharacterId: string;
  targetCharacterId: string;
  type: RelationshipType;
};

export function buildRelationshipLockKey({
  directionality,
  normalizedCustomType,
  sourceCharacterId,
  targetCharacterId,
  type,
  userId,
}: {
  directionality: RelationshipDirectionality;
  normalizedCustomType: Nullable<string>;
  sourceCharacterId: string;
  targetCharacterId: string;
  type: RelationshipType;
  userId: string;
}): string {
  const prefix = directionality === "directed" ? "d" : "s";
  const suffix = type === "custom" ? `custom:${normalizedCustomType ?? ""}` : type;
  return `crel:${userId}:${prefix}:${sourceCharacterId}:${targetCharacterId}:${suffix}`;
}

export function canonicalizeRelationshipEndpoints({
  directionality,
  sourceCharacterId,
  sourceLabel,
  targetCharacterId,
  targetLabel,
}: {
  directionality: RelationshipDirectionality;
  sourceCharacterId: string;
  sourceLabel: Nullable<string>;
  targetCharacterId: string;
  targetLabel: Nullable<string>;
}): CanonicalEndpoints {
  if (directionality === "directed" || sourceCharacterId <= targetCharacterId) {
    return { sourceCharacterId, sourceLabel, targetCharacterId, targetLabel };
  }
  return {
    sourceCharacterId: targetCharacterId,
    sourceLabel: targetLabel,
    targetCharacterId: sourceCharacterId,
    targetLabel: sourceLabel,
  };
}

export function detectFamilyDiagnostics({
  candidate,
  existingEdges,
}: {
  candidate: RelationshipEdgeEndpoints;
  existingEdges: RelationshipEdgeEndpoints[];
}): FamilyDiagnostic[] {
  const candidateAncestry = toAncestryEdge(candidate);
  if (candidateAncestry === null) {
    return [];
  }

  const adjacency = buildAncestryAdjacency(existingEdges);
  const reach = shortestAncestryDistance({
    adjacency,
    from: candidateAncestry.descendantId,
    to: candidateAncestry.ancestorId,
  });
  if (reach === null) {
    return [];
  }

  const characterIds = [candidateAncestry.ancestorId, candidateAncestry.descendantId];
  if (reach === 1) {
    return [
      {
        characterIds,
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.familyCycleDetected,
        message: "These characters are already recorded as each other's direct ancestor",
        severity: "conflict",
      },
    ];
  }
  return [
    {
      characterIds,
      code: CHARACTER_RELATIONSHIP_ERROR_CODES.familyCycleDetected,
      message: "This relationship closes a family ancestry cycle",
      severity: "warning",
    },
  ];
}

function buildAncestryAdjacency(edges: RelationshipEdgeEndpoints[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const ancestry = toAncestryEdge(edge);
    if (ancestry === null) {
      continue;
    }
    const descendants = adjacency.get(ancestry.ancestorId) ?? [];
    descendants.push(ancestry.descendantId);
    adjacency.set(ancestry.ancestorId, descendants);
  }
  return adjacency;
}

function shortestAncestryDistance({
  adjacency,
  from,
  to,
}: {
  adjacency: Map<string, string[]>;
  from: string;
  to: string;
}): Nullable<number> {
  const visited = new Set<string>([from]);
  let frontier = [from];
  let distance = 0;
  while (frontier.length > 0) {
    distance += 1;
    const next: string[] = [];
    for (const node of frontier) {
      for (const descendant of adjacency.get(node) ?? []) {
        if (descendant === to) {
          return distance;
        }
        if (!visited.has(descendant)) {
          visited.add(descendant);
          next.push(descendant);
        }
      }
    }
    frontier = next;
  }
  return null;
}

function toAncestryEdge(
  edge: RelationshipEdgeEndpoints,
): Nullable<{ ancestorId: string; descendantId: string }> {
  const role = getFamilyAncestryRole(edge.type);
  if (role === undefined) {
    return null;
  }
  if (role === "ancestor") {
    return { ancestorId: edge.sourceCharacterId, descendantId: edge.targetCharacterId };
  }
  return { ancestorId: edge.targetCharacterId, descendantId: edge.sourceCharacterId };
}

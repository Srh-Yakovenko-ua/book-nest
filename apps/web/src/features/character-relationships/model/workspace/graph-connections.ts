import type { CharacterGraphEdgeView } from "@app/shared";

export type GraphConnection = {
  direction: GraphConnectionDirection;
  edgeIds: string[];
  hasMaskedSemantics: boolean;
  id: string;
  sourceId: string;
  targetId: string;
};

export type GraphConnectionDirection =
  | { kind: "directed"; sourceId: string; targetId: string }
  | { kind: "mixed" }
  | { kind: "symmetric" };

const CONNECTION_ID_PREFIX = "pair";

export function toGraphConnectionId(leftId: string, rightId: string): string {
  const [first, second] = leftId < rightId ? [leftId, rightId] : [rightId, leftId];
  return `${CONNECTION_ID_PREFIX}:${first}:${second}`;
}

export function toGraphConnections(edges: readonly CharacterGraphEdgeView[]): GraphConnection[] {
  const edgesByPair = new Map<string, CharacterGraphEdgeView[]>();
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    const id = toGraphConnectionId(edge.source, edge.target);
    const current = edgesByPair.get(id) ?? [];
    current.push(edge);
    edgesByPair.set(id, current);
  }
  return [...edgesByPair.entries()]
    .map(([id, pairEdges]) => {
      const sorted = [...pairEdges].sort((left, right) => left.id.localeCompare(right.id));
      const [first] = sorted;
      const sourceId = first === undefined ? "" : minId(first.source, first.target);
      const targetId = first === undefined ? "" : maxId(first.source, first.target);
      return {
        direction: toConnectionDirection(sorted),
        edgeIds: sorted.map((edge) => edge.id),
        hasMaskedSemantics: sorted.some((edge) => edge.typeHidden || edge.type === null),
        id,
        sourceId,
        targetId,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function maxId(left: string, right: string): string {
  return left < right ? right : left;
}

function minId(left: string, right: string): string {
  return left < right ? left : right;
}

function toConnectionDirection(edges: readonly CharacterGraphEdgeView[]): GraphConnectionDirection {
  const [first] = edges;
  if (first === undefined) return { kind: "mixed" };
  const isKnown = edges.every((edge) => !edge.typeHidden && edge.directionality !== null);
  if (!isKnown) return { kind: "mixed" };
  if (edges.every((edge) => edge.directionality === "symmetric")) return { kind: "symmetric" };
  const sameDirection = edges.every(
    (edge) =>
      edge.directionality === "directed" &&
      edge.source === first.source &&
      edge.target === first.target,
  );
  return sameDirection
    ? { kind: "directed", sourceId: first.source, targetId: first.target }
    : { kind: "mixed" };
}

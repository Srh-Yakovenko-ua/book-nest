import type { CharacterGraphEdgeView, Nullable } from "@app/shared";

import type { RelationshipGraphPoint } from "./relationship-graph-layout";

export type RelationshipGraphEdgeGeometry = {
  arrow: Nullable<string>;
  label: RelationshipGraphPoint;
  path: string;
};

export type RelationshipGraphRect = { height: number; width: number; x: number; y: number };

const EDGE_GEOMETRY = {
  arrowHalfWidth: 5,
  arrowLength: 11,
  laneGap: 16,
} as const;

export function toRelationshipGraphEdgeGeometry({
  isDirected,
  lane,
  source,
  target,
}: {
  isDirected: boolean;
  lane: number;
  source: RelationshipGraphRect;
  target: RelationshipGraphRect;
}): Nullable<RelationshipGraphEdgeGeometry> {
  const sourceCenter = centerOf(source);
  const targetCenter = centerOf(target);
  const distance = Math.hypot(targetCenter.x - sourceCenter.x, targetCenter.y - sourceCenter.y);
  if (distance === 0) return null;

  const direction = {
    x: (targetCenter.x - sourceCenter.x) / distance,
    y: (targetCenter.y - sourceCenter.y) / distance,
  };
  const normal = { x: -direction.y, y: direction.x };
  const shift = scale(normal, lane * EDGE_GEOMETRY.laneGap);
  const start = add(boundaryPoint({ direction, rect: source }), shift);
  const end = add(boundaryPoint({ direction: scale(direction, -1), rect: target }), shift);
  const label = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  if (!isDirected) return { arrow: null, label, path: toLinePath(start, end) };

  const base = add(end, scale(direction, -EDGE_GEOMETRY.arrowLength));
  const wing = scale(normal, EDGE_GEOMETRY.arrowHalfWidth);
  return {
    arrow: [end, add(base, wing), add(base, scale(wing, -1))]
      .map((point) => `${point.x},${point.y}`)
      .join(" "),
    label,
    path: toLinePath(start, base),
  };
}

export function toRelationshipGraphEdgeLanes(
  edges: Pick<CharacterGraphEdgeView, "id" | "source" | "target">[],
): ReadonlyMap<string, number> {
  const edgesByPair = new Map<string, Pick<CharacterGraphEdgeView, "id" | "source" | "target">[]>();
  for (const edge of edges) {
    const pairKey = [edge.source, edge.target].sort().join(":");
    edgesByPair.set(pairKey, [...(edgesByPair.get(pairKey) ?? []), edge]);
  }

  return new Map(
    [...edgesByPair.values()].flatMap((pairEdges) => {
      const sorted = [...pairEdges].sort((left, right) => (left.id < right.id ? -1 : 1));
      return sorted.map((edge, index) => {
        const orientation = edge.source < edge.target ? 1 : -1;
        return [edge.id, orientation * (index - (sorted.length - 1) / 2)] as const;
      });
    }),
  );
}

function add(point: RelationshipGraphPoint, delta: RelationshipGraphPoint): RelationshipGraphPoint {
  return { x: point.x + delta.x, y: point.y + delta.y };
}

function boundaryPoint({
  direction,
  rect,
}: {
  direction: RelationshipGraphPoint;
  rect: RelationshipGraphRect;
}): RelationshipGraphPoint {
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const reach = Math.min(
    direction.x === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(direction.x),
    direction.y === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(direction.y),
  );
  return add(centerOf(rect), scale(direction, reach));
}

function centerOf(rect: RelationshipGraphRect): RelationshipGraphPoint {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function scale(point: RelationshipGraphPoint, factor: number): RelationshipGraphPoint {
  return { x: point.x * factor, y: point.y * factor };
}

function toLinePath(start: RelationshipGraphPoint, end: RelationshipGraphPoint): string {
  return `M ${start.x},${start.y} L ${end.x},${end.y}`;
}

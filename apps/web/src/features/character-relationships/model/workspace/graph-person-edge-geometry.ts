import type { Nullable } from "@app/shared";

import type { RelationshipGraphPoint } from "../relationship-graph-layout";

export type GraphPersonCircle = { center: RelationshipGraphPoint; radius: number };

export type GraphPersonEdgeGeometry = {
  arrow: Nullable<string>;
  freeLength: number;
  label: RelationshipGraphPoint;
  path: string;
};

const PERSON_EDGE_GEOMETRY = {
  arrowHalfWidth: 5,
  arrowLength: 10,
  gap: 4,
} as const;

export function toGraphPersonEdgeGeometry({
  isDirected,
  source,
  target,
}: {
  isDirected: boolean;
  source: GraphPersonCircle;
  target: GraphPersonCircle;
}): Nullable<GraphPersonEdgeGeometry> {
  const delta = { x: target.center.x - source.center.x, y: target.center.y - source.center.y };
  const distance = Math.hypot(delta.x, delta.y);
  const startOffset = source.radius + PERSON_EDGE_GEOMETRY.gap;
  const endOffset = target.radius + PERSON_EDGE_GEOMETRY.gap;
  if (distance <= startOffset + endOffset) return null;

  const direction = { x: delta.x / distance, y: delta.y / distance };
  const start = along(source.center, direction, startOffset);
  const end = along(target.center, direction, -endOffset);
  const label = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const freeLength = distance - startOffset - endOffset;

  if (!isDirected) return { arrow: null, freeLength, label, path: toLinePath(start, end) };

  const base = along(end, direction, -PERSON_EDGE_GEOMETRY.arrowLength);
  const wing = {
    x: -direction.y * PERSON_EDGE_GEOMETRY.arrowHalfWidth,
    y: direction.x * PERSON_EDGE_GEOMETRY.arrowHalfWidth,
  };
  return {
    arrow: [
      end,
      { x: base.x + wing.x, y: base.y + wing.y },
      { x: base.x - wing.x, y: base.y - wing.y },
    ]
      .map((point) => `${point.x},${point.y}`)
      .join(" "),
    freeLength,
    label,
    path: toLinePath(start, base),
  };
}

function along(
  point: RelationshipGraphPoint,
  direction: RelationshipGraphPoint,
  length: number,
): RelationshipGraphPoint {
  return { x: point.x + direction.x * length, y: point.y + direction.y * length };
}

function toLinePath(start: RelationshipGraphPoint, end: RelationshipGraphPoint): string {
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

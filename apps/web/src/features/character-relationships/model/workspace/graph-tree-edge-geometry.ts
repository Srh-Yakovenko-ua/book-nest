import type { Nullable } from "@app/shared";

import type { RelationshipGraphPoint } from "../relationship-graph-layout";

export type TreeEdgeBox = { height: number; width: number; x: number; y: number };

export type TreeEdgeGeometry = {
  label: RelationshipGraphPoint;
  path: string;
};

const TREE_EDGE_GEOMETRY = {
  arcLift: 44,
  busOffset: 36,
  corner: 10,
  minBusGap: 12,
} as const;

export function toTreeArcGeometry({
  source,
  target,
}: {
  source: TreeEdgeBox;
  target: TreeEdgeBox;
}): TreeEdgeGeometry {
  const [left, right] = centerX(source) <= centerX(target) ? [source, target] : [target, source];
  const start = { x: centerX(left) + left.width / 4, y: left.y };
  const end = { x: centerX(right) - right.width / 4, y: right.y };
  const lift = Math.min(start.y, end.y) - TREE_EDGE_GEOMETRY.arcLift;
  return {
    label: { x: (start.x + end.x) / 2, y: lift + TREE_EDGE_GEOMETRY.arcLift / 4 },
    path: `M ${start.x} ${start.y} C ${start.x} ${lift}, ${end.x} ${lift}, ${end.x} ${end.y}`,
  };
}

export function toTreeLineageGeometry({
  child,
  parent,
}: {
  child: TreeEdgeBox;
  parent: TreeEdgeBox;
}): TreeEdgeGeometry {
  const start = { x: centerX(parent), y: parent.y + parent.height };
  const end = { x: centerX(child), y: child.y };
  const gap = end.y - start.y;
  if (gap <= TREE_EDGE_GEOMETRY.minBusGap)
    return toTreeStraightGeometry({ source: parent, target: child });
  const busY = end.y - Math.min(TREE_EDGE_GEOMETRY.busOffset, gap / 2);
  const horizontal = end.x - start.x;
  if (Math.abs(horizontal) < 1) {
    return {
      label: { x: end.x, y: busY },
      path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
    };
  }
  const corner = Math.min(
    TREE_EDGE_GEOMETRY.corner,
    Math.abs(horizontal) / 2,
    (busY - start.y) / 2,
    (end.y - busY) / 2,
  );
  const direction = Math.sign(horizontal);
  return {
    label: { x: end.x, y: (busY + end.y) / 2 },
    path: [
      `M ${start.x} ${start.y}`,
      `L ${start.x} ${busY - corner}`,
      `Q ${start.x} ${busY} ${start.x + direction * corner} ${busY}`,
      `L ${end.x - direction * corner} ${busY}`,
      `Q ${end.x} ${busY} ${end.x} ${busY + corner}`,
      `L ${end.x} ${end.y}`,
    ].join(" "),
  };
}

export function toTreeStraightGeometry({
  source,
  target,
}: {
  source: TreeEdgeBox;
  target: TreeEdgeBox;
}): TreeEdgeGeometry {
  const from = center(source);
  const to = center(target);
  const start = clipToBox({ box: source, from, toward: to }) ?? from;
  const end = clipToBox({ box: target, from: to, toward: from }) ?? to;
  return {
    label: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
  };
}

function center(box: TreeEdgeBox): RelationshipGraphPoint {
  return { x: centerX(box), y: box.y + box.height / 2 };
}

function centerX(box: TreeEdgeBox): number {
  return box.x + box.width / 2;
}

function clipToBox({
  box,
  from,
  toward,
}: {
  box: TreeEdgeBox;
  from: RelationshipGraphPoint;
  toward: RelationshipGraphPoint;
}): Nullable<RelationshipGraphPoint> {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  if (dx === 0 && dy === 0) return null;
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : box.width / 2 / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : box.height / 2 / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY, 1);
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

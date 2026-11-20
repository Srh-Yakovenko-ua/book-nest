import type { Nullable } from "@app/shared";

import type { RelationshipGraphPoint } from "../relationship-graph-layout";

export type GraphPersonRing = { hop: number; labelAngle: number; radius: number };

export type GraphPersonRings = {
  center: RelationshipGraphPoint;
  radii: readonly GraphPersonRing[];
};

const RING_MATCH = {
  tolerance: 6,
} as const;

export function toGraphPersonRings({
  hops,
  positions,
}: {
  hops: ReadonlyMap<string, number>;
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
}): Nullable<GraphPersonRings> {
  const rootId = [...hops.entries()].find(([, hop]) => hop === 0)?.[0];
  const center = rootId === undefined ? undefined : positions.get(rootId);
  if (center === undefined) return null;

  const pointsByHop = new Map<number, RelationshipGraphPoint[]>();
  for (const [id, hop] of hops) {
    const point = positions.get(id);
    if (hop === 0 || point === undefined) continue;
    pointsByHop.set(hop, [...(pointsByHop.get(hop) ?? []), point]);
  }

  const radii = [...pointsByHop.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([hop, points]): GraphPersonRing[] => {
      const distances = points.map((point) => Math.hypot(point.x - center.x, point.y - center.y));
      const nearest = Math.min(...distances);
      const farthest = Math.max(...distances);
      if (farthest - nearest > RING_MATCH.tolerance) return [];
      const angles = points.map((point) => Math.atan2(point.y - center.y, point.x - center.x));
      return [{ hop, labelAngle: toWidestGapMiddle(angles), radius: (nearest + farthest) / 2 }];
    });

  return radii.length === 0 ? null : { center, radii };
}

function toWidestGapMiddle(angles: readonly number[]): number {
  const sorted = [...angles].sort((left, right) => left - right);
  const [first] = sorted;
  if (first === undefined) return -Math.PI / 2;
  let bestStart = first;
  let bestGap = 0;
  sorted.forEach((angle, index) => {
    const next = sorted[index + 1] ?? first + 2 * Math.PI;
    if (next - angle > bestGap) {
      bestGap = next - angle;
      bestStart = angle;
    }
  });
  return bestStart + bestGap / 2;
}

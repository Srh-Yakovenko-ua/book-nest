import type { Nullable } from "@app/shared";

import { assertNever } from "@/lib/assert-never";

import type { RelationshipGraphPoint } from "../relationship-graph-layout";
import type { NetworkAggregateLink, NetworkBucket } from "./graph-network-index";
import type { NetworkScene } from "./graph-network-scene";
import type { GraphWorkspacePositions } from "./graph-workspace-layout";

import { GRAPH_NODE_BOX } from "./graph-workspace-layout";

export const NETWORK_LAYOUT = {
  firstAngle: -Math.PI / 2,
  focus: { memberGap: 32, neighborClearance: 64, neighborGap: 24 },
  originPull: 0.25,
  overview: { bucketGap: 48, occlusionMargin: 8, occlusionMaxBuckets: 48, occlusionReach: 3 },
  revision: "network-3",
  tolerance: 1e-6,
} as const;

type Bounds = { maxX: number; maxY: number; minX: number; minY: number };

type CellSize = { height: number; width: number };

type FocusScene = Extract<NetworkScene, { kind: "focus" }>;

type GridCell = { column: number; row: number };

type Occlusion = { kind: "avoid"; obstacle: CellSize; reach: number } | { kind: "ignore" };

type OverviewScene = Extract<NetworkScene, { kind: "overview" }>;

type ScoredCell = { cell: GridCell; score: number };

type Segment = { end: RelationshipGraphPoint; start: RelationshipGraphPoint };

type WeightedPair = { leftId: string; rightId: string; weight: number };

type WeightMap = ReadonlyMap<string, ReadonlyMap<string, number>>;

export function layoutNetworkScene(scene: NetworkScene): GraphWorkspacePositions {
  switch (scene.kind) {
    case "focus":
      return layoutFocusScene(scene);
    case "overview":
      return layoutOverviewScene(scene);
    default:
      return assertNever(scene);
  }
}

function chooseCell({
  candidates,
  cellSize,
  penaltyOf,
  positions,
  weights,
}: {
  candidates: Iterable<GridCell>;
  cellSize: CellSize;
  penaltyOf: (point: RelationshipGraphPoint) => number;
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
  weights: ReadonlyMap<string, number>;
}): Nullable<GridCell> {
  let best: Nullable<ScoredCell> = null;
  for (const cell of candidates) {
    const point = toPoint({ cell, cellSize });
    let score = NETWORK_LAYOUT.originPull * Math.hypot(point.x, point.y);
    for (const [otherId, weight] of weights) {
      const other = positions.get(otherId);
      if (other !== undefined) score += weight * Math.hypot(point.x - other.x, point.y - other.y);
    }
    const scored = { cell, score: score + penaltyOf(point) };
    if (best === null || isBetterCell({ candidate: scored, current: best })) best = scored;
  }
  return best === null ? null : best.cell;
}

function countOcclusions({
  links,
  obstacle,
  point,
  positions,
  weights,
}: {
  links: readonly Segment[];
  obstacle: CellSize;
  point: RelationshipGraphPoint;
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
  weights: ReadonlyMap<string, number>;
}): number {
  let count = 0;
  for (const segment of links) {
    if (segmentCrossesBox({ box: obstacle, center: point, segment })) count += 1;
  }
  for (const otherId of weights.keys()) {
    const other = positions.get(otherId);
    if (other === undefined) continue;
    const segment = { end: other, start: point };
    if (isLinkObstructed({ obstacle, positions, segment, targetId: otherId })) count += 1;
  }
  return count;
}

function isBetterCell({
  candidate,
  current,
}: {
  candidate: ScoredCell;
  current: ScoredCell;
}): boolean {
  const delta = candidate.score - current.score;
  if (Math.abs(delta) > NETWORK_LAYOUT.tolerance) return delta < 0;
  if (candidate.cell.row !== current.cell.row) return candidate.cell.row < current.cell.row;
  return candidate.cell.column < current.cell.column;
}

function isLinkObstructed({
  obstacle,
  positions,
  segment,
  targetId,
}: {
  obstacle: CellSize;
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
  segment: Segment;
  targetId: string;
}): boolean {
  for (const [id, center] of positions) {
    if (id !== targetId && segmentCrossesBox({ box: obstacle, center, segment })) return true;
  }
  return false;
}

function layoutFocusScene(scene: FocusScene): GraphWorkspacePositions {
  const memberPositions = placeOnGrid({
    cellSize: toCellSize({ box: GRAPH_NODE_BOX.character, gap: NETWORK_LAYOUT.focus.memberGap }),
    ids: scene.memberIds,
    occlusion: { kind: "ignore" },
    weights: toWeightMap(
      scene.connections.map((connection) => ({
        leftId: connection.sourceId,
        rightId: connection.targetId,
        weight: 1,
      })),
    ),
  });
  const neighborPositions = placeNeighborRing({
    links: scene.links,
    memberPositions,
    neighbors: scene.neighbors,
  });
  return new Map([...memberPositions, ...neighborPositions]);
}

function layoutOverviewScene(scene: OverviewScene): GraphWorkspacePositions {
  const weights = toWeightMap(
    scene.links.map((link) => ({
      leftId: link.sourceId,
      rightId: link.targetId,
      weight: link.pairCount,
    })),
  );
  return placeOnGrid({
    cellSize: toCellSize({ box: GRAPH_NODE_BOX.cluster, gap: NETWORK_LAYOUT.overview.bucketGap }),
    ids: toOverviewOrder({ buckets: scene.buckets, weights }),
    occlusion: toOverviewOcclusion(scene.buckets.length),
    weights,
  });
}

function normalizeAngle(angle: number): number {
  const turn = 2 * Math.PI;
  return ((angle % turn) + turn) % turn;
}

function pickStrongest({
  candidates,
  scoreOf,
  sizeById,
}: {
  candidates: Iterable<string>;
  scoreOf: (id: string) => number;
  sizeById: ReadonlyMap<string, number>;
}): Nullable<string> {
  const isStronger = (id: string, than: string) =>
    (scoreOf(id) - scoreOf(than) ||
      (sizeById.get(id) ?? 0) - (sizeById.get(than) ?? 0) ||
      than.localeCompare(id)) > 0;
  let best: Nullable<string> = null;
  for (const id of candidates) {
    if (best === null || isStronger(id, best)) best = id;
  }
  return best;
}

function placeNeighborRing({
  links,
  memberPositions,
  neighbors,
}: {
  links: readonly NetworkAggregateLink[];
  memberPositions: ReadonlyMap<string, RelationshipGraphPoint>;
  neighbors: readonly NetworkBucket[];
}): Map<string, RelationshipGraphPoint> {
  if (neighbors.length === 0) return new Map();
  const bounds = toBounds({ box: GRAPH_NODE_BOX.character, points: [...memberPositions.values()] });
  const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  const clusterDiagonal = Math.hypot(GRAPH_NODE_BOX.cluster.width, GRAPH_NODE_BOX.cluster.height);
  const chord = clusterDiagonal + NETWORK_LAYOUT.focus.neighborGap;
  const radius = Math.max(
    Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2 +
      clusterDiagonal / 2 +
      NETWORK_LAYOUT.focus.neighborClearance,
    neighbors.length > 1 ? chord / (2 * Math.sin(Math.PI / neighbors.length)) : 0,
  );
  const desiredById = toDesiredAngles({
    center,
    links,
    memberPositions,
    neighborIds: new Set(neighbors.map((neighbor) => neighbor.id)),
  });
  const ring = neighbors
    .map((neighbor, index) => ({
      angle:
        desiredById.get(neighbor.id) ??
        normalizeAngle(NETWORK_LAYOUT.firstAngle + (2 * Math.PI * index) / neighbors.length),
      id: neighbor.id,
    }))
    .sort((left, right) => left.angle - right.angle || left.id.localeCompare(right.id));
  const angles = spreadRing({
    angles: ring.map((entry) => entry.angle),
    minStep: 2 * Math.asin(Math.min(1, chord / (2 * radius))),
  });
  return new Map(
    ring.map((entry, index): [string, RelationshipGraphPoint] => {
      const angle = angles[index] ?? entry.angle;
      return [
        entry.id,
        { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius },
      ];
    }),
  );
}

function placeOnGrid({
  cellSize,
  ids,
  occlusion,
  weights,
}: {
  cellSize: CellSize;
  ids: readonly string[];
  occlusion: Occlusion;
  weights: WeightMap;
}): Map<string, RelationshipGraphPoint> {
  const origin: GridCell = { column: 0, row: 0 };
  const positions = new Map<string, RelationshipGraphPoint>();
  const occupied = new Set<string>();
  const frontier = new Map<string, GridCell>([[toCellKey(origin), origin]]);
  const links: Segment[] = [];
  for (const id of ids) {
    const linkWeights = weights.get(id) ?? new Map<string, number>();
    const cell = chooseCell({
      candidates: frontier.values(),
      cellSize,
      penaltyOf: toOcclusionPenalty({
        cellSize,
        links,
        occlusion,
        positions,
        weights: linkWeights,
      }),
      positions,
      weights: linkWeights,
    });
    if (cell === null) continue;
    const key = toCellKey(cell);
    const point = toPoint({ cell, cellSize });
    frontier.delete(key);
    occupied.add(key);
    if (occlusion.kind === "avoid") {
      for (const otherId of linkWeights.keys()) {
        const other = positions.get(otherId);
        if (other !== undefined) links.push({ end: other, start: point });
      }
    }
    positions.set(id, point);
    for (const neighbor of toNeighborCells(cell)) {
      const neighborKey = toCellKey(neighbor);
      if (!occupied.has(neighborKey)) frontier.set(neighborKey, neighbor);
    }
  }
  return positions;
}

function segmentCrossesBox({
  box,
  center,
  segment,
}: {
  box: CellSize;
  center: RelationshipGraphPoint;
  segment: Segment;
}): boolean {
  const { end, start } = segment;
  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  if (Math.max(start.x, end.x) < center.x - halfWidth) return false;
  if (Math.min(start.x, end.x) > center.x + halfWidth) return false;
  if (Math.max(start.y, end.y) < center.y - halfHeight) return false;
  if (Math.min(start.y, end.y) > center.y + halfHeight) return false;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const offset = Math.abs(dx * (center.y - start.y) - dy * (center.x - start.x));
  return offset <= halfWidth * Math.abs(dy) + halfHeight * Math.abs(dx);
}

function spreadRing({ angles, minStep }: { angles: readonly number[]; minStep: number }): number[] {
  const spread = [...angles];
  for (let index = 1; index < spread.length; index += 1) {
    const previous = spread[index - 1] ?? 0;
    const current = spread[index] ?? 0;
    if (current - previous < minStep) spread[index] = previous + minStep;
  }
  const first = spread[0] ?? 0;
  const last = spread[spread.length - 1] ?? first;
  const fitsOneTurn = last - first <= 2 * Math.PI - minStep + NETWORK_LAYOUT.tolerance;
  if (spread.length < 2 || fitsOneTurn) return spread;
  return spread.map((_, index) => first + (2 * Math.PI * index) / spread.length);
}

function toBounds({
  box,
  points,
}: {
  box: CellSize;
  points: readonly RelationshipGraphPoint[];
}): Bounds {
  if (points.length === 0) return { maxX: 0, maxY: 0, minX: 0, minY: 0 };
  return {
    maxX: Math.max(...points.map((point) => point.x)) + box.width / 2,
    maxY: Math.max(...points.map((point) => point.y)) + box.height / 2,
    minX: Math.min(...points.map((point) => point.x)) - box.width / 2,
    minY: Math.min(...points.map((point) => point.y)) - box.height / 2,
  };
}

function toCellKey(cell: GridCell): string {
  return `${cell.column}:${cell.row}`;
}

function toCellSize({ box, gap }: { box: CellSize; gap: number }): CellSize {
  return { height: box.height + gap, width: box.width + gap };
}

function toDesiredAngles({
  center,
  links,
  memberPositions,
  neighborIds,
}: {
  center: RelationshipGraphPoint;
  links: readonly NetworkAggregateLink[];
  memberPositions: ReadonlyMap<string, RelationshipGraphPoint>;
  neighborIds: ReadonlySet<string>;
}): Map<string, number> {
  const vectorById = new Map<string, RelationshipGraphPoint>();
  for (const link of links) {
    const neighborId = neighborIds.has(link.sourceId) ? link.sourceId : link.targetId;
    const memberId = neighborId === link.sourceId ? link.targetId : link.sourceId;
    const member = memberPositions.get(memberId);
    if (member === undefined || !neighborIds.has(neighborId)) continue;
    const dx = member.x - center.x;
    const dy = member.y - center.y;
    const length = Math.hypot(dx, dy);
    if (length <= NETWORK_LAYOUT.tolerance) continue;
    const vector = vectorById.get(neighborId) ?? { x: 0, y: 0 };
    vectorById.set(neighborId, {
      x: vector.x + (link.pairCount * dx) / length,
      y: vector.y + (link.pairCount * dy) / length,
    });
  }
  const angleById = new Map<string, number>();
  for (const [id, vector] of vectorById) {
    if (Math.hypot(vector.x, vector.y) <= NETWORK_LAYOUT.tolerance) continue;
    angleById.set(id, normalizeAngle(Math.atan2(vector.y, vector.x)));
  }
  return angleById;
}

function toNeighborCells(cell: GridCell): GridCell[] {
  return [-1, 0, 1].flatMap((rowStep) =>
    [-1, 0, 1].flatMap((columnStep) =>
      rowStep === 0 && columnStep === 0
        ? []
        : [{ column: cell.column + columnStep, row: cell.row + rowStep }],
    ),
  );
}

function toOcclusionPenalty({
  cellSize,
  links,
  occlusion,
  positions,
  weights,
}: {
  cellSize: CellSize;
  links: readonly Segment[];
  occlusion: Occlusion;
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
  weights: ReadonlyMap<string, number>;
}): (point: RelationshipGraphPoint) => number {
  if (occlusion.kind === "ignore") return () => 0;
  const { obstacle, reach } = occlusion;
  let pull = NETWORK_LAYOUT.originPull;
  for (const [otherId, weight] of weights) {
    if (positions.has(otherId)) pull += weight;
  }
  const penalty = reach * Math.hypot(cellSize.width, cellSize.height) * pull;
  return (point) => penalty * countOcclusions({ links, obstacle, point, positions, weights });
}

function toOverviewOcclusion(bucketCount: number): Occlusion {
  const { occlusionMargin, occlusionMaxBuckets, occlusionReach } = NETWORK_LAYOUT.overview;
  if (bucketCount > occlusionMaxBuckets) return { kind: "ignore" };
  return {
    kind: "avoid",
    obstacle: toCellSize({ box: GRAPH_NODE_BOX.cluster, gap: 2 * occlusionMargin }),
    reach: occlusionReach,
  };
}

function toOverviewOrder({
  buckets,
  weights,
}: {
  buckets: readonly NetworkBucket[];
  weights: WeightMap;
}): string[] {
  const sizeById = new Map(buckets.map((bucket) => [bucket.id, bucket.memberIds.length]));
  const totalWeightById = new Map<string, number>();
  for (const [id, row] of weights) {
    let total = 0;
    for (const weight of row.values()) total += weight;
    totalWeightById.set(id, total);
  }
  const pullById = new Map<string, number>();
  const pending = new Set(sizeById.keys());
  const order: string[] = [];
  while (pending.size > 0) {
    const scoreOf =
      order.length === 0
        ? (id: string) => totalWeightById.get(id) ?? 0
        : (id: string) => pullById.get(id) ?? 0;
    const next = pickStrongest({ candidates: pending, scoreOf, sizeById });
    if (next === null) break;
    pending.delete(next);
    order.push(next);
    for (const [otherId, weight] of weights.get(next) ?? new Map<string, number>()) {
      if (pending.has(otherId)) pullById.set(otherId, (pullById.get(otherId) ?? 0) + weight);
    }
  }
  return order;
}

function toPoint({
  cell,
  cellSize,
}: {
  cell: GridCell;
  cellSize: CellSize;
}): RelationshipGraphPoint {
  return { x: cell.column * cellSize.width, y: cell.row * cellSize.height };
}

function toWeightMap(pairs: readonly WeightedPair[]): WeightMap {
  const weights = new Map<string, Map<string, number>>();
  const add = ({ fromId, toId, weight }: { fromId: string; toId: string; weight: number }) => {
    const row = weights.get(fromId) ?? new Map<string, number>();
    row.set(toId, (row.get(toId) ?? 0) + weight);
    weights.set(fromId, row);
  };
  for (const pair of pairs) {
    add({ fromId: pair.leftId, toId: pair.rightId, weight: pair.weight });
    add({ fromId: pair.rightId, toId: pair.leftId, weight: pair.weight });
  }
  return weights;
}
